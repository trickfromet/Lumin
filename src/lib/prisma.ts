import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Function to lazily create the Prisma client instance
function getPrismaInstance(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const url = process.env.TURSO_DATABASE_URL ?? "file:./prisma/dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  let client: PrismaClient;
  if (url.startsWith("file:")) {
    // Local SQLite database files require native filesystem bindings which are not supported in Edge runtimes.
    const isEdge = typeof (globalThis as any).EdgeRuntime === "string" || process.env.NEXT_RUNTIME === "edge";
    if (isEdge) {
      throw new Error(
        `[Prisma Configuration Error] Local SQLite file database ("${url}") is not supported under the Next.js Edge Runtime. ` +
        `Please comment out/remove the Edge runtime configuration (e.g. "export const runtime = 'edge';") from layout.tsx or this route, ` +
        `or configure a remote Turso database URL (e.g. "libsql://...") to run on Edge.`
      );
    }
    client = new PrismaClient({
      datasources: {
        db: { url }
      }
    });
  } else {
    const adapter = new PrismaLibSql({ url, authToken });
    client = new PrismaClient({ adapter });
  }

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

// Export a Proxy that behaves exactly like PrismaClient,
// but defers initialization until the first method/property is accessed.
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const instance = getPrismaInstance();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

