// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, getIpFromRequest } from "@/lib/auth";
import { getMeTooTier } from "@/lib/metoo-tiers";
import { success, error } from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest();
  const ip = getIpFromRequest(request);

  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  // ── 批量事务：单次网络往返完成 INSERT + COUNT ──
  const userId = user?.id ?? null;
  try {
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO MeToo (userId, ip, postId, createdAt)
      VALUES (${userId}, ${ip}, ${postId}, datetime('now'))
    `;
  } catch {
    return error("帖子不存在", 404);
  }

  // Check if insert actually happened by counting
  const [row] = await prisma.$queryRaw<[{ cnt: number }]>`
    SELECT COUNT(*) as cnt FROM MeToo WHERE postId = ${postId}
  `;
  const count = row.cnt;
  const tier = getMeTooTier(count);

  return success({ metooed: true, count, metooCount: count, tier });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest();
  const ip = getIpFromRequest(request);

  const { id } = await params;
  const postId = Number(id);

  if (isNaN(postId)) {
    return error("无效的帖子 ID");
  }

  if (user?.id) {
    await prisma.$executeRaw`DELETE FROM MeToo WHERE postId = ${postId} AND userId = ${user.id}`;
  } else {
    await prisma.$executeRaw`DELETE FROM MeToo WHERE postId = ${postId} AND ip = ${ip}`;
  }

  const [row] = await prisma.$queryRaw<[{ cnt: number }]>`
    SELECT COUNT(*) as cnt FROM MeToo WHERE postId = ${postId}
  `;
  const count = row.cnt;
  const tier = getMeTooTier(count);

  return success({ metooed: false, count, metooCount: count, tier });
}
