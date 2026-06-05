export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNickname } from "@/lib/nickname";
import {
  hashPassword,
  validatePassword,
  signToken,
  setTokenCookie,
  hashInviteCode,
} from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, clearRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(
    `register:${ip}`,
    RATE_LIMITS.register.maxRequests,
    RATE_LIMITS.register.windowMs
  );
  if (!rate.allowed) {
    return error("注册请求过于频繁，请稍后再试", 429);
  }

  const body = await request.json();
  const { phone, email, password, inviteCode: _inviteCode } = body;

  if (!phone && !email) {
    return error("请提供手机号或邮箱");
  }

  if (!password) {
    return error("请设置密码");
  }

  // Validate invite code
  /*
  if (!inviteCode) {
    return error("请输入邀请码", 400);
  }
  const codeHash = hashInviteCode(inviteCode);
  const invite = await prisma.inviteCode.findUnique({
    where: { codeHash },
  });
  if (!invite) {
    return error("邀请码无效", 400);
  }
  if (invite.useCount >= invite.maxUses) {
    return error("邀请码已失效", 400);
  }
  */

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return error(passwordValidation.error!);
  }

  // Check duplicates
  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return error("该手机号已注册");
  }
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error("该邮箱已注册");
  }

  const passwordHash = await hashPassword(password);
  const nickname = generateNickname();

  const user = await prisma.user.create({
    data: {
      phone: phone || null,
      email: email || null,
      passwordHash,
      nickname,
    },
  });

  // Consume invite code
  /*
  await prisma.inviteCode.update({
    where: { id: invite.id },
    data: { useCount: { increment: 1 } },
  });
  */

  // ── 自动分发邀请码：ID ≤ 3000 的用户获得一个 ──
  let autoInviteCode: string | undefined;
  if (user.id <= 3000) {
    const raw = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const newHash = await hashInviteCode(raw);
    await prisma.inviteCode.create({
      data: { codeHash: newHash, maxUses: 4 },
    });
    autoInviteCode = raw;
  }

  // 注册成功后释放限频 key
  clearRateLimit(`register:${ip}`);

  const token = await signToken(user.id);

  return success(
    {
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        avatarUrl: user.avatarUrl,
        status: user.status,
        role: user.role,
      },
      ...(autoInviteCode ? { inviteCode: autoInviteCode } : {}),
    },
    201,
    setTokenCookie(token)
  );
}
