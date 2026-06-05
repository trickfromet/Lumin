import { NextResponse } from "next/server";

export function success(
  data: unknown,
  status = 200,
  headers?: Record<string, string>
) {
  return NextResponse.json(data, { status, headers });
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
