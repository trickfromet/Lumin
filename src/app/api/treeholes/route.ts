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

  const grouped = await prisma.postTag.groupBy({
    by: ["tag"],
    _count: { tag: true },
    where: {
      post: {
        isHidden: false,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    },
  });

  const latestMap = await prisma.postTag.groupBy({
    by: ["tag"],
    _max: { postId: true },
    where: { post: { isHidden: false } },
  });
  const latestPostIds = latestMap
    .map((item) => item._max.postId)
    .filter((id): id is number => typeof id === "number");
  const latestPosts = latestPostIds.length > 0
    ? await prisma.post.findMany({
        where: { id: { in: latestPostIds } },
        select: { id: true, createdAt: true, content: true },
      })
    : [];
  const latestPostById = new Map(latestPosts.map((p) => [p.id, p]));
  const latestByTag = new Map(
    latestMap.map((item) => [item.tag, item._max.postId ? latestPostById.get(item._max.postId) : null])
  );

  const treeholes = grouped
    .map((item) => {
      const tag = item.tag.trim();
      const latest = latestByTag.get(item.tag) || null;
      return {
        tag,
        count: item._count.tag,
        recentCount: item._count.tag,
        latestAt: latest?.createdAt || null,
        preview: latest?.content ? latest.content.slice(0, 40) : null,
      };
    })
    .filter((item) => item.tag.length > 0)
    .sort((a, b) => b.count - a.count);

  return success({ treeholes, meta: { range: range === "all" ? null : range } });
}
