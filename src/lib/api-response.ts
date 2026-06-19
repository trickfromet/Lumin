import { NextResponse } from "next/server";

export function success(
  data: any,
  status = 200,
  headers?: Record<string, string>
) {
  const payload = {
    success: true,
    data,
    ...(typeof data === "object" && data !== null ? data : {})
  };
  return NextResponse.json(payload, { status, headers });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized(message = "请先登录") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "没有权限") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "资源不存在") {
  return NextResponse.json({ error: message }, { status: 404 });
}
