import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setTokenCookie } from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(
    `login:${ip}`,
    RATE_LIMITS.login.maxRequests,
    RATE_LIMITS.login.windowMs
  );
  if (!rate.allowed) {
    return error("登录请求过于频繁，请稍后再试", 429);
  }

  const body = await request.json();
  const { phoneOrEmail, password } = body;

  if (!phoneOrEmail || !password) {
    return error("请输入账号和密码");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: phoneOrEmail }, { email: phoneOrEmail }],
    },
  });

  if (!user) {
    return error("账号或密码错误");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return error("账号或密码错误");
  }

  if (user.isBanned) {
    return error("账号已被永久封禁", 403);
  }

  if (user.banExpiresAt && user.banExpiresAt > new Date()) {
    const remaining = Math.ceil(
      (user.banExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return error(`账号已被封禁，剩余 ${remaining} 小时`, 403);
  }

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
    },
    200,
    setTokenCookie(token)
  );
}
