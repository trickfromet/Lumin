export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, getIpFromRequest } from "@/lib/auth";
import { generateNickname } from "@/lib/nickname";
import { encryptContent, decryptContent } from "@/lib/encryption";
import { performModeration, performGuestModeration } from "@/lib/moderation";
import {
  classifyPost,
  normalizeTag,
  getDefaultTagForContent,
  isTagAllowed,
  detectLanguage,
} from "@/lib/category-classifier";
import { getMeTooTier } from "@/lib/metoo-tiers";
import { checkBanStatus } from "@/lib/ban-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/pagination";
import { success, error } from "@/lib/api-response";

// GET /api/posts?page=1&categoryId=2&tag=心情
export async function GET(request: NextRequest) {
  const { page, pageSize, skip } = parsePagination(
    request.nextUrl.searchParams,
  );
  const categoryId = request.nextUrl.searchParams.get("categoryId");
  const tag = request.nextUrl.searchParams.get("tag");
  const userId = request.nextUrl.searchParams.get("userId");
  const language = request.nextUrl.searchParams.get("language");

  const where: Record<string, unknown> = { isHidden: false };
  if (categoryId) where.categoryId = Number(categoryId);
  if (userId) where.userId = Number(userId);
  if (language) where.language = language;
  if (tag) {
    where.tags = { some: { tag } };
  }

  // Get blocked user IDs if authenticated
  const currentUser = await getUserFromRequest();
  if (currentUser) {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: currentUser.id },
      select: { blockedId: true },
    });
    if (blocks.length > 0) {
      where.userId = { notIn: blocks.map((b) => b.blockedId) };
    }
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        tags: { select: { tag: true } },
        _count: { select: { metoos: true, comments: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  // Check if current user has metoo'd each post
  let userMetooSet = new Set<number>();
  if (currentUser) {
    const metooPostIds = await prisma.meToo.findMany({
      where: {
        userId: currentUser.id,
        postId: { in: posts.map((p) => p.id) },
      },
      select: { postId: true },
    });
    userMetooSet = new Set(metooPostIds.map((m) => m.postId));
  }

  const enrichedPosts = await Promise.all(
    posts.map(async (post) => {
      const decryptedContent = post.isEncrypted
        ? await decryptContent(post.encryptedContent!, post.iv!, post.authTag!)
        : post.content;

    return {
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
      userHasMetoed: userMetooSet.has(post.id),
    };
  });

  return success({
    posts: enrichedPosts,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST /api/posts — 发布帖子
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest();
    const ip = getIpFromRequest(request);
    let guestNickname = "游客";

    // If user is logged in, check ban
    if (user) {
      const banStatus = await checkBanStatus(user);
      if (banStatus.banned) {
        return error(banStatus.reason!, 403);
      }
    } else {
      // Guest Mode check
      const guest = await prisma.guest.findUnique({ where: { ip } });
      if (guest) {
        if (guest.isBanned) {
          return error("您的设备已被禁止访问服务", 403);
        }
        if (guest.postCount >= 5) {
          return error("游客模式仅限发布 5 条树洞，请注册账号继续分享", 403);
        }
        if (!guest.nickname) {
          guestNickname = generateNickname();
        } else {
          guestNickname = guest.nickname;
        }
      } else {
        guestNickname = generateNickname();
      }
    }

    // Rate limit
    const rateKey = user ? `post:${user.id}` : `post_guest:${ip}`;
    const rate = checkRateLimit(
      rateKey,
      RATE_LIMITS.post.maxRequests,
      RATE_LIMITS.post.windowMs,
    );
    if (!rate.allowed) {
      return error("发帖过于频繁，请稍后再试", 429);
    }

    const body = await request.json();
    const { content, imageUrl, tags, categoryId } = body;

    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return error("内容不能为空");
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

    // Encrypt content
    const { encrypted, iv, authTag } = await encryptContent(content.trim());

    // Auto-classify if no category provided
    let finalCategoryId = categoryId ? Number(categoryId) : null;
    const derivedTag = classifyPost(content.trim());
    if (!finalCategoryId) {
      if (derivedTag) {
        const category = await prisma.category.findUnique({
          where: { name: derivedTag },
        });
        if (category) finalCategoryId = category.id;
      }
    }

    const normalizedTags = Array.isArray(tags)
      ? (tags as string[])
          .map((tag) => normalizeTag(tag))
          .filter((tag) => tag.length > 0)
      : [];
    const filteredTags = normalizedTags.filter((tag) => isTagAllowed(tag));

    // 确保至少有一个标签，如果没有则使用自动分类或默认标签
    if (filteredTags.length === 0) {
      filteredTags.push(derivedTag || getDefaultTagForContent(content));
    }

    // 只保留最关联的一个标签，避免出现在多个树洞中
    let finalTag = filteredTags[0];
    if (derivedTag && filteredTags.includes(derivedTag)) {
      finalTag = derivedTag;
    }
    const finalTags = [finalTag];

    const post = await prisma.post.create({
      data: {
        userId: user?.id || null,
        nickname: user?.nickname || guestNickname,
        encryptedContent: encrypted,
        iv,
        authTag,
        isEncrypted: true,
        imageUrl: imageUrl || null,
        language: detectLanguage(content.trim()),
        categoryId: finalCategoryId,
        tags: {
          create: finalTags
            .filter((t) => typeof t === "string" && t.length > 0)
            .map((tag) => ({ tag })),
        },
      },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        tags: { select: { tag: true } },
      },
    });

    // If guest, increment post count
    let guestHint = null;
    if (!user) {
      const updatedGuest = await prisma.guest.upsert({
        where: { ip },
        update: { postCount: { increment: 1 }, nickname: guestNickname },
        create: { ip, postCount: 1, nickname: guestNickname },
      });
      if (updatedGuest.postCount >= 5) {
        guestHint = "您已达到游客发布上限，注册后可继续分享。";
      }
    }

    return success(
      {
        ...post,
        content: content.trim(),
        encryptedContent: undefined,
        iv: undefined,
        authTag: undefined,
        isEncrypted: undefined,
        tags: post.tags.map((t) => t.tag),
        guestHint,
      },
      201,
    );
  } catch (err: unknown) {
    console.error("POST /api/posts error:", err);
    return error(err instanceof Error ? err.message : "内部服务器错误", 500);
  }
}
