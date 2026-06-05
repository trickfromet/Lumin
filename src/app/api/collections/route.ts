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

  const [collections, total] = await Promise.all([
    prisma.collection.findMany({
      where: { userId: user.id },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          select: {
            id: true,
            nickname: true,
            content: true,
            imageUrl: true,
            createdAt: true,
            _count: { select: { metoos: true, comments: true } },
          },
        },
      },
    }),
    prisma.collection.count({ where: { userId: user.id } }),
  ]);

  return success({
    collections: collections.map((c) => ({
      id: c.id,
      postId: c.postId,
      createdAt: c.createdAt,
      post: c.post,
    })),
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}
