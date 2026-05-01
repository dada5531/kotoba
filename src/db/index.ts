import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Don't throw at import time during `next build` static analysis;
  // throw on first access instead.
}

const client = url ? neon(url) : (null as unknown as ReturnType<typeof neon>);

export const db = drizzle(client, { schema });
export { schema };
