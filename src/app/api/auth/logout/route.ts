export const runtime = "edge";
import { success } from "@/lib/api-response";
import { clearTokenCookie } from "@/lib/auth";

export async function POST() {
  return success({ message: "已退出登录" }, 200, clearTokenCookie());
}
