/**
 * One-shot JMdict ingest. Run once after the first migration.
 *
 *   pnpm db:seed:jmdict path/to/JMdict_e.gz
 *
 * The official JMdict release ships as a gzipped XML file. We don't redistribute
 * it — download from https://www.edrdg.org/jmdict/edict_doc.html and pass the
 * path as an argument. Loads roughly 200k entries into the `vocabulary` table.
 *
 * This is intentionally minimal: lemma + first reading + first English gloss
 * + part-of-speech. Frequency rank and JLPT estimates can be backfilled from
 * a separate frequency list later.
 */

import "dotenv/config";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { vocabulary } from "./schema";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: tsx src/db/seed-jmdict.ts path/to/JMdict_e.gz");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const db = drizzle(neon(url));

  const stream = createReadStream(path).pipe(createGunzip());
  let buffer = "";
  let inEntry = false;
  let entry = "";
  let count = 0;
  const batch: (typeof vocabulary.$inferInsert)[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await db.insert(vocabulary).values(batch).onConflictDoNothing();
    batch.length = 0;
  };

  for await (const chunk of stream) {
    buffer += chunk.toString("utf8");
    let idx;
    while ((idx = buffer.indexOf("</entry>")) !== -1) {
      const start = buffer.indexOf("<entry>");
      if (start === -1 || start > idx) {
        buffer = buffer.slice(idx + 8);
        continue;
      }
      entry = buffer.slice(start, idx + 8);
      buffer = buffer.slice(idx + 8);
      inEntry = false;
      void inEntry;

      const row = parseEntry(entry);
      if (row) {
        batch.push(row);
        count++;
        if (batch.length >= 500) await flush();
      }
    }
  }
  await flush();
  console.log(`seeded ${count} entries`);
}

function parseEntry(xml: string): typeof vocabulary.$inferInsert | null {
  const ent_seq = xml.match(/<ent_seq>(\d+)<\/ent_seq>/)?.[1];
  const lemma =
    xml.match(/<keb>([^<]+)<\/keb>/)?.[1] ??
    xml.match(/<reb>([^<]+)<\/reb>/)?.[1];
  const reading = xml.match(/<reb>([^<]+)<\/reb>/)?.[1] ?? null;
  const gloss = xml.match(/<gloss[^>]*>([^<]+)<\/gloss>/)?.[1] ?? null;
  const pos = xml.match(/<pos>&([^;]+);<\/pos>/)?.[1] ?? null;
  if (!lemma) return null;
  return {
    lemma,
    reading,
    glossEn: gloss,
    pos,
    jmdictId: ent_seq ? Number(ent_seq) : null,
    frequencyRank: null,
    jlptEstimate: null,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
