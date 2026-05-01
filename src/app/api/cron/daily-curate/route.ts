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

interface CuratedArticle {
  title: string;
  url: string;
  body: string;
  kind: "nhk_easy" | "nhk";
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const targetUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);

  const articles: CuratedArticle[] = [];
  try {
    const easy = await pickNhkEasy();
    if (easy) articles.push(easy);
  } catch (e) {
    console.warn("nhk easy fetch failed:", e);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  // Save against each user so /mine surfaces today's articles per-user,
  // and email each user their own digest with correct content links.
  let emailsSent = 0;
  for (const u of targetUsers) {
    const userItems: Array<CuratedArticle & { contentId: number }> = [];

    for (const a of articles) {
      const [src] = await db
        .insert(contentSources)
        .values({ kind: a.kind, sourceUrl: a.url, sourceName: a.title })
        .onConflictDoNothing()
        .returning();
      const [item] = await db
        .insert(contentItems)
        .values({
          userId: u.id,
          sourceId: src?.id ?? null,
          titleJp: a.title,
          bodyJp: a.body,
        })
        .returning();
      userItems.push({ ...a, contentId: item.id });
    }

    // Send per-user digest email. Skip users with no email.
    if (!u.email || u.email === "unknown@kotoba.local") {
      console.warn(
        `daily-curate: skipping email for user ${u.id} (no email set)`,
      );
      continue;
    }
    if (apiKey && from && userItems.length > 0) {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from,
          to: u.email,
          subject: `Today's Japanese — ${todayLabel()}`,
          html: renderDigest(userItems),
        });
        emailsSent++;
      } catch (e) {
        console.warn(`daily-curate: email failed for ${u.email}:`, e);
      }
    }
  }

  await recordCronRun(
    "daily_curate",
    articles.length > 0 ? "ok" : "partial",
    `curated=${articles.length}, emails=${emailsSent}`,
  );
  return NextResponse.json({
    ok: true,
    count: articles.length,
    emails: emailsSent,
  });
}

async function pickNhkEasy(): Promise<CuratedArticle | null> {
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

function renderDigest(
  items: Array<CuratedArticle & { contentId: number }>,
): string {
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
