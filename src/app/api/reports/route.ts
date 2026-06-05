import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/pagination";
import { success, error, unauthorized, forbidden } from "@/lib/api-response";

// POST /api/reports — 提交举报
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const rate = checkRateLimit(
    `report:${user.id}`,
    RATE_LIMITS.report.maxRequests,
    RATE_LIMITS.report.windowMs
  );
  if (!rate.allowed) {
    return error("举报请求过于频繁，请稍后再试", 429);
  }

  const body = await request.json();
  const { postId, reportedUserId, reason } = body;

  if (!postId && !reportedUserId) {
    return error("请指定举报的帖子或用户");
  }

  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return error("请填写举报原因");
  }

  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: Number(postId) } });
    if (!post) return error("帖子不存在", 404);
  }

  if (reportedUserId) {
    const reportedUser = await prisma.user.findUnique({
      where: { id: Number(reportedUserId) },
    });
    if (!reportedUser) return error("用户不存在", 404);
    if (reportedUser.id === user.id) return error("不能举报自己");
  }

  const report = await prisma.report.create({
    data: {
      reporterId: user.id,
      postId: postId ? Number(postId) : null,
      reportedUserId: reportedUserId ? Number(reportedUserId) : null,
      reason: reason.trim(),
    },
  });

  return success({ report }, 201);
}

// GET /api/reports — 管理员查看举报列表
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  if (user.role !== "admin") {
    return forbidden("仅管理员可查看举报列表");
  }

  const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams);
  const status = request.nextUrl.searchParams.get("status") || "pending";

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { id: true, nickname: true } },
        reportedUser: { select: { id: true, nickname: true } },
        post: { select: { id: true, content: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return success({
    reports,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}
