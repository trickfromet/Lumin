const { createClient } = require("@libsql/client");
require("dotenv").config();

async function inspect(dbName, url, token) {
  console.log(`\n--- Inspecting ${dbName} (${url}) ---`);
  let client;
  try {
    client = createClient({ url, authToken: token });
    const countRes = await client.execute("SELECT COUNT(*) as count FROM Post;");
    console.log("Total posts count:", countRes.rows[0].count);

    const zhPosts = await client.execute("SELECT id, nickname, language, isHidden FROM Post WHERE language = 'zh';");
    console.log("ZH posts:", JSON.stringify(zhPosts.rows, null, 2));

    const post4403 = await client.execute("SELECT id, nickname, language, isHidden FROM Post WHERE id = 4403;");
    console.log("Post 4403 details:", JSON.stringify(post4403.rows[0], null, 2));
    
    if (post4403.rows.length > 0) {
      const tags = await client.execute("SELECT * FROM PostTag WHERE postId = 4403;");
      console.log("PostTag for 4403:", JSON.stringify(tags.rows, null, 2));
    }
  } catch (e) {
    console.log(`Failed to inspect ${dbName}: ${e.message}`);
  } finally {
    if (client) client.close();
  }
}

async function main() {
  await inspect("prisma/dev.db", "file:./prisma/dev.db");
  await inspect("dev.db", "file:./dev.db");
  if (process.env.TURSO_DATABASE_URL) {
    await inspect("Turso", process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);
  }
}

main();
