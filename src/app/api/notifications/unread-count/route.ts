import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const count = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return success({ count });
}
