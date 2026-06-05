export const runtime = "edge";
import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { success } from "@/lib/api-response";

export async function GET(_request: NextRequest) {
  const user = await getUserFromRequest();

  if (!user) {
    return success({ user: null });
  }

  return success({
    user: {
      id: user.id,
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      backgroundUrl: user.backgroundUrl,
      bio: user.bio,
      birthday: user.birthday,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
}
