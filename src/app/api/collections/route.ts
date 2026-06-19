// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { success, unauthorized, error } from "@/lib/api-response";

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

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error("无效的请求体");
  }

  const { postId } = body;
  const postIdNum = Number(postId);

  if (isNaN(postIdNum)) {
    return error("无效的帖子 ID");
  }

  const post = await prisma.post.findUnique({ where: { id: postIdNum } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  try {
    await prisma.collection.create({
      data: { userId: user.id, postId: postIdNum },
    });
    return success({ message: "已收藏" }, 201);
  } catch {
    return error("已经收藏过了", 409);
  }
}
