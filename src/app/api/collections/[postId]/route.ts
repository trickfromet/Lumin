import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { success, error, unauthorized } from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { postId } = await params;
  const postIdNum = Number(postId);

  if (isNaN(postIdNum)) {
    return error("无效的帖子 ID");
  }

  const post = await prisma.post.findUnique({ where: { id: postIdNum } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  try {
    await prisma.collection.create({
      data: { userId: user.id, postId: postIdNum },
    });
    return success({ message: "已收藏" });
  } catch {
    return error("已经收藏过了", 409);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { postId } = await params;
  const postIdNum = Number(postId);

  if (isNaN(postIdNum)) {
    return error("无效的帖子 ID");
  }

  await prisma.collection.deleteMany({
    where: { userId: user.id, postId: postIdNum },
  });

  return success({ message: "已取消收藏" });
}
