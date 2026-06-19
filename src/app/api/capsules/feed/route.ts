// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { success, unauthorized } from "@/lib/api-response";

// GET /api/capsules/feed — 浏览他人的时光胶囊（可预约）
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams);

  const where = {
    isPublished: false,
    isRecalled: false,
    publishAt: { gt: new Date() },
    userId: { not: user.id },
  };

  const [capsules, total] = await Promise.all([
    prisma.timeCapsule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { publishAt: "asc" },
      include: {
        _count: { select: { reservations: true } },
        reservations: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    }),
    prisma.timeCapsule.count({ where }),
  ]);

  const now = new Date();
  const enriched = capsules.map((c) => ({
    id: c.id,
    publishAt: c.publishAt,
    reservationCount: c._count.reservations,
    userHasReserved: c.reservations.length > 0,
    countdown: formatCountdown(c.publishAt.getTime() - now.getTime()),
    createdAt: c.createdAt,
  }));

  return success({
    capsules: enriched,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "已到期";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}秒`);
  return parts.join("") || "即将到期";
}
