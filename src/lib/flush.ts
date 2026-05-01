import { db } from "@/db";
import { minedCards, users, cronRuns } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  AnkiError,
  addNote,
  ensureDeck,
  ensureNoteType,
  findNotesByExpression,
} from "@/lib/anki";
import { readAudio } from "@/lib/audio-storage";

export interface FlushResult {
  sent: number;
  pending: number;
  failed: number;
  errors: string[];
}

export async function flushUser(userId: string): Promise<FlushResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("user not found");
  if (!user.ankiFunnelUrl || !user.ankiAuthKey) {
    return { sent: 0, pending: 0, failed: 0, errors: ["anki not configured"] };
  }
  const cfg = { funnelUrl: user.ankiFunnelUrl, authKey: user.ankiAuthKey };

  // Ensure deck + note type once per flush (cheap, idempotent).
  try {
    await ensureNoteType(cfg);
    await ensureDeck(cfg, user.ankiMainDeckName ?? "Default");
  } catch (e) {
    if (e instanceof AnkiError && e.kind === "connection") {
      return {
        sent: 0,
        pending: await pendingCount(userId),
        failed: 0,
        errors: ["anki offline"],
      };
    }
    throw e;
  }

  const pending = await db
    .select()
    .from(minedCards)
    .where(
      and(eq(minedCards.userId, userId), eq(minedCards.status, "pending")),
    );

  const result: FlushResult = {
    sent: 0,
    pending: 0,
    failed: 0,
    errors: [],
  };

  for (const card of pending) {
    try {
      const audio =
        card.audioFilename && card.audioPath
          ? [
              {
                filename: card.audioFilename,
                data: (await readAudio(card.audioFilename)).toString("base64"),
              },
            ]
          : undefined;

      const noteId = await addNote(cfg, {
        deckName: user.ankiMainDeckName ?? "Default",
        modelName: user.ankiNoteType ?? "Kotoba Mined",
        fields: {
          Expression: highlight(card.sentenceJp, card.targetWord),
          TargetWord: card.targetWord,
          Reading: card.targetReading ?? "",
          Definition: card.definition ?? "",
          SentenceAudio: audio ? `[sound:${audio[0].filename}]` : "",
          SourceTitle: card.sourceTitle ?? "",
          SourceUrl: card.sourceUrl ?? "",
          MinedAt: card.createdAt.toISOString(),
        },
        audio,
        tags: ["kotoba", "mined"],
      });

      await db
        .update(minedCards)
        .set({
          status: "sent",
          ankiNoteId: String(noteId),
          sentAt: new Date(),
          errorMsg: null,
        })
        .where(eq(minedCards.id, card.id));
      result.sent++;
    } catch (e) {
      if (e instanceof AnkiError && e.kind === "connection") {
        // Laptop offline — leave the rest pending, abort early.
        result.pending = pending.length - result.sent;
        result.errors.push("anki offline mid-flush");
        break;
      }
      if (e instanceof AnkiError && e.kind === "duplicate") {
        // Resolve by looking up the existing note so we never double-mine.
        try {
          const ids = await findNotesByExpression(cfg, card.sentenceJp);
          await db
            .update(minedCards)
            .set({
              status: "sent",
              ankiNoteId: ids[0] ? String(ids[0]) : null,
              sentAt: new Date(),
              errorMsg: "duplicate (resolved)",
            })
            .where(eq(minedCards.id, card.id));
          result.sent++;
          continue;
        } catch {
          // fall through to failed branch
        }
      }
      const msg = e instanceof Error ? e.message : "unknown";
      await db
        .update(minedCards)
        .set({
          status: "failed",
          errorMsg: msg,
          attempts: sql`${minedCards.attempts} + 1`,
        })
        .where(eq(minedCards.id, card.id));
      result.failed++;
      result.errors.push(msg);
    }
  }

  if (result.pending === 0) {
    result.pending = await pendingCount(userId);
  }

  return result;
}

async function pendingCount(userId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(minedCards)
    .where(
      and(eq(minedCards.userId, userId), eq(minedCards.status, "pending")),
    );
  return rows[0]?.c ?? 0;
}

function highlight(sentence: string, word: string): string {
  if (!word) return sentence;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sentence.replace(new RegExp(escaped), `<b>${word}</b>`);
}

export async function flushAll(): Promise<FlushResult> {
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.ankiFunnelUrl} is not null`);
  const total: FlushResult = { sent: 0, pending: 0, failed: 0, errors: [] };
  for (const u of allUsers) {
    try {
      const r = await flushUser(u.id);
      total.sent += r.sent;
      total.pending += r.pending;
      total.failed += r.failed;
      total.errors.push(...r.errors);
    } catch (e) {
      total.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return total;
}

export async function recordCronRun(
  kind: "daily_curate" | "weekly_review" | "anki_flush",
  status: "ok" | "error" | "partial",
  summary: string,
) {
  await db.insert(cronRuns).values({
    kind,
    status,
    summary,
    finishedAt: new Date(),
  });
}
