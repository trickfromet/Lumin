import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { checkBanStatus } from "@/lib/ban-check";
import { performModeration } from "@/lib/moderation";
import { parsePagination } from "@/lib/pagination";
import { success, error, unauthorized } from "@/lib/api-response";

// GET /api/capsules — 我的时光胶囊列表
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { page, pageSize, skip } = parsePagination(
    request.nextUrl.searchParams,
  );

  const [capsules, total] = await Promise.all([
    prisma.timeCapsule.findMany({
      where: { userId: user.id },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { reservations: true } },
      },
    }),
    prisma.timeCapsule.count({ where: { userId: user.id } }),
  ]);

  const now = new Date();
  const enriched = capsules.map((c) => ({
    id: c.id,
    content: c.isPublished || c.isRecalled ? c.content : undefined,
    imageUrl: c.isPublished || c.isRecalled ? c.imageUrl : undefined,
    publishAt: c.publishAt,
    isPublished: c.isPublished,
    isRecalled: c.isRecalled,
    reservationCount: c._count.reservations,
    createdAt: c.createdAt,
    countdown:
      c.isPublished || c.isRecalled
        ? null
        : formatCountdown(c.publishAt.getTime() - now.getTime()),
  }));

  return success({
    capsules: enriched,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST /api/capsules — 创建时光胶囊
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const banStatus = await checkBanStatus(user);
  if (banStatus.banned) {
    return error(banStatus.reason!, 403);
  }

  const body = await request.json();
  const { content, imageUrl, delaySeconds } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return error("内容不能为空");
  }

  // Content moderation
  const moderation = await performModeration(user.id, content.trim());
  if (!moderation.passed) {
    return error(moderation.message || "内容包含违规信息", 422);
  }

  if (!delaySeconds || typeof delaySeconds !== "number" || delaySeconds <= 0) {
    return error("请设置有效的延迟时间");
  }

  // Free user max 7 days, Pro user max 365 days
  const maxSeconds = 7 * 24 * 60 * 60; // 7 days for now
  if (delaySeconds > maxSeconds) {
    return error(`免费用户最长延迟时间为 7 天`);
  }

  const publishAt = new Date(Date.now() + delaySeconds * 1000);

  const capsule = await prisma.timeCapsule.create({
    data: {
      userId: user.id,
      content: content.trim(),
      imageUrl: imageUrl || null,
      publishAt,
    },
  });

  return success(
    {
      ...capsule,
      countdown: formatCountdown(delaySeconds * 1000),
    },
    201,
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "已到期";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}秒`);

  return parts.join("") || "即将到期";
}
