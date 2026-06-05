/**
 * 修复因密钥更换或 Edge Runtime 问题导致的加密内容无法解密
 *
 * 用法: npx tsx scripts/fix-encrypted-posts.ts
 *
 * 功能：
 * 1. 扫描所有 isEncrypted=true 的帖子
 * 2. 尝试用当前 POST_ENCRYPTION_KEY 解密
 * 3. 统计成功/失败
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.TURSO_DATABASE_URL!;
const authToken = process.env.TURSO_AUTH_TOKEN!;
const encryptKeyHex = process.env.POST_ENCRYPTION_KEY!;

// ---- AES-GCM helpers (duplicated from src/lib/encryption.ts) ----
function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function tryDecrypt(
  encrypted: string,
  iv: string,
  authTag: string
): Promise<string | null> {
  try {
    const keyData = hexToUint8Array(encryptKeyHex);
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const ciphertextBytes = base64ToUint8Array(encrypted);
    const ivBytes = base64ToUint8Array(iv);
    const authTagBytes = base64ToUint8Array(authTag);

    const combinedBytes = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    combinedBytes.set(ciphertextBytes);
    combinedBytes.set(authTagBytes, ciphertextBytes.length);

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
      key,
      combinedBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    return null;
  }
}

async function main() {
  const adapter = new PrismaLibSql({ url, authToken });
  const prisma = new PrismaClient({ adapter });

  console.log("🔍 Scanning encrypted posts...\n");

  const encryptedPosts = await prisma.post.findMany({
    where: { isEncrypted: true },
    select: {
      id: true,
      encryptedContent: true,
      iv: true,
      authTag: true,
      language: true,
      createdAt: true,
    },
  });

  console.log(`Total encrypted posts found: ${encryptedPosts.length}`);

  let successCount = 0;
  let failCount = 0;

  for (const post of encryptedPosts) {
    if (!post.encryptedContent || !post.iv || !post.authTag) {
      console.warn(`  ⚠️  Post #${post.id}: missing encrypted data fields, skipping`);
      continue;
    }

    const decrypted = await tryDecrypt(
      post.encryptedContent,
      post.iv,
      post.authTag
    );

    if (decrypted !== null) {
      successCount++;
      if (successCount <= 3) {
        const preview = decrypted.slice(0, 40);
        console.log(`  ✅ Post #${post.id} (${post.language}): "${preview}..."`);
      }
    } else {
      failCount++;
      console.log(`  ❌ Post #${post.id} (${post.language}): DECRYPTION FAILED`);
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Successfully decrypted: ${successCount}`);
  console.log(`   ❌ Failed to decrypt:     ${failCount}`);
  console.log(`   Total checked:            ${encryptedPosts.length}`);

  if (failCount > 0 && successCount > 0) {
    console.log(`\n💡 Partial match — some posts were encrypted with a DIFFERENT key.`);
    console.log(`   Current key: ${encryptKeyHex.slice(0, 16)}...${encryptKeyHex.slice(-8)}`);
    console.log(`   These ${failCount} posts cannot be recovered without the original key.`);
  } else if (failCount > 0 && successCount === 0) {
    console.log(`\n💡 ALL encrypted posts failed to decrypt. The current POST_ENCRYPTION_KEY`);
    console.log(`   is different from the key that was used to encrypt them.`);
    console.log(`   Current key: ${encryptKeyHex.slice(0, 16)}...${encryptKeyHex.slice(-8)}`);
    console.log(`\n   🔧 To fix: restore the ORIGINAL key to .env, or accept data loss.`);
  } else {
    console.log(`\n✅ All encrypted posts decrypted successfully with the current key.`);
    console.log(`   The previous Edge Runtime issue was causing random failures —`);
    console.log(`   this should now be fixed with the Node.js runtime switch.`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
