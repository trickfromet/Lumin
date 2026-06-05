/**
 * 删除无法解密的历史帖子（密钥更换导致原文不可恢复）
 *
 * 用法: npx tsx scripts/delete-unrecoverable-posts.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.TURSO_DATABASE_URL!;
const authToken = process.env.TURSO_AUTH_TOKEN!;

const POST_IDS_TO_DELETE = [6, 7, 8, 9, 10, 11, 4026];

async function main() {
  const adapter = new PrismaLibSql({ url, authToken });
  const prisma = new PrismaClient({ adapter });

  console.log(`🗑️  Deleting ${POST_IDS_TO_DELETE.length} unrecoverable posts...`);

  for (const id of POST_IDS_TO_DELETE) {
    // Delete related records first (PostTag, etc.)
    await prisma.postTag.deleteMany({ where: { postId: id } });
    const result = await prisma.post.delete({ where: { id } });
    console.log(`   ✅ Post #${id} deleted (language: ${result.language}, created: ${result.createdAt.toISOString().slice(0, 10)})`);
  }

  console.log(`\n✅ Done. All ${POST_IDS_TO_DELETE.length} posts removed.`);

  // Verify
  const remaining = await prisma.post.findMany({ where: { isEncrypted: true } });
  console.log(`Remaining encrypted posts: ${remaining.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
