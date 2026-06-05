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

  const adapter = new PrismaLibSql({ url, authToken });
  const client = new PrismaClient({ adapter });

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

