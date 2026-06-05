export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { notifyReportResult, notifyBan } from "@/lib/notifications";
import { success, error, unauthorized, forbidden } from "@/lib/api-response";

// PATCH /api/reports/[id] — 管理员审核举报
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
    return forbidden("仅管理员可审核举报");
  }

  const { id } = await params;
  const reportId = Number(id);

  if (isNaN(reportId)) {
    return error("无效的举报 ID");
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { reportedUser: true },
  });

  if (!report) {
    return error("举报不存在", 404);
  }

  if (report.status !== "pending") {
    return error("该举报已经处理过了");
  }

  const body = await request.json();
  const { action } = body; // action: "uphold" | "dismiss"

  if (!["uphold", "dismiss"].includes(action)) {
    return error("无效的操作");
  }

  const newStatus = action === "uphold" ? "reviewed" : "dismissed";

  await prisma.report.update({
    where: { id: reportId },
    data: { status: newStatus, reviewedAt: new Date() },
  });

  if (action === "uphold" && report.reportedUser) {
    const reportedUser = report.reportedUser;
    const banCount = reportedUser.banCount;

    // Apply ban gradient
    if (banCount === 0) {
      // First offense: warning + hide content
      if (report.postId) {
        await prisma.post.update({
          where: { id: report.postId },
          data: { isHidden: true },
        });
      }
      await prisma.user.update({
        where: { id: reportedUser.id },
        data: { banCount: 1 },
      });
      await notifyBan(reportedUser.id, "你的内容已被处理，请遵守社区规范");
      await notifyReportResult(report.reporterId, reportId, "举报已处理，感谢你的反馈");
    } else if (banCount === 1) {
      // Second offense: 24-hour mute
      const banExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: reportedUser.id },
        data: { banCount: 2, banExpiresAt: banExpires },
      });
      if (report.postId) {
        await prisma.post.update({
          where: { id: report.postId },
          data: { isHidden: true },
        });
      }
      await notifyBan(reportedUser.id, "你的账号已被禁言 24 小时");
      await notifyReportResult(report.reporterId, reportId, "举报已处理，该用户已被禁言 24 小时");
    } else {
      // Third+ offense: permanent ban
      await prisma.user.update({
        where: { id: reportedUser.id },
        data: { isBanned: true, banCount: banCount + 1 },
      });
      if (report.postId) {
        await prisma.post.update({
          where: { id: report.postId },
          data: { isHidden: true },
        });
      }
      await notifyBan(reportedUser.id, "你的账号已被永久封禁");
      await notifyReportResult(report.reporterId, reportId, "举报已处理，该用户已被永久封禁");
    }
  } else if (action === "dismiss") {
    await notifyReportResult(report.reporterId, reportId, "举报已审核，未发现违规");
  }

  return success({ message: "举报已处理" });
}
