import "dotenv/config";

// For local seeding, use local SQLite; on Vercel/Turso the env var is already set.
if (!process.env.TURSO_DATABASE_URL) {
  process.env.TURSO_DATABASE_URL = "file:./dev.db";
}

// Parse CLI args: --language zh|en (default: seed all)
const args = process.argv.slice(2);
const langIndex = args.indexOf("--language");
const TARGET_LANG: string | null =
  langIndex !== -1 && args[langIndex + 1]
    ? args[langIndex + 1]
    : null;

const ZH_NICKNAMES = {
  adjectives: [
    "快乐的", "孤独的", "温柔的", "暴躁的", "迷糊的",
    "机智的", "懒洋洋的", "勇敢的", "害羞的", "神秘的",
    "呆萌的", "高冷的", "话痨的", "佛系的", "社恐的",
    "元气满满的", "忧郁的", "搞笑的", "认真的", "天真的",
  ],
  animals: [
    "柴犬", "橘猫", "兔子", "仓鼠", "柯基",
    "熊猫", "海豚", "猫头鹰", "刺猬", "企鹅",
    "树懒", "水獭", "龙猫", "鹦鹉",
    "小鹿", "松鼠", "海豹", "考拉", "变色龙",
  ],
};

const EN_NICKNAMES = {
  adjectives: [
    "Happy", "Lonely", "Gentle", "Quiet", "Sleepy",
    "Witty", "Shy", "Brave", "Cozy", "Wild",
    "Lucky", "Funny", "Dreamy", "Sunny", "Fancy",
    "Cool", "Kind", "Bright", "Sweet", "Silly",
  ],
  animals: [
    "Panda", "Fox", "Owl", "Raccoon", "Hedgehog",
    "Dolphin", "Penguin", "Squirrel", "Koala", "Bunny",
    "Wolf", "Deer", "Otter", "Bear", "Turtle",
    "Robin", "Bee", "Moose", "Puffin", "Corgi",
  ],
};

function generateZhNickname(): string {
  const adj =
    ZH_NICKNAMES.adjectives[
      Math.floor(Math.random() * ZH_NICKNAMES.adjectives.length)
    ];
  const animal =
    ZH_NICKNAMES.animals[
      Math.floor(Math.random() * ZH_NICKNAMES.animals.length)
    ];
  return adj + animal;
}

function generateEnNickname(): string {
  const adj =
    EN_NICKNAMES.adjectives[
      Math.floor(Math.random() * EN_NICKNAMES.adjectives.length)
    ];
  const animal =
    EN_NICKNAMES.animals[
      Math.floor(Math.random() * EN_NICKNAMES.animals.length)
    ];
  return adj + animal;
}

function randomDate(startDaysAgo: number, endDaysAgo: number): Date {
  const now = Date.now();
  const rangeStart = now - endDaysAgo * 24 * 60 * 60 * 1000;
  const rangeEnd = now - startDaysAgo * 24 * 60 * 60 * 1000;
  return new Date(rangeStart + Math.random() * (rangeEnd - rangeStart));
}

async function main() {
  // Determine which data files to load based on TARGET_LANG
  const loadZH = !TARGET_LANG || TARGET_LANG === "zh";
  const loadEN = !TARGET_LANG || TARGET_LANG === "en";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imports: Promise<any>[] = [import("../lib/prisma")];
  if (loadZH) imports.push(import("../data/warm-posts.json"));
  if (loadEN) imports.push(import("../data/warm-posts-en.json"));

  const results = await Promise.all(imports);
  const { prisma } = results[0] as { prisma: typeof import("../lib/prisma").prisma };
  const zhPosts: { content: string; categoryName: string }[] | undefined =
    loadZH ? (results[1] as { default: typeof import("../data/warm-posts.json") }).default : undefined;
  const enPosts: { content: string; categoryName: string }[] | undefined =
    loadEN
      ? (loadZH ? (results[2] as { default: typeof import("../data/warm-posts-en.json") }).default : (results[1] as { default: typeof import("../data/warm-posts-en.json") }).default)
      : undefined;

  // Load all categories to map names to IDs
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c: { id: number; name: string }) => [c.name, c.id]));

  // Delete existing warm posts — scope to target language if specified
  const deleteWhere: Record<string, unknown> = { userId: null };
  if (TARGET_LANG === "zh") deleteWhere.language = "zh";
  if (TARGET_LANG === "en") deleteWhere.language = "en";
  const deleted = await prisma.post.deleteMany({ where: deleteWhere });
  console.log(
    `🗑️  Deleted ${deleted.count} old warm posts${
      TARGET_LANG ? ` (${TARGET_LANG})` : ""
    }`,
  );

  let inserted = 0;
  let skipped = 0;

  // Seed Chinese posts
  if (zhPosts) {
    for (const post of zhPosts) {
      const categoryId = categoryMap.get(post.categoryName);
      if (!categoryId) {
        console.warn(`⚠️  Unknown category: "${post.categoryName}" — skipping`);
        skipped++;
        continue;
      }

      await prisma.post.create({
        data: {
          userId: null,
          nickname: generateZhNickname(),
          content: post.content,
          isEncrypted: false,
          language: "zh",
          categoryId,
          isHidden: false,
          createdAt: randomDate(1, 90),
          tags: {
            create: { tag: post.categoryName },
          },
        },
      });
      inserted++;
    }
  }

  // Seed English posts
  if (enPosts) {
    for (const post of enPosts) {
      const categoryId = categoryMap.get(post.categoryName);
      if (!categoryId) {
        console.warn(`⚠️  Unknown category: "${post.categoryName}" — skipping`);
        skipped++;
        continue;
      }

      await prisma.post.create({
        data: {
          userId: null,
          nickname: generateEnNickname(),
          content: post.content,
          isEncrypted: false,
          language: "en",
          categoryId,
          isHidden: false,
          createdAt: randomDate(1, 90),
          tags: {
            create: { tag: post.categoryName },
          },
        },
      });
      inserted++;
    }
  }

  console.log(`✅ Warm posts seeded: ${inserted} inserted, ${skipped} skipped`);
  await prisma.$disconnect();
}

main().catch(console.error);
