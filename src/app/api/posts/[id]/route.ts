import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getUserFromRequest,
  requireAuth,
  AuthError,
  getIpFromRequest,
} from "@/lib/auth";
import { decryptContent } from "@/lib/encryption";
import { getMeTooTier } from "@/lib/metoo-tiers";
import { success, error, unauthorized } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      tags: { select: { tag: true } },
      _count: { select: { metoos: true, comments: true } },
    },
  });

  if (!post) {
    return error("帖子不存在", 404);
  }

  if (post.isHidden) {
    return error("该帖子已被隐藏", 404);
  }

  const currentUser = await getUserFromRequest();

  // Check if blocked
  if (currentUser && post.userId) {
    const block = await prisma.userBlock.findFirst({
      where: {
        blockerId: currentUser.id,
        blockedId: post.userId,
      },
    });
    if (block) {
      return error("该帖子不存在", 404);
    }
  }

  const decryptedContent = post.isEncrypted
    ? decryptContent(post.encryptedContent!, post.iv!, post.authTag!)
    : post.content;

  const ip = getIpFromRequest(request);

  let userHasMetoed = false;
  const metoo = await prisma.meToo.findFirst({
    where: currentUser ? { userId: currentUser.id, postId } : { ip, postId },
  });
  userHasMetoed = !!metoo;

  return success({
    post: {
      id: post.id,
      nickname: post.nickname,
      content: decryptedContent,
      imageUrl: post.imageUrl,
      category: post.category,
      tags: post.tags.map((t) => t.tag),
      createdAt: post.createdAt,
      metooCount: post._count.metoos,
      metooTier: getMeTooTier(post._count.metoos),
      commentCount: post._count.comments,
      userHasMetoed,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  if (post.userId !== user.id) {
    return error("只能删除自己的帖子", 403);
  }

  await prisma.post.delete({ where: { id: postId } });
  return success({ message: "帖子已删除" });
}
