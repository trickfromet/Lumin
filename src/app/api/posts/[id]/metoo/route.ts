export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, getIpFromRequest } from "@/lib/auth";
import { getMeTooTier } from "@/lib/metoo-tiers";
import { notifyMeToo } from "@/lib/notifications";
import { success, error } from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest();
  const ip = getIpFromRequest(request);

  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  const existing = await prisma.meToo.findFirst({
    where: user ? { userId: user.id, postId } : { ip, postId },
  });

  if (existing) {
    return error("你已经表达过感同身受了", 409);
  }

  await prisma.meToo.create({
    data: user ? { userId: user.id, postId, ip } : { ip, postId },
  });

  const count = await prisma.meToo.count({ where: { postId } });
  const tier = getMeTooTier(count);

  // Notify post author (but not yourself)
  if (post.userId && user && post.userId !== user.id) {
    await notifyMeToo(post.userId, postId);
  }

  return success({ metooed: true, count, tier });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest();
  const ip = getIpFromRequest(request);

  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  if (user) {
    await prisma.meToo.deleteMany({
      where: { userId: user.id, postId },
    });
  } else {
    await prisma.meToo.deleteMany({
      where: { ip, postId },
    });
  }

  const count = await prisma.meToo.count({ where: { postId } });
  const tier = getMeTooTier(count);

  return success({ metooed: false, count, tier });
}
