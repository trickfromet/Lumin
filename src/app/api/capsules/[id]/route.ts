// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { success, error, unauthorized } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { id } = await params;
  const capsuleId = Number(id);

  if (isNaN(capsuleId)) {
    return error("无效的胶囊 ID");
  }

  const capsule = await prisma.timeCapsule.findUnique({
    where: { id: capsuleId },
    include: {
      _count: { select: { reservations: true } },
      reservations: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });

  if (!capsule) {
    return error("时光胶囊不存在", 404);
  }

  const isOwner = capsule.userId === user.id;
  const isPublished = capsule.isPublished;
  const isRecalled = capsule.isRecalled;

  // Non-owner can only see published capsules or reservation status
  if (!isOwner && !isPublished && !isRecalled) {
    return success({
      capsule: {
        id: capsule.id,
        publishAt: capsule.publishAt,
        isPublished: false,
        isRecalled: false,
        reservationCount: capsule._count.reservations,
        userHasReserved: capsule.reservations.length > 0,
        countdown: formatCountdown(capsule.publishAt.getTime() - Date.now()),
      },
    });
  }

  return success({
    capsule: {
      id: capsule.id,
      content: capsule.content,
      imageUrl: capsule.imageUrl,
      publishAt: capsule.publishAt,
      isPublished,
      isRecalled,
      reservationCount: capsule._count.reservations,
      userHasReserved: capsule.reservations.length > 0,
      createdAt: capsule.createdAt,
    },
  });
}

// DELETE /api/capsules/[id] — 撤回时光胶囊
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const { id } = await params;
  const capsuleId = Number(id);

  if (isNaN(capsuleId)) {
    return error("无效的胶囊 ID");
  }

  const capsule = await prisma.timeCapsule.findUnique({
    where: { id: capsuleId },
  });

  if (!capsule) {
    return error("时光胶囊不存在", 404);
  }

  if (capsule.userId !== user.id) {
    return error("只能撤回自己的时光胶囊", 403);
  }

  if (capsule.isPublished) {
    return error("已发布的时光胶囊无法撤回");
  }

  if (capsule.isRecalled) {
    return error("该时光胶囊已经被撤回");
  }

  await prisma.timeCapsule.update({
    where: { id: capsuleId },
    data: { isRecalled: true },
  });

  return success({ message: "时光胶囊已撤回" });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "已到期";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}秒`);
  return parts.join("") || "即将到期";
}
