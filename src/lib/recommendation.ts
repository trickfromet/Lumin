import { prisma } from "./prisma";

// ── Types ──

export interface RecommendedPost {
  id: number;
  nickname: string;
  content: string;
  imageUrl: string | null;
  category: { id: number; name: string; icon: string } | null;
  tags: string[];
  createdAt: Date;
  metooCount: number;
  commentCount: number;
  userHasMetoed?: boolean;
}

// ── User Profile ──

interface UserProfile {
  categoryWeights: Map<number, number>; // categoryId → accumulated weight
  totalPosts: number;
}

/**
 * Build a user interest profile from their post history and interactions.
 * Each post in a category adds +3 weight; each metoo adds +1.
 */
async function buildUserProfile(userId: number): Promise<UserProfile> {
  const categoryWeights = new Map<number, number>();

  // Weight: user's own posts → +3 per post
  const userPosts = await prisma.post.findMany({
    where: { userId, categoryId: { not: null } },
    select: { categoryId: true },
  });
  for (const p of userPosts) {
    if (p.categoryId !== null) {
      categoryWeights.set(
        p.categoryId,
        (categoryWeights.get(p.categoryId) || 0) + 3,
      );
    }
  }

  // Weight: posts user metoo'd → +1 per metoo
  const metoos = await prisma.meToo.findMany({
    where: { userId },
    select: { post: { select: { categoryId: true } } },
  });
  for (const m of metoos) {
    if (m.post.categoryId !== null) {
      categoryWeights.set(
        m.post.categoryId,
        (categoryWeights.get(m.post.categoryId) || 0) + 1,
      );
    }
  }

  return { categoryWeights, totalPosts: userPosts.length };
}

/**
 * Select recommended posts for a user.
 *
 * Algorithm:
 * 1. Build user profile from post + metoo history.
 * 2. Rank categories by accumulated weight.
 * 3. Fetch posts from top categories, with slight diversity injection.
 * 4. Exclude posts from blocked users and the user's own posts.
 */
async function getRecommendations(
  userId: number,
  limit: number,
  language?: string,
): Promise<RecommendedPost[]> {
  const profile = await buildUserProfile(userId);

  // Get blocked user IDs
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  const blockedIds = blocks.map((b) => b.blockedId);

  const whereBase: Record<string, unknown> = {
    isHidden: false,
    userId: { not: null },
  };
  if (language) whereBase.language = language;
  if (blockedIds.length > 0) {
    whereBase.userId = { notIn: blockedIds };
  }
  // Exclude user's own posts
  whereBase.userId = { ...((whereBase.userId as Record<string, unknown>) || {}), not: userId };

  // Sort categories by weight descending
  const sortedCategories = Array.from(profile.categoryWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // If user has no category history, return empty (caller should fallback to cold start)
  if (sortedCategories.length === 0) return [];

  // Strategy: 70% from top categories, 30% from others for diversity
  const topCount = Math.ceil(limit * 0.7);
  const _diverseCount = limit - topCount;

  const results: RecommendedPost[] = [];
  const seenIds = new Set<number>();

  // Fetch from top categories (up to 2 top categories)
  const topCategoryIds = sortedCategories.slice(0, 2);
  if (topCategoryIds.length > 0) {
    const topPosts = await prisma.post.findMany({
      where: {
        ...whereBase,
        categoryId: { in: topCategoryIds },
      },
      orderBy: [{ metoos: { _count: "desc" } }, { createdAt: "desc" }],
      take: topCount * 2,
      include: {
        category: { select: { id: true, name: true, icon: true } },
        tags: { select: { tag: true } },
        _count: { select: { metoos: true, comments: true } },
      },
    });

    for (const p of topPosts) {
      if (seenIds.has(p.id) || p.userId === userId) continue;
      seenIds.add(p.id);
      results.push(mapPost(p));
      if (results.length >= topCount) break;
    }
  }

  // Fetch diverse posts from ALL other categories
  const remainingIds = sortedCategories.slice(2);
  const allCategoryIds = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const allIds = allCategoryIds.map((c) => c.id);
  const diverseFrom = remainingIds.length > 0
    ? remainingIds
    : allIds.filter((id) => !topCategoryIds.includes(id));

  if (diverseFrom.length > 0 && results.length < limit) {
    const diversePosts = await prisma.post.findMany({
      where: {
        ...whereBase,
        categoryId: { in: diverseFrom },
      },
      orderBy: { createdAt: "desc" },
      take: (limit - results.length) * 2,
      include: {
        category: { select: { id: true, name: true, icon: true } },
        tags: { select: { tag: true } },
        _count: { select: { metoos: true, comments: true } },
      },
    });

    for (const p of diversePosts) {
      if (seenIds.has(p.id) || p.userId === userId) continue;
      seenIds.add(p.id);
      results.push(mapPost(p));
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Cold start: return warm posts for users with no post history.
 * Warm posts are defined as posts with userId === null (system-generated).
 */
async function getColdStartRecommendations(
  limit: number,
  language?: string,
): Promise<RecommendedPost[]> {
  // Get warm posts (userId is null = system generated)
  const coldWhere: Record<string, unknown> = {
    userId: null,
    isHidden: false,
  };
  if (language) coldWhere.language = language;

  const warmPosts = await prisma.post.findMany({
    where: coldWhere,
    orderBy: { createdAt: "desc" },
    take: limit * 2,
    include: {
      category: { select: { id: true, name: true, icon: true } },
      tags: { select: { tag: true } },
      _count: { select: { metoos: true, comments: true } },
    },
  });

  // Shuffle them for variety
  const shuffled = warmPosts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map(mapPost);
}

// ── Main entry point ──

/**
 * Get recommended posts for a user.
 * - userId is null → cold start (warm posts)
 * - User has no history → cold start
 * - User has history → category-based recommendations
 */
export async function getRecommendedPosts(
  userId: number | null,
  limit: number = 10,
  language?: string,
): Promise<RecommendedPost[]> {
  if (!userId) {
    return getColdStartRecommendations(limit, language);
  }

  const recs = await getRecommendations(userId, limit, language);
  if (recs.length === 0) {
    return getColdStartRecommendations(limit, language);
  }

  return recs;
}

/**
 * Get cold start posts specifically (always warm posts regardless of user).
 */
export async function getWarmPosts(
  limit: number = 10,
  categoryId?: number,
  language?: string,
): Promise<RecommendedPost[]> {
  const where: Record<string, unknown> = {
    userId: null,
    isHidden: false,
  };
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (language) {
    where.language = language;
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit * 2,
    include: {
      category: { select: { id: true, name: true, icon: true } },
      tags: { select: { tag: true } },
      _count: { select: { metoos: true, comments: true } },
    },
  });

  const shuffled = posts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map(mapPost);
}

// ── Helpers ──

function mapPost(
  p: {
    id: number;
    nickname: string;
    content: string | null;
    encryptedContent?: string | null;
    isEncrypted?: boolean;
    imageUrl: string | null;
    category: { id: number; name: string; icon: string | null } | null;
    tags: { tag: string }[];
    createdAt: Date;
    _count: { metoos: number; comments: number };
  },
): RecommendedPost {
  return {
    id: p.id,
    nickname: p.nickname,
    content: p.content ?? "",
    imageUrl: p.imageUrl,
    category: p.category
      ? { id: p.category.id, name: p.category.name, icon: p.category.icon ?? "" }
      : null,
    tags: p.tags.map((t) => t.tag),
    createdAt: p.createdAt,
    metooCount: p._count.metoos,
    commentCount: p._count.comments,
  };
}
