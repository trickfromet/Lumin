import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNickname } from "@/lib/nickname";
import { notifyCapsuleReady } from "@/lib/notifications";
import { success, error } from "@/lib/api-response";

async function getUserNickname(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true },
  });
  return user?.nickname || generateNickname();
}

async function runCronLogic() {
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
        user: { connect: { id: capsule.userId } },
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

  return {
    publishedCapsules: publishedCount,
    clearedBans: expiredBans.count,
  };
}

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return error("未授权", 401);
  }
  const result = await runCronLogic();
  return success(result);
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return error("未授权", 401);
  }
  const result = await runCronLogic();
  return success(result);
}
