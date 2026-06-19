// export const runtime = "edge";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") || "all").toLowerCase();
  const now = Date.now();
  const ranges: Record<string, number> = {
    day: 1,
    week: 7,
    month: 30,
  };
  const days = ranges[range];
  const since = days ? new Date(now - days * 24 * 60 * 60 * 1000) : null;

  // 第一步：查出所有可见帖子的 ID（避免在 groupBy 中使用跨表关系过滤，后者在 LibSQL 中可能异常）
  const visibleFilter: Record<string, unknown> = { isHidden: false };
  if (since) visibleFilter.createdAt = { gte: since };
  const visiblePosts = await prisma.post.findMany({
    where: visibleFilter,
    select: { id: true, createdAt: true, content: true },
  });
  const visiblePostIds = visiblePosts.map((p) => p.id);

  // 第二步：仅对可见帖子的 Tag 做分组统计（使用简单的 ID IN 过滤，跨表兼容性好）
  const grouped = await prisma.postTag.groupBy({
    by: ["tag"],
    _count: { tag: true },
    _max: { postId: true },
    where: visiblePostIds.length > 0 ? { postId: { in: visiblePostIds } } : { postId: -1 },
  });

  // 构建 postId → post 的快速查找表
  const postById = new Map(visiblePosts.map((p) => [p.id, p]));

  const treeholes = grouped
    .map((item) => {
      const tag = item.tag.trim();
      const latestPost = item._max.postId ? postById.get(item._max.postId) : null;
      return {
        tag,
        count: item._count.tag,
        recentCount: item._count.tag,
        latestAt: latestPost?.createdAt || null,
        preview: latestPost?.content ? latestPost.content.slice(0, 40) : null,
      };
    })
    .filter((item) => item.tag.length > 0)
    .sort((a, b) => b.count - a.count);

  return success({ treeholes, meta: { range: range === "all" ? null : range } });
}
