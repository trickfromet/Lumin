// export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { success, error, unauthorized } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) return unauthorized(e.message);
    throw e;
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return error("请选择文件");
  }

  try {
    const result = await saveUpload(file, "uploads/images");
    return success({ url: result.url });
  } catch (e) {
    return error((e as Error).message);
  }
}
