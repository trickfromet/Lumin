import "dotenv/config";
import * as crypto from "crypto";

// Resolve the dev.db path relative to the project root.
if (!process.env.TURSO_DATABASE_URL) {
  process.env.TURSO_DATABASE_URL = "file:./treehole/prisma/dev.db";
}

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function main() {
  // Need to resolve @/ alias manually when running outside Next.js
  // We import prisma directly and set up the adapter inline
  const { PrismaClient } = await import("../generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL ?? "file:./prisma/dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const prisma = new PrismaClient({ adapter });

  const args = process.argv.slice(2);
  const countArg = args.find((a) => !a.startsWith("--"));
  const count = countArg ? parseInt(countArg, 10) : 10;
  const maxUsesArg = args.find((a) => a.startsWith("--max-uses="));
  const maxUses = maxUsesArg ? parseInt(maxUsesArg.split("=")[1], 10) : 1;

  // Check existing total
  const existingCount = await prisma.inviteCode.count();
  const totalAfter = existingCount + count;

  if (totalAfter > 3000) {
    console.error(
      `Cannot create ${count} codes: would exceed 3000 limit (currently ${existingCount}, would be ${totalAfter})`
    );
    process.exit(1);
  }

  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = generateCode();
    const codeHash = await hashCode(raw);
    await prisma.inviteCode.create({
      data: {
        codeHash,
        maxUses,
      },
    });
    codes.push(raw);
  }

  console.log(`Created ${count} invite codes (max ${maxUses} use(s) each):`);
  console.log("");
  codes.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c}`);
  });
  console.log("");
  console.log(`Total codes in DB: ${existingCount + count} / 3000`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
