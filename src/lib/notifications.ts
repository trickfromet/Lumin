import { prisma } from "./prisma";

type NotificationType =
  | "metoo"
  | "capsule_ready"
  | "reservation"
  | "report_result"
  | "ban"
  | "warning"
  | "appeal_result";

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  content?: string,
  relatedId?: number,
  relatedType?: string,
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      content,
      relatedId,
      relatedType,
    },
  });
}

export async function notifyMeToo(postAuthorId: number, postId: number) {
  return createNotification(
    postAuthorId,
    "metoo",
    "有人和你感同身受",
    "你的帖子收到了一个「我也是」",
    postId,
    "post",
  );
}

export async function notifyWarning(userId: number, reason: string) {
  return createNotification(
    userId,
    "warning",
    "违规警告通知",
    `由于您的内容包含「${reason}」等违规信息，系统已对您发出警告。第二次违规将直接封禁账号。`,
  );
}

export async function notifyCapsuleReady(userId: number, capsuleId: number) {
  return createNotification(
    userId,
    "capsule_ready",
    "时光胶囊已到期",
    "你发布的时光胶囊已经到期，去看看吧",
    capsuleId,
    "timeCapsule",
  );
}

export async function notifyReservation(
  capsuleAuthorId: number,
  capsuleId: number,
) {
  return createNotification(
    capsuleAuthorId,
    "reservation",
    "有人预约了你的时光胶囊",
    "有人期待看到你的时光胶囊",
    capsuleId,
    "timeCapsule",
  );
}

export async function notifyReportResult(
  userId: number,
  reportId: number,
  result: string,
) {
  return createNotification(
    userId,
    "report_result",
    "举报处理结果",
    result,
    reportId,
    "report",
  );
}

export async function notifyBan(userId: number, reason: string) {
  return createNotification(userId, "ban", "账号封禁通知", reason);
}

export async function notifyAppealResult(
  userId: number,
  appealId: number,
  result: string,
) {
  return createNotification(
    userId,
    "appeal_result",
    "申诉处理结果",
    result,
    appealId,
    "appeal",
  );
}
