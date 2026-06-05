import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getWesternZodiac } from "@/lib/zodiac";
import { performModeration } from "@/lib/moderation";
import { success, error, unauthorized } from "@/lib/api-response";
import { AuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      _count: {
        select: {
          posts: true,
          comments: true,
          metoos: true,
          collections: true,
        },
      },
    },
  });

  return success({
    user: {
      ...fullUser,
      passwordHash: undefined,
      zodiac: fullUser?.birthday ? getWesternZodiac(fullUser.birthday) : null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const body = await request.json();
  const { nickname, bio, birthday, status, backgroundUrl } = body;

  // Moderation for nickname and bio
  let combinedContent = "";
  if (nickname) combinedContent += nickname + " ";
  if (bio) combinedContent += bio;

  if (combinedContent.trim()) {
    const moderation = await performModeration(user.id, combinedContent.trim());
    if (!moderation.passed) {
      return error(moderation.message || "内容包含违规信息", 422);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (nickname !== undefined) {
    if (
      typeof nickname !== "string" ||
      nickname.length < 2 ||
      nickname.length > 20
    ) {
      return error("昵称长度需要在 2-20 个字符之间");
    }
    updateData.nickname = nickname;
  }

  if (bio !== undefined) {
    if (typeof bio === "string" && bio.length > 200) {
      return error("简介不能超过 200 个字符");
    }
    updateData.bio = bio;
  }

  if (birthday !== undefined) {
    updateData.birthday = birthday ? new Date(birthday) : null;
  }

  if (status !== undefined) {
    if (!["online", "hidden"].includes(status)) {
      return error("状态值无效");
    }
    updateData.status = status;
  }

  if (backgroundUrl !== undefined) {
    updateData.backgroundUrl = backgroundUrl || null;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  return success({
    user: {
      id: updated.id,
      nickname: updated.nickname,
      bio: updated.bio,
      birthday: updated.birthday,
      status: updated.status,
    },
  });
}

export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  // Prisma cascade deletes handle related records
  await prisma.user.delete({ where: { id: user.id } });

  return success({ message: "账号已注销" }, 200, {
    "Set-Cookie": "th_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
  });
}
