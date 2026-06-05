export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { notifyReservation } from "@/lib/notifications";
import { success, error, unauthorized } from "@/lib/api-response";

// POST /api/capsules/[id]/reserve — 预约时光胶囊
export async function POST(
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

  if (capsule.userId === user.id) {
    return error("不能预约自己的时光胶囊");
  }

  if (capsule.isPublished || capsule.isRecalled) {
    return error("该时光胶囊已过期或已撤回");
  }

  try {
    await prisma.reservation.create({
      data: { userId: user.id, timeCapsuleId: capsuleId },
    });

    // Notify capsule author
    await notifyReservation(capsule.userId, capsuleId);

    return success({ message: "预约成功" });
  } catch {
    return error("你已经预约过了", 409);
  }
}

// DELETE /api/capsules/[id]/reserve — 取消预约
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

  await prisma.reservation.deleteMany({
    where: { userId: user.id, timeCapsuleId: capsuleId },
  });

  return success({ message: "已取消预约" });
}
