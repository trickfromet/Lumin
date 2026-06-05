import "dotenv/config";

// Resolve the dev.db path relative to the project root.
if (!process.env.TURSO_DATABASE_URL) {
  process.env.TURSO_DATABASE_URL = "file:./treehole/prisma/dev.db";
}

async function main() {
  const [{ prisma }, categories] = await Promise.all([
    import("../lib/prisma"),
    import("../data/categories-seed.json"),
  ]);

  for (const cat of categories.default) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      },
    });
  }
  console.log("✅ Categories seeded successfully");
  await prisma.$disconnect();
}

main().catch(console.error);
