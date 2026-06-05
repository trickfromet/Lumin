import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/posts/[id]/like — 点赞（IP 去重）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return NextResponse.json({ error: "无效的帖子 ID" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const existing = await prisma.like.findUnique({
    where: { ip_postId: { ip, postId } },
  });

  if (existing) {
    return NextResponse.json({ error: "你已经点赞过了" }, { status: 409 });
  }

  await prisma.like.create({ data: { ip, postId } });

  const count = await prisma.like.count({ where: { postId } });
  return NextResponse.json({ liked: true, count });
}
