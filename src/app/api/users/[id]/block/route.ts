export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { success, error, unauthorized } from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { id } = await params;
  const blockedId = Number(id);

  if (isNaN(blockedId)) {
    return error("无效的用户 ID");
  }

  if (user.id === blockedId) {
    return error("不能屏蔽自己");
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) {
    return error("用户不存在", 404);
  }

  try {
    await prisma.userBlock.create({
      data: { blockerId: user.id, blockedId },
    });
    return success({ message: "已屏蔽该用户" });
  } catch {
    return error("已经屏蔽过该用户");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { id } = await params;
  const blockedId = Number(id);

  if (isNaN(blockedId)) {
    return error("无效的用户 ID");
  }

  await prisma.userBlock.deleteMany({
    where: { blockerId: user.id, blockedId },
  });

  return success({ message: "已取消屏蔽" });
}
