import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import zhPosts from "../data/warm-posts.json";
import enPosts from "../data/warm-posts-en.json";

const url = "libsql://treehole-trickfromet.aws-ap-northeast-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzg5MTI4NjcsImlkIjoiMDE5ZTFlYmEtYWYwMS03YTZiLTg2NzctYjY3YzljZDliOGE2IiwicmlkIjoiNzY5ODQyZjYtYWE0ZS00NTZkLThhOTktNmZjMDk2MmJhZWI3In0.ouJjpUdXx1xDISb8ZR-Yemzo3euJA28sd8Rk5JloCYq_GBSyXZNiOoV-_NwjUD5OXi6-HhKEfg2NxVrK3lVgCw";

const ZH_NICKNAMES = [
  "快乐的柴犬", "温柔的橘猫", "机智的仓鼠", "勇敢的柯基", "神秘的熊猫",
  "佛系的企鹅", "社恐的树懒", "可爱的海豚", "呆萌的刺猬", "忧郁的龙猫"
];

const EN_NICKNAMES = [
  "HappyPanda", "GentleFox", "SleepyOwl", "BraveCorgi", "DreamyBunny",
  "LuckySquirrel", "FancyOtter", "SunnyDeer", "KindKoala", "SillyRobin"
];

function randomDate(startDaysAgo: number, endDaysAgo: number): Date {
  const now = Date.now();
  const rangeStart = now - endDaysAgo * 24 * 60 * 60 * 1000;
  const rangeEnd = now - startDaysAgo * 24 * 60 * 60 * 1000;
  return new Date(rangeStart + Math.random() * (rangeEnd - rangeStart));
}

interface PostInput {
  content: string;
  categoryName: string;
}

interface DistributedPost extends PostInput {
  targetCategoryName: string;
}

function distributePosts(posts: PostInput[]): DistributedPost[] {
  // Sort posts by content length
  const sorted = [...posts].sort((a, b) => a.content.length - b.content.length);

  // Shortest 20 go to "碎语"
  const shortGroup = sorted.slice(0, 20).map(p => ({ ...p, targetCategoryName: "碎语" }));

  // Longest 20 go to "长卷"
  const longGroup = sorted.slice(sorted.length - 20).map(p => ({ ...p, targetCategoryName: "长卷" }));

  // Remaining
  const remaining = sorted.slice(20, sorted.length - 20);

  // Shuffle remaining and pick 20 for "拾遗"
  const shuffled = remaining.sort(() => Math.random() - 0.5);
  const gleanGroup = shuffled.slice(0, 20).map(p => ({ ...p, targetCategoryName: "拾遗" }));

  // Rest keep their original categoryName
  const restGroup = shuffled.slice(20).map(p => ({ ...p, targetCategoryName: p.categoryName }));

  return [...shortGroup, ...longGroup, ...gleanGroup, ...restGroup];
}

async function main() {
  const adapter = new PrismaLibSql({ url, authToken });
  const prisma = new PrismaClient({ adapter });

  // Map category names to IDs
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map(c => [c.name, c.id]));

  // Delete all existing warm posts (userId = null)
  const deleted = await prisma.post.deleteMany({
    where: { userId: null }
  });
  console.log(`Deleted ${deleted.count} existing warm posts from Turso Production.`);

  let insertedZh = 0;
  let insertedEn = 0;

  const distributedZh = distributePosts(zhPosts);
  const distributedEn = distributePosts(enPosts);

  // Insert Chinese warm posts
  for (const post of distributedZh) {
    const categoryId = categoryMap.get(post.targetCategoryName) || null;

    await prisma.post.create({
      data: {
        userId: null,
        nickname: ZH_NICKNAMES[Math.floor(Math.random() * ZH_NICKNAMES.length)],
        content: post.content,
        isEncrypted: false,
        language: "zh",
        categoryId,
        isHidden: false,
        createdAt: randomDate(1, 90),
        tags: {
          create: { tag: post.targetCategoryName }
        }
      }
    });
    insertedZh++;
    if (insertedZh % 10 === 0) {
      console.log(`Inserted ${insertedZh} zh posts...`);
    }
  }

  // Insert English warm posts
  for (const post of distributedEn) {
    const categoryId = categoryMap.get(post.targetCategoryName) || null;

    await prisma.post.create({
      data: {
        userId: null,
        nickname: EN_NICKNAMES[Math.floor(Math.random() * EN_NICKNAMES.length)],
        content: post.content,
        isEncrypted: false,
        language: "en",
        categoryId,
        isHidden: false,
        createdAt: randomDate(1, 90),
        tags: {
          create: { tag: post.targetCategoryName }
        }
      }
    });
    insertedEn++;
    if (insertedEn % 10 === 0) {
      console.log(`Inserted ${insertedEn} en posts...`);
    }
  }

  console.log(`Seeding complete. Inserted ${insertedZh} zh posts, ${insertedEn} en posts.`);

  // Verify final counts by tag name for both languages
  console.log("Verification - Category counts in Turso Production:");
  const allTags = ["心弦", "求索", "尘网", "屋檐", "浮生", "幽壑", "拾遗", "碎语", "长卷"];
  for (const tag of allTags) {
    const countZh = await prisma.post.count({
      where: { userId: null, language: "zh", tags: { some: { tag } } }
    });
    const countEn = await prisma.post.count({
      where: { userId: null, language: "en", tags: { some: { tag } } }
    });
    console.log(`- Category "${tag}" -> zh: ${countZh} posts, en: ${countEn} posts`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
