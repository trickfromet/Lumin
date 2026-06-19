const { createClient } = require("@libsql/client");
require("dotenv").config();

async function check(url, token) {
  console.log(`\nChecking ${url}...`);
  let client;
  try {
    client = createClient({ url, authToken: token });
    const posts = await client.execute("SELECT COUNT(*) as count FROM Post;");
    console.log(`Count of posts: ${posts.rows[0].count}`);
    
    // Check null columns count
    try {
      const nullComments = await client.execute(
        `SELECT COUNT(*) as count FROM Post WHERE allowComments IS NULL;`
      );
      console.log(`allowComments IS NULL count: ${nullComments.rows[0].count}`);
    } catch (e) {
      console.log(`allowComments col check failed: ${e.message}`);
    }
    
    try {
      const nullStranger = await client.execute(
        `SELECT COUNT(*) as count FROM Post WHERE allowStrangerComments IS NULL;`
      );
      console.log(`allowStrangerComments IS NULL count: ${nullStrangerComments.rows[0].count}`);
    } catch (e) {
      console.log(`allowStrangerComments col check failed: ${e.message}`);
    }

    const columns = await client.execute("PRAGMA table_info(Post);");
    console.log("Columns present in Post:", columns.rows.map(r => r.name).join(", "));
  } catch (e) {
    console.log(`Error checking ${url}: ${e.message}`);
  } finally {
    if (client) client.close();
  }
}

async function main() {
  await check("file:./prisma/dev.db");
  await check("file:./dev.db");
  if (process.env.TURSO_DATABASE_URL) {
    await check(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN);
  }
}
main();
