import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contentItems, contentSources } from "@/db/schema";
import { tokenize } from "@/lib/sudachi";
import { fetchUrl } from "@/lib/fetchers";

const Body = z
  .object({
    url: z.string().url().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
  })
  .refine((d) => !!d.url || !!(d.text && d.text.trim()), {
    message: "url or text required",
  });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad request" },
      { status: 400 },
    );
  }

  let title = parsed.data.title ?? "Untitled";
  let body = parsed.data.text?.trim() ?? "";
  let kind: "paste" | "url" | "nhk" | "nhk_easy" = "paste";
  let sourceUrl: string | undefined;

  if (parsed.data.url) {
    const fetched = await fetchUrl(parsed.data.url);
    title = parsed.data.title ?? fetched.title;
    body = fetched.body;
    kind = fetched.kind;
    sourceUrl = parsed.data.url;
  }

  if (!body.trim()) {
    return NextResponse.json({ error: "empty content" }, { status: 400 });
  }

  let sourceId: number | null = null;
  if (sourceUrl) {
    const [src] = await db
      .insert(contentSources)
      .values({ kind, sourceUrl, sourceName: title })
      .onConflictDoNothing()
      .returning();
    sourceId = src?.id ?? null;
  }

  const tokens = await tokenize(body);

  const [item] = await db
    .insert(contentItems)
    .values({
      userId,
      sourceId,
      titleJp: title,
      bodyJp: body,
      tokensJson: tokens,
    })
    .returning();

  return NextResponse.json({
    contentId: item.id,
    title,
    body,
    tokens,
    sourceUrl,
  });
}
