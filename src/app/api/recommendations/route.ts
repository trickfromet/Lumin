export const runtime = "edge";
import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getRecommendedPosts, getWarmPosts } from "@/lib/recommendation";
import { success, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/recommendations?limit=10&categoryId=3
 *
 * Returns recommended posts for the current user.
 * - Authenticated users with post history → category-based recommendations
 * - Authenticated users without history → cold start (warm posts)
 * - Guest users → cold start (warm posts)
 *
 * Optional query params:
 *  - limit: number of posts to return (default 10, max 30)
 *  - categoryId: filter warm posts to a specific category (cold-start only)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawLimit = Number(params.get("limit")) || 10;
  const limit = Math.min(30, Math.max(1, rawLimit));
  const categoryId = params.get("categoryId")
    ? Number(params.get("categoryId"))
    : undefined;
  const language = params.get("language") || undefined;

  const user = await getUserFromRequest();

  try {
    // If a specific category is requested for cold start, use getWarmPosts
    if (categoryId && !user) {
      const posts = await getWarmPosts(limit, categoryId, language);
      return success({ posts });
    }

    const posts = await getRecommendedPosts(user?.id ?? null, limit, language);
    return success({ posts });
  } catch (err: unknown) {
    console.error("GET /api/recommendations error:", err);
    return error(
      err instanceof Error ? err.message : "内部服务器错误",
      500,
    );
  }
}
