// Edge Runtime polyfill (setImmediate for bcryptjs) — MUST be before bcryptjs
import "./polyfills";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "treehole-jwt-secret-key-2026-very-long-and-secure",
);
const COOKIE_NAME = "th_token";
const TOKEN_EXPIRY = "7d";

export interface TokenPayload extends JWTPayload {
  userId: number;
}

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function getUserFromRequest() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) return null;

  // Auto-expire temporary bans
  if (!user.isBanned && user.banExpiresAt && user.banExpiresAt <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { banExpiresAt: null },
    });
  }

  return user;
}

export async function requireAuth(_request?: Request) {
  const user = await getUserFromRequest();
  if (!user) {
    throw new AuthError("请先登录", 401);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 6) {
    return { valid: false, error: "密码至少需要6个字符" };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "密码必须包含至少一个字母" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "密码必须包含至少一个数字" };
  }
  return { valid: true };
}

export function setTokenCookie(token: string) {
  return {
    "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
  };
}

export function clearTokenCookie() {
  return {
    "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  };
}

export async function hashInviteCode(code: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(code.toUpperCase().trim());
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function generateInviteCode(): Promise<{ raw: string; hash: string }> {
  const raw = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const hash = await hashInviteCode(raw);
  return { raw, hash };
}

export function getIpFromRequest(
  request: Request | { headers: { get: (name: string) => string | null } },
): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}
