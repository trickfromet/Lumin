require("dotenv").config();
const { createClient } = require("@libsql/client");

async function updateDb(url, authToken) {
  console.log(`\nAttempting to update database at: ${url}`);
  let client;
  try {
    client = createClient({ url, authToken });
    
    // Check if Post table exists
    const checkPostTable = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Post';"
    );
    if (checkPostTable.rows.length === 0) {
      console.log("Post table does not exist in this database. Skipping.");
      return;
    }

    // Check count of NULLs
    const checkNulls = await client.execute(
      `SELECT COUNT(*) as count FROM "Post" WHERE "allowComments" IS NULL OR "allowStrangerComments" IS NULL;`
    );
    const nullCount = checkNulls.rows[0].count;
    console.log(`Found ${nullCount} posts with NULL privacy fields.`);

    if (nullCount > 0) {
      const result = await client.execute(
        `UPDATE "Post" SET "allowComments" = 1, "allowStrangerComments" = 1 WHERE "allowComments" IS NULL OR "allowStrangerComments" IS NULL;`
      );
      console.log(`Success! Updated rows: ${result.rowsAffected}`);
    } else {
      console.log("No update needed.");
    }
  } catch (err) {
    console.error(`Failed to update database at ${url}:`, err.message);
  } finally {
    if (client) {
      try {
        client.close();
      } catch (e) {}
    }
  }
}

async function main() {
  const dbs = [
    { url: "file:./prisma/dev.db" },
    { url: "file:./dev.db" },
    { url: "file:./test.db" }
  ];

  if (process.env.TURSO_DATABASE_URL) {
    dbs.unshift({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  }

  for (const db of dbs) {
    await updateDb(db.url, db.authToken);
  }
  console.log("\nDatabase update process completed.");
}

main().catch(err => {
  console.error("Main execution failed:", err);
  process.exit(1);
});
