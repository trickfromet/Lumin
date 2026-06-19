// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { checkBanStatus } from "@/lib/ban-check";
import { performModeration } from "@/lib/moderation";
import { success, error, unauthorized } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  // Check ban
  const banStatus = await checkBanStatus(user);
  if (banStatus.banned) {
    return error(banStatus.reason!, 403);
  }

  const body = await request.json();
  const { rating, content } = body;

  if (!rating || !["good", "bad"].includes(rating)) {
    return error("请选择好评或差评");
  }
  if (!content || !content.trim()) {
    return error("请输入反馈内容");
  }

  // Content moderation
  const moderation = await performModeration(user.id, content.trim());
  if (!moderation.passed) {
    return error(moderation.message || "内容包含违规信息", 422);
  }

  try {
    await prisma.feedback.create({
      data: {
        userId: user.id,
        rating,
        content: content.trim(),
      },
    });
    return success({ message: "感谢你的反馈！" });
  } catch (e) {
    return error((e as Error).message);
  }
}
