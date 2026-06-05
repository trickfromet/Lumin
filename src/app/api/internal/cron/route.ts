import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNickname } from "@/lib/nickname";
import { notifyCapsuleReady } from "@/lib/notifications";
import { success, error } from "@/lib/api-response";

// POST /api/internal/cron — 自动发布到期胶囊 + 清理过期封禁
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return error("未授权", 401);
  }

  const now = new Date();

  // 1. Auto-publish expired time capsules
  const expiredCapsules = await prisma.timeCapsule.findMany({
    where: {
      publishAt: { lte: now },
      isPublished: false,
      isRecalled: false,
    },
    include: {
      reservations: { select: { userId: true } },
    },
  });

  let publishedCount = 0;
  for (const capsule of expiredCapsules) {
    // Create a post from the capsule
    await prisma.post.create({
      data: {
        userId: capsule.userId,
        nickname: await getUserNickname(capsule.userId),
        content: capsule.content,
        imageUrl: capsule.imageUrl,
      },
    });

    // Mark as published
    await prisma.timeCapsule.update({
      where: { id: capsule.id },
      data: { isPublished: true },
    });

    // Notify all reservants
    for (const reservation of capsule.reservations) {
      await notifyCapsuleReady(reservation.userId, capsule.id);
    }

    publishedCount++;
  }

  // 2. Clear expired temporary bans
  const expiredBans = await prisma.user.updateMany({
    where: {
      isBanned: false,
      banExpiresAt: { lte: now },
    },
    data: { banExpiresAt: null },
  });

  return success({
    publishedCapsules: publishedCount,
    clearedBans: expiredBans.count,
  });
}

async function getUserNickname(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true },
  });
  return user?.nickname || generateNickname();
}
