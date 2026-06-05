import sensitiveWords from "@/data/sensitive-words.json";
import { prisma } from "./prisma";
import { notifyWarning, notifyBan } from "./notifications";

const BLOCK_THRESHOLD = 10;
const FLAG_THRESHOLD = 5;

function normalize(text: string): string {
  return text
    .replace(/[\s*._\-#@!$%^&()+=\[\]{}|\\;:'",.<>?/`~]/g, "")
    .toLowerCase();
}

export interface ModerationResult {
  passed: boolean;
  flagged: boolean;
  reason?: string;
  score: number;
}

export function moderateContent(text: string): ModerationResult {
  const normalized = normalize(text);
  let score = 0;
  const matched: string[] = [];

  for (const word of sensitiveWords.words) {
    const normalizedWord = normalize(word);
    if (normalizedWord && normalized.includes(normalizedWord)) {
      score += word.length >= 4 ? 3 : 2;
      matched.push(word);
    }
  }

  // 特殊处理：政治、色情、自杀等高敏感话题，只要匹配到就提高权重
  const highSensitive = [
    "色情",
    "porn",
    "sex",
    "hentai",
    "自杀",
    "suicide",
    "自残",
    "杀人",
    "kill",
    "毒品",
    "drug",
    "炸弹",
    "bomb",
    "恐怖",
    "terrorist",
    "政治敏感",
    "politics",
    "颠覆",
    "分裂",
  ];
  const hasHighSensitive = matched.some((m) => highSensitive.includes(m));

  if (hasHighSensitive || score >= BLOCK_THRESHOLD) {
    return {
      passed: false,
      flagged: true,
      reason: hasHighSensitive ? `内容包含极其敏感信息` : `内容包含违规信息`,
      score: hasHighSensitive ? Math.max(score, BLOCK_THRESHOLD) : score,
    };
  }

  if (score >= FLAG_THRESHOLD) {
    return {
      passed: true,
      flagged: true,
      reason: "内容可能包含敏感信息",
      score,
    };
  }

  return { passed: true, flagged: false, score };
}

/**
 * 执行内容审查并处理违规逻辑（第一次警告，第二次封禁）
 */
export async function performModeration(
  userId: number,
  content: string,
): Promise<{
  passed: boolean;
  message?: string;
}> {
  const moderation = moderateContent(content);

  if (moderation.passed) {
    return { passed: true };
  }

  // 处理违规
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, banCount: true },
  });

  if (!user) {
    return { passed: false, message: moderation.reason };
  }

  const newBanCount = user.banCount + 1;

  if (newBanCount === 1) {
    // 第一次违规：警告
    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: { banCount: newBanCount },
      }),
      notifyWarning(userId, moderation.reason || "违规内容"),
    ]);
    return {
      passed: false,
      message: `内容包含违规信息。由于是初次违规，已向您发送系统警告通知。再次违规将导致账号被封禁。`,
    };
  } else {
    // 第二次或更多次违规：封禁
    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banCount: newBanCount,
          status: "banned",
        },
      }),
      notifyBan(userId, `多次发布违规内容：${moderation.reason}`),
    ]);
    return {
      passed: false,
      message: `内容包含违规信息。由于您多次违规，账号已被系统封禁。`,
    };
  }
}

/**
 * 执行游客内容审查并处理违规逻辑（第一次警告，第二次封禁IP）
 */
export async function performGuestModeration(
  ip: string,
  content: string,
): Promise<{
  passed: boolean;
  message?: string;
}> {
  const moderation = moderateContent(content);

  if (moderation.passed) {
    return { passed: true };
  }

  // 处理游客违规
  const guest = await prisma.guest.upsert({
    where: { ip },
    update: { violationCount: { increment: 1 } },
    create: { ip, violationCount: 1 },
  });

  if (guest.violationCount === 1) {
    // 第一次违规：警告
    return {
      passed: false,
      message: `内容包含违规信息。由于您是以游客身份发布，这是第一次警告。再次违规将禁止您的设备访问服务。`,
    };
  } else {
    // 第二次或更多次违规：封禁IP
    await prisma.guest.update({
      where: { ip },
      data: { isBanned: true },
    });
    return {
      passed: false,
      message: `内容包含违规信息。由于您多次违规，您的设备已被系统禁止访问。`,
    };
  }
}
