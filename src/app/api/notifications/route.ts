// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { success, unauthorized } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where: { userId: user.id } }),
  ]);

  return success({
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}
