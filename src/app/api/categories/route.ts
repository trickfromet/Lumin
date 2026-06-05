export const runtime = "edge";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      _count: { select: { posts: true } },
    },
  });

  return success({ categories });
}
