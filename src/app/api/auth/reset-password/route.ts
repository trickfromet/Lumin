export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  validatePassword,
  // hashInviteCode,
  signToken,
  setTokenCookie,
} from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(
    `reset-password:${ip}`,
    RATE_LIMITS.register.maxRequests,
    RATE_LIMITS.register.windowMs
  );
  if (!rate.allowed) {
    return error("操作过于频繁，请稍后再试", 429);
  }

  const body = await request.json();
  const { email, inviteCode: _inviteCode, newPassword } = body;

  if (!email) {
    return error("请输入邮箱");
  }
  /*
  if (!inviteCode) {
    return error("请输入邀请码");
  }
  */
  if (!newPassword) {
    return error("请输入新密码");
  }

  // Validate invite code
  /*
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

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    return error("该邮箱未注册", 404);
  }

  // Validate new password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return error(passwordValidation.error!);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  /*
  await prisma.inviteCode.update({
    where: { id: invite.id },
    data: { useCount: { increment: 1 } },
  });
  */

  // Generate new token to log the user in
  const token = await signToken(user.id);

  return success(
    {
      message: "密码已重置",
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        avatarUrl: user.avatarUrl,
        status: user.status,
        role: user.role,
      },
    },
    200,
    setTokenCookie(token)
  );
}
