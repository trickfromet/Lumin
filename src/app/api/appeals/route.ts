// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { success, error, unauthorized, forbidden } from "@/lib/api-response";

// POST /api/appeals — 提交申诉
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  if (!user.isBanned && (!user.banExpiresAt || user.banExpiresAt <= new Date())) {
    return error("你当前没有被封禁，无需申诉", 403);
  }

  // Check if already have a pending appeal
  const existing = await prisma.appeal.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (existing) {
    return error("你已经有一个待处理的申诉");
  }

  const body = await request.json();
  const { reason } = body;

  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return error("请填写申诉理由");
  }

  const appeal = await prisma.appeal.create({
    data: {
      userId: user.id,
      reason: reason.trim(),
    },
  });

  return success({ appeal }, 201);
}

// GET /api/appeals — 管理员查看申诉列表
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  if (user.role !== "admin") {
    return forbidden("仅管理员可查看申诉列表");
  }

  const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams);
  const status = request.nextUrl.searchParams.get("status") || "pending";

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;

  const [appeals, total] = await Promise.all([
    prisma.appeal.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, nickname: true, banCount: true } },
      },
    }),
    prisma.appeal.count({ where }),
  ]);

  return success({
    appeals,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}
