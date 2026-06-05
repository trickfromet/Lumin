export const runtime = "edge";
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  const jwt = process.env.JWT_SECRET;
  const encryptKey = process.env.POST_ENCRYPTION_KEY;

  return new Response(JSON.stringify({
    env: {
      TURSO_DATABASE_URL: url 
        ? `${url.substring(0, 15)}... (length: ${url.length})` 
        : "undefined",
      TURSO_AUTH_TOKEN: token 
        ? `${token.substring(0, 10)}...${token.substring(token.length - 10)} (length: ${token.length})` 
        : "undefined",
      JWT_SECRET: jwt 
        ? `defined (length: ${jwt.length})` 
        : "undefined",
      POST_ENCRYPTION_KEY: encryptKey 
        ? `defined (length: ${encryptKey.length})` 
        : "undefined",
    },
    nodeEnv: process.env.NODE_ENV,
    nextRuntime: process.env.NEXT_RUNTIME || "unknown",
  }), {
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
