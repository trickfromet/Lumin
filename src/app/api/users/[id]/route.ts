export const runtime = "edge";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWesternZodiac } from "@/lib/zodiac";
import { success, error } from "@/lib/api-response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  if (isNaN(userId)) {
    return error("无效的用户 ID");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      backgroundUrl: true,
      bio: true,
      status: true,
      birthday: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
        },
      },
    },
  });

  if (!user) {
    return error("用户不存在", 404);
  }

  return success({
    user: {
      ...user,
      zodiac: user.birthday ? getWesternZodiac(user.birthday) : null,
      birthday: undefined, // Don't expose exact birthday
    },
  });
}
