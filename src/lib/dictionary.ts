import { db } from "@/db";
import { vocabulary } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";

export interface DictEntry {
  id: number;
  lemma: string;
  reading: string | null;
  glossEn: string | null;
  pos: string | null;
  jmdictId: number | null;
  frequencyRank: number | null;
  jlptEstimate: string | null;
}

export async function lookup(
  lemma: string,
  reading?: string | null,
): Promise<DictEntry | null> {
  const where = reading
    ? and(eq(vocabulary.lemma, lemma), eq(vocabulary.reading, reading))
    : eq(vocabulary.lemma, lemma);
  const rows = await db.select().from(vocabulary).where(where).limit(1);
  if (rows[0]) return rows[0];

  // Fallback: same lemma, any reading.
  const any = await db
    .select()
    .from(vocabulary)
    .where(eq(vocabulary.lemma, lemma))
    .limit(1);
  return any[0] ?? null;
}

export async function upsertVocab(
  entry: Omit<DictEntry, "id">,
): Promise<DictEntry> {
  const existing = await lookup(entry.lemma, entry.reading);
  if (existing) return existing;
  const [row] = await db.insert(vocabulary).values(entry).returning();
  return row;
}

export async function searchByLemmaOrReading(q: string, limit = 10) {
  return db
    .select()
    .from(vocabulary)
    .where(or(eq(vocabulary.lemma, q), eq(vocabulary.reading, q)))
    .limit(limit);
}
