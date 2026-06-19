// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, getIpFromRequest } from "@/lib/auth";
import { checkBanStatus } from "@/lib/ban-check";
import { performModeration, performGuestModeration } from "@/lib/moderation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateNickname } from "@/lib/nickname";
import { success, error } from "@/lib/api-response";

// GET /api/posts/[id]/comments?parentId=X
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  const parentId = request.nextUrl.searchParams.get("parentId");

  const where: Record<string, unknown> = { postId };
  if (parentId) {
    where.parentId = Number(parentId);
  } else {
    where.parentId = null; // Top-level comments only
  }

  const currentUser = await getUserFromRequest();

  // Filter out blocked users' comments
  if (currentUser) {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: currentUser.id },
      select: { blockedId: true },
    });
    if (blocks.length > 0) {
      where.userId = { notIn: blocks.map((b) => b.blockedId) };
    }
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { replies: true } },
    },
  });

  const result = comments.map((c) => ({
    id: c.id,
    nickname: c.nickname,
    content: c.content,
    postId: c.postId,
    parentId: c.parentId,
    replyCount: c._count.replies,
    createdAt: c.createdAt,
  }));

  return success({ comments: result });
}

// POST /api/posts/[id]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest();
  const ip = getIpFromRequest(request);
  let commenterNickname = "游客";

  // Check ban
  if (user) {
    const banStatus = await checkBanStatus(user);
    if (banStatus.banned) {
      return error(banStatus.reason!, 403);
    }
    commenterNickname = user.nickname;
  } else {
    const guest = await prisma.guest.findUnique({ where: { ip } });
    if (guest) {
      if (guest.isBanned) {
        return error("您的设备已被禁止访问服务", 403);
      }
      if (!guest.nickname) {
        commenterNickname = "游客" + generateNickname();
        await prisma.guest.update({
          where: { ip },
          data: { nickname: commenterNickname },
        });
      } else {
        commenterNickname = guest.nickname;
      }
    } else {
      commenterNickname = "游客" + generateNickname();
      await prisma.guest.create({
        data: { ip, postCount: 0, nickname: commenterNickname },
      });
    }
  }

  // Rate limit
  const rateKey = user ? `comment:${user.id}` : `comment_guest:${ip}`;
  const rate = checkRateLimit(
    rateKey,
    RATE_LIMITS.comment.maxRequests,
    RATE_LIMITS.comment.windowMs,
  );
  if (!rate.allowed) {
    return error("评论过于频繁，请稍后再试", 429);
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

  if (post.allowComments === false) {
    return error("该帖子已关闭评论功能", 403);
  }

  if (post.allowStrangerComments === false && !user) {
    return error("该帖子仅允许注册用户评论", 403);
  }

  const body = await request.json();
  const { content, parentId } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return error("评论内容不能为空");
  }

  if (content.length > 1000) {
    return error("评论内容不能超过 1000 字", 400);
  }

  // Content moderation
  if (user) {
    const moderation = await performModeration(user.id, content.trim());
    if (!moderation.passed) {
      return error(moderation.message || "内容包含违规信息", 422);
    }
  } else {
    const moderation = await performGuestModeration(ip, content.trim());
    if (!moderation.passed) {
      return error(moderation.message || "内容包含违规信息", 422);
    }
  }

  // Validate parentId if provided
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: Number(parentId) },
    });
    if (!parentComment || parentComment.postId !== postId) {
      return error("回复的评论不存在", 404);
    }
  }

  const comment = await prisma.comment.create({
    data: {
      userId: user?.id || null,
      ip,
      nickname: commenterNickname,
      content: content.trim(),
      postId,
      parentId: parentId ? Number(parentId) : null,
    },
    include: {
      _count: { select: { replies: true } },
    },
  });

  return success(
    {
      id: comment.id,
      nickname: comment.nickname,
      content: comment.content,
      postId: comment.postId,
      parentId: comment.parentId,
      replyCount: 0,
      createdAt: comment.createdAt,
    },
    201,
  );
}
