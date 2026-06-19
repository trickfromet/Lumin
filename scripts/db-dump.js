const { createClient } = require("@libsql/client");
require("dotenv").config();

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  console.log(`Dumping from: ${url}`);
  let client;
  try {
    client = createClient({ url, authToken: token });
    const result = await client.execute("SELECT id, allowComments, allowStrangerComments FROM Post LIMIT 10;");
    console.log("Rows:", JSON.stringify(result.rows, null, 2));
    
    const nullComments = await client.execute("SELECT COUNT(*) as count FROM Post WHERE allowComments IS NULL;");
    console.log("allowComments is null count:", nullComments.rows[0].count);

    const nullStranger = await client.execute("SELECT COUNT(*) as count FROM Post WHERE allowStrangerComments IS NULL;");
    console.log("allowStrangerComments is null count:", nullStranger.rows[0].count);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    if (client) client.close();
  }
}
main();
