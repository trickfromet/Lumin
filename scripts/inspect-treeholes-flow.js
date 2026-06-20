const { createClient } = require("@libsql/client");
require("dotenv").config();

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

async function main() {
  const client = createClient({ url, authToken: token });
  try {
    console.log("Database url:", url);
    // 1. Get visible posts
    const visiblePostsRes = await client.execute("SELECT id, createdAt, content FROM Post WHERE isHidden = 0 AND language = 'zh';");
    console.log("Visible posts count:", visiblePostsRes.rows.length);
    console.log("Visible posts:", JSON.stringify(visiblePostsRes.rows, null, 2));

    const visiblePostIds = visiblePostsRes.rows.map(r => r.id);
    console.log("Visible post IDs:", visiblePostIds);

    if (visiblePostIds.length > 0) {
      // 2. Group by tag
      // We want to mimic:
      // prisma.postTag.groupBy({
      //   by: ["tag"],
      //   _count: { tag: true },
      //   _max: { postId: true },
      //   where: { postId: { in: visiblePostIds } }
      // })
      // Let's run equivalent SQL:
      const placeholders = visiblePostIds.map(() => "?").join(",");
      const query = `SELECT tag, COUNT(tag) as count, MAX(postId) as maxPostId FROM PostTag WHERE postId IN (${placeholders}) GROUP BY tag;`;
      console.log("Running SQL:", query, "with args:", visiblePostIds);
      const groupRes = await client.execute({
        sql: query,
        args: visiblePostIds
      });
      console.log("Grouped tags count:", groupRes.rows.length);
      console.log("Grouped tags rows:", JSON.stringify(groupRes.rows, null, 2));
    } else {
      console.log("No visible post IDs to query tags for.");
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    client.close();
  }
}

main();
