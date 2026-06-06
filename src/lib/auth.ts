import { SignJWT, jwtVerify, type JWTPayload } from "jose";
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

/** 用 Web Crypto PBKDF2 替代 bcryptjs，兼容 Edge Runtime */
export async function hashPassword(password: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const saltB64 = btoa(Array.from(salt, (b) => String.fromCharCode(b)).join(""));
  const hashB64 = btoa(Array.from(new Uint8Array(derived), (b) => String.fromCharCode(b)).join(""));
  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  // 兼容旧版 bcrypt 哈希（$2a$ / $2b$）—— 静态导入会触发 Edge Runtime 报错
  if (stored.startsWith("$2")) {
    return false; // 旧哈希不支持 Edge Runtime，用户需重置密码
  }
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = new Uint8Array(Array.from(atob(saltB64), (c) => c.charCodeAt(0)));
  const expectedHash = new Uint8Array(Array.from(atob(hashB64), (c) => c.charCodeAt(0)));

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const actualHash = new Uint8Array(derived);
  if (actualHash.length !== expectedHash.length) return false;
  return actualHash.every((b, i) => b === expectedHash[i]);
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
