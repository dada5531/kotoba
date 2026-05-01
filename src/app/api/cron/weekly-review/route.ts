import { NextResponse } from "next/server";
import { Resend } from "resend";
import { marked } from "marked";
import { isAuthorizedCron } from "@/lib/cron";
import { recordCronRun } from "@/lib/flush";
import { generateText, MODELS } from "@/lib/claude";
import { WEEKLY_REVIEW_SYSTEM } from "@/lib/prompts/weekly-review";
import { db } from "@/db";
import { minedCards, users, weeklyFocus } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const allUsers = await db.select().from(users);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  let summaryCount = 0;
  for (const u of allUsers) {
    const stats = await computeStats(u.id);
    const md = await generateText({
      model: MODELS.heavy,
      system: WEEKLY_REVIEW_SYSTEM,
      user: `Stats:\n${JSON.stringify(stats, null, 2)}\n\nWrite a 4-6 sentence weekly review.`,
      maxTokens: 800,
    });

    if (apiKey && from) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to: u.email,
        subject: `Weekly review — week of ${weekOfLabel()}`,
        html: await marked.parse(md),
      });
    }

    await db.insert(weeklyFocus).values({
      userId: u.id,
      focusText: md,
      weekStarting: nextMonday(),
    });
    summaryCount++;
  }

  await recordCronRun(
    "weekly_review",
    "ok",
    `users=${summaryCount}`,
  );
  return NextResponse.json({ ok: true, users: summaryCount });
}

async function computeStats(userId: string) {
  const since = new Date(Date.now() - 7 * 86400 * 1000);
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${minedCards.status}='sent')::int`,
      failed: sql<number>`count(*) filter (where ${minedCards.status}='failed')::int`,
    })
    .from(minedCards)
    .where(
      and(eq(minedCards.userId, userId), gte(minedCards.createdAt, since)),
    );
  const recent = await db
    .select({ word: minedCards.targetWord, sentence: minedCards.sentenceJp })
    .from(minedCards)
    .where(
      and(eq(minedCards.userId, userId), gte(minedCards.createdAt, since)),
    )
    .limit(20);
  return { mined: counts ?? { total: 0, sent: 0, failed: 0 }, recent };
}

function weekOfLabel() {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function nextMonday(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
