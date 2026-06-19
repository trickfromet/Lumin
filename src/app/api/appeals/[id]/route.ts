// export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { notifyAppealResult } from "@/lib/notifications";
import { success, error, unauthorized, forbidden } from "@/lib/api-response";

// PATCH /api/appeals/[id] — 管理员审核申诉
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

  if (user.role !== "admin") {
    return forbidden("仅管理员可审核申诉");
  }

  const { id } = await params;
  const appealId = Number(id);

  if (isNaN(appealId)) {
    return error("无效的申诉 ID");
  }

  const appeal = await prisma.appeal.findUnique({
    where: { id: appealId },
    include: { user: true },
  });

  if (!appeal) {
    return error("申诉不存在", 404);
  }

  if (appeal.status !== "pending") {
    return error("该申诉已经处理过了");
  }

  const body = await request.json();
  const { action, adminNote } = body; // action: "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return error("无效的操作");
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  await prisma.appeal.update({
    where: { id: appealId },
    data: { status: newStatus, adminNote, reviewedAt: new Date() },
  });

  if (action === "approve") {
    // Unban the user
    await prisma.user.update({
      where: { id: appeal.userId },
      data: {
        isBanned: false,
        banExpiresAt: null,
        banCount: Math.max(0, appeal.user.banCount - 1),
      },
    });
    await notifyAppealResult(
      appeal.userId,
      appealId,
      "你的申诉已通过，账号已解封"
    );
  } else {
    await notifyAppealResult(
      appeal.userId,
      appealId,
      `申诉未通过${adminNote ? `：${adminNote}` : ""}`
    );
  }

  return success({ message: "申诉已处理" });
}
