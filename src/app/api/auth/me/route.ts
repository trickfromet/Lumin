// export const runtime = "edge";
import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest();

  if (!user) {
    if (!request.cookies.has("th_token")) {
      return success({ user: null });
    }
    return unauthorized();
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
