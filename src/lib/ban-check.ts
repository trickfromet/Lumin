import { prisma } from "./prisma";
import type { User } from "@/generated/prisma/client";

export interface BanStatus {
  banned: boolean;
  reason?: string;
}

export async function checkBanStatus(user: User): Promise<BanStatus> {
  // Permanent ban
  if (user.isBanned) {
    return { banned: true, reason: "账号已被永久封禁" };
  }

  // Temporary ban - check expiry
  if (user.banExpiresAt && user.banExpiresAt > new Date()) {
    const remaining = Math.ceil(
      (user.banExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return { banned: true, reason: `账号已被封禁，剩余 ${remaining} 小时` };
  }

  // Temporary ban expired - auto-clear
  if (user.banExpiresAt && user.banExpiresAt <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { banExpiresAt: null },
    });
  }

  return { banned: false };
}
