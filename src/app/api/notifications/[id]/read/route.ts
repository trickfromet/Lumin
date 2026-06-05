export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { success, error, unauthorized } from "@/lib/api-response";

export async function PATCH(
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
  const notificationId = Number(id);

  if (isNaN(notificationId)) {
    return error("无效的通知 ID");
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== user.id) {
    return error("通知不存在", 404);
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return success({ message: "已标记为已读" });
}
