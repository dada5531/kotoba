import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isAuthorizedCron } from "@/lib/cron";
import { recordCronRun } from "@/lib/flush";
import { fetchUrl } from "@/lib/fetchers";
import { db } from "@/db";
import { contentItems, contentSources, users } from "@/db/schema";
import { sql } from "drizzle-orm";

// NHK Easy news list endpoint. Public JSON, updated through the day.
const NHK_EASY_LIST = "https://www3.nhk.or.jp/news/easy/news-list.json";
const NHK_EASY_BASE = "https://www3.nhk.or.jp/news/easy";

interface CuratedItem {
  title: string;
  url: string;
  body: string;
  kind: "nhk_easy" | "nhk";
  contentId: number;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const targetUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);

  const curated: CuratedItem[] = [];
  try {
    const easy = await pickNhkEasy();
    if (easy) curated.push(easy);
  } catch (e) {
    console.warn("nhk easy fetch failed:", e);
  }

  // Save against each user so /mine surfaces today's articles per-user.
  for (const u of targetUsers) {
    for (const c of curated) {
      const [src] = await db
        .insert(contentSources)
        .values({ kind: c.kind, sourceUrl: c.url, sourceName: c.title })
        .onConflictDoNothing()
        .returning();
      const [item] = await db
        .insert(contentItems)
        .values({
          userId: u.id,
          sourceId: src?.id ?? null,
          titleJp: c.title,
          bodyJp: c.body,
        })
        .returning();
      c.contentId = item.id;
    }
  }

  // Email via Resend if configured.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const to = process.env.DAILY_DIGEST_TO;
  if (apiKey && from && to && curated.length > 0) {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject: `Today's Japanese — ${todayLabel()}`,
      html: renderDigest(curated),
    });
  }

  await recordCronRun(
    "daily_curate",
    curated.length > 0 ? "ok" : "partial",
    `curated=${curated.length}`,
  );
  return NextResponse.json({ ok: true, count: curated.length });
}

async function pickNhkEasy(): Promise<CuratedItem | null> {
  const res = await fetch(NHK_EASY_LIST, {
    headers: { "User-Agent": "KotobaBot/0.1" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<
    string,
    Array<{ news_id: string; title: string }>
  >[];

  // Find first not-yet-ingested article.
  const seen = new Set<string>();
  const seenRows = await db
    .select({ url: contentSources.sourceUrl })
    .from(contentSources)
    .where(sql`${contentSources.kind} = 'nhk_easy'`);
  for (const r of seenRows) if (r.url) seen.add(r.url);

  for (const day of data) {
    for (const list of Object.values(day)) {
      for (const a of list) {
        const url = `${NHK_EASY_BASE}/${a.news_id}/${a.news_id}.html`;
        if (seen.has(url)) continue;
        try {
          const fetched = await fetchUrl(url);
          return {
            title: fetched.title,
            url,
            body: fetched.body,
            kind: "nhk_easy",
            contentId: 0,
          };
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

function todayLabel(): string {
  const d = new Date();
  const tz = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return tz.format(d);
}

function renderDigest(items: CuratedItem[]): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rows = items
    .map(
      (c) =>
        `<li><a href="${base}/mine?content=${c.contentId}">${escapeHtml(
          c.title,
        )}</a> <span style="color:#888">(${c.kind})</span></li>`,
    )
    .join("");
  return `<h2>Today's Japanese</h2><ul>${rows}</ul>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}
