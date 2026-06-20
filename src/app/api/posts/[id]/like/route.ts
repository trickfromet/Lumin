// export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/posts/[id]/like — batch insert + count in one roundtrip
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

  // INSERT OR IGNORE via raw SQL — single operation, no duplicate check needed
  await prisma.$executeRaw`INSERT OR IGNORE INTO "Like" (ip, postId) VALUES (${ip}, ${postId})`;

  const [row] = await prisma.$queryRaw<[{ cnt: number }]>`SELECT COUNT(*) as cnt FROM "Like" WHERE postId = ${postId}`;
  return NextResponse.json({ liked: true, count: row.cnt });
}
