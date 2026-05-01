import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const client = neon(url);
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
