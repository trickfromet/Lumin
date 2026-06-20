// Seed 40 categories + 80 posts (40 CN + 40 EN) to remote Turso DB
import "dotenv/config";

const ZH_ADJ = ["快乐的","孤独的","温柔的","迷糊的","机智的","懒洋洋的","勇敢的","害羞的","神秘的","呆萌的","忧郁的","认真的","天真的","佛系的","社恐的"];
const ZH_ANIMAL = ["柴犬","橘猫","兔子","仓鼠","柯基","熊猫","海豚","猫头鹰","刺猬","企鹅","树懒","水獭","松鼠","考拉","变色龙"];
const EN_ADJ = ["Happy","Lonely","Gentle","Sleepy","Witty","Shy","Brave","Cozy","Wild","Lucky","Funny","Dreamy","Sunny","Kind","Sweet"];
const EN_ANIMAL = ["Panda","Fox","Owl","Raccoon","Hedgehog","Dolphin","Penguin","Squirrel","Koala","Bunny","Wolf","Deer","Otter","Bear","Turtle"];
const rand = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const nickZh = () => rand(ZH_ADJ) + rand(ZH_ANIMAL);
const nickEn = () => rand(EN_ADJ) + rand(EN_ANIMAL);
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5);

async function main() {
  const { prisma } = await import("../lib/prisma");

  // 1. Wipe old warm posts (userId=null guest posts)
  const del = await prisma.post.deleteMany({ where: { userId: null } });
  console.log(`🗑 Deleted ${del.count} old guest posts`);

  // 2. Wipe old categories
  await prisma.postTag.deleteMany({});
  await prisma.category.deleteMany({});
  console.log("🗑 Wiped old categories");

  // 3. Load 40 categories
  const cats = (await import("../data/categories-40.json")).default as {
    name: string; description: string; icon: string; sortOrder: number;
  }[];
  for (const c of cats) {
    await prisma.category.create({ data: c });
  }
  // 4. Load posts
  const zhPosts = (await import("../data/warm-posts-40.json")).default as { category: string; content: string }[];
  const enPosts = (await import("../data/warm-posts-40-en.json")).default as { category: string; content: string }[];

  // Reload categories from DB
  const dbCats = await prisma.category.findMany({ select: { id: true, name: true } });
  const nameToId = new Map(dbCats.map((c) => [c.name, c.id]));

  let count = 0;
  for (const p of zhPosts) {
    const cid = nameToId.get(p.category);
    if (!cid) { console.warn(`⚠ ${p.category} not found`); continue; }
    await prisma.post.create({
      data: {
        userId: null, nickname: nickZh(), content: p.content,
        isEncrypted: false, language: "zh", categoryId: cid,
        isHidden: false, createdAt: daysAgo(count + 3),
        tags: { create: { tag: p.category } },
      },
    });
    count++;
  }
  for (const p of enPosts) {
    const cid = nameToId.get(p.category);
    if (!cid) { console.warn(`⚠ ${p.category} not found`); continue; }
    await prisma.post.create({
      data: {
        userId: null, nickname: nickEn(), content: p.content,
        isEncrypted: false, language: "en", categoryId: cid,
        isHidden: false, createdAt: daysAgo(count + 3),
        tags: { create: { tag: p.category } },
      },
    });
    count++;
  }

  console.log(`✅ Created ${cats.length} categories + ${count} posts`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
