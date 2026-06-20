// One-shot: rename categories + seed 12 posts. Runs against whatever TURSO_DATABASE_URL points to.
import "dotenv/config";

const RENAME_MAP: Record<string, string> = {
  "心弦": "情感",
  "求索": "学业",
  "尘网": "职场",
  "屋檐": "家庭",
  "浮生": "生活",
  "幽壑": "心绪",
};

const POSTS: { category: string; zh: string; en: string }[] = [
  {
    category: "情感",
    zh: "今天在地铁上又看到那个人了，每次都想打招呼但是不敢开口。已经第三次了，是不是该勇敢一次？",
    en: "Saw that person on the subway again today — third time this week. Every time I want to say hi but chicken out. Should I just go for it?",
  },
  {
    category: "学业",
    zh: "考研倒计时 47 天，每天图书馆开门就进去关门才出来。有时候真的很累，但是想想为什么出发，就又咬牙坚持下去了。",
    en: "47 days until my grad school entrance exam. Library open to close every single day. Sometimes I'm exhausted, but then I remember why I started — and I push through.",
  },
  {
    category: "职场",
    zh: "今天提了离职，在这里待了三年，从实习生做到项目负责人。说没有不舍是假的，但新机会真的太想去了。祝自己好运吧。",
    en: "Handed in my resignation today after 3 years. Intern to project lead. I'd be lying if I said I'm not sad, but the new opportunity is everything I've wanted. Wish me luck.",
  },
  {
    category: "家庭",
    zh: "妈妈打电话来说爸爸最近身体不太好，叫我多回家看看。挂了电话突然觉得眼眶湿了。工作再忙，也要记得回家。",
    en: "Mom called — dad hasn't been well lately. She said 'come home more often.' Hung up and my eyes just filled up. No matter how busy work gets, don't forget to go home.",
  },
  {
    category: "生活",
    zh: "周末一个人去逛了菜市场，买了新鲜的蔬菜和鱼，回家给自己做了一顿三菜一汤。独居第三年，终于学会了好好照顾自己。",
    en: "Took myself to the farmer's market this weekend — fresh veggies and a whole fish. Made myself a proper meal. Three years living alone, and I've finally learned to take care of myself.",
  },
  {
    category: "心绪",
    zh: "最近就是莫名觉得很丧，没什么特别的原因。不想说话，不想出门，连喜欢的剧都不想看了。希望这段时间快点过去。",
    en: "Been feeling down lately for no particular reason. Don't want to talk, don't want to go out, don't even want to watch my favorite shows. Really just hope this passes soon.",
  },
];

const ZH_ADJ = ["快乐的","孤独的","温柔的","迷糊的","机智的","懒洋洋的","勇敢的","害羞的","神秘的","呆萌的","忧郁的","认真的","天真的","佛系的","社恐的"];
const ZH_ANIMAL = ["柴犬","橘猫","兔子","仓鼠","柯基","熊猫","海豚","猫头鹰","刺猬","企鹅","树懒","水獭","松鼠","考拉","变色龙"];
const EN_ADJ = ["Happy","Lonely","Gentle","Sleepy","Witty","Shy","Brave","Cozy","Wild","Lucky","Funny","Dreamy","Sunny","Kind","Sweet"];
const EN_ANIMAL = ["Panda","Fox","Owl","Raccoon","Hedgehog","Dolphin","Penguin","Squirrel","Koala","Bunny","Wolf","Deer","Otter","Bear","Turtle"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function nickZh() { return rand(ZH_ADJ) + rand(ZH_ANIMAL); }
function nickEn() { return rand(EN_ADJ) + rand(EN_ANIMAL); }
function daysAgo(d: number) { return new Date(Date.now() - d * 864e5); }

async function main() {
  const { prisma } = await import("../lib/prisma");

  // 1. Rename categories
  const existing = await prisma.category.findMany({ select: { id: true, name: true } });
  for (const cat of existing) {
    const newName = RENAME_MAP[cat.name];
    if (newName) {
      await prisma.category.update({ where: { id: cat.id }, data: { name: newName } });
      console.log(`  ✏️  ${cat.name} → ${newName}`);
    }
  }

  // 2. Reload category map
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const catMap = new Map(categories.map((c) => [c.name, c.id]));
  console.log(`  📂 Categories: ${categories.map(c => c.name).join(", ")}`);

  // 3. Seed posts
  let total = 0;
  for (const p of POSTS) {
    const catId = catMap.get(p.category);
    if (!catId) { console.warn(`⚠ Unknown category: ${p.category}`); continue; }

    await prisma.post.create({
      data: {
        userId: null,
        nickname: nickZh(),
        content: p.zh,
        isEncrypted: false,
        language: "zh",
        categoryId: catId,
        isHidden: false,
        createdAt: daysAgo(total + 2),
        tags: { create: { tag: p.category } },
      },
    });
    total++;

    await prisma.post.create({
      data: {
        userId: null,
        nickname: nickEn(),
        content: p.en,
        isEncrypted: false,
        language: "en",
        categoryId: catId,
        isHidden: false,
        createdAt: daysAgo(total + 2),
        tags: { create: { tag: p.category } },
      },
    });
    total++;
  }

  console.log(`✅ Renamed ${Object.keys(RENAME_MAP).length} categories + seeded ${total} posts`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
