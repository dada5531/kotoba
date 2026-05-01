import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { minedCards } from "@/db/schema";
import { upsertVocab } from "@/lib/dictionary";
import { synthesize, audioFilename } from "@/lib/voicevox";
import { saveAudio } from "@/lib/audio-storage";
import { getUser } from "@/lib/users";
import { flushUser } from "@/lib/flush";

const Body = z.object({
  targetWord: z.string().min(1),
  targetReading: z.string().nullable().optional(),
  definition: z.string().nullable().optional(),
  sentence: z.string().min(1),
  contentId: z.number().int().nullable().optional(),
  sourceTitle: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const user = await getUser(userId);
  if (!user) return new NextResponse("user not initialized", { status: 500 });

  // Best-effort vocab upsert; doesn't block mining if it fails.
  let vocabId: number | null = null;
  try {
    const v = await upsertVocab({
      lemma: data.targetWord,
      reading: data.targetReading ?? null,
      glossEn: data.definition ?? null,
      pos: null,
      jmdictId: null,
      frequencyRank: null,
      jlptEstimate: null,
    });
    vocabId = v.id;
  } catch {
    // ignore, keep vocabId null
  }

  // Synthesize sentence audio. If VOICEVOX is unavailable, the card still
  // mines without audio — better than blocking the user.
  let audioPath: string | null = null;
  let audioFile: string | null = null;
  try {
    const filename = audioFilename(`${data.targetWord}|${data.sentence}`);
    const buf = await synthesize(data.sentence, user.voicevoxSpeakerId ?? 3);
    audioPath = await saveAudio(filename, buf);
    audioFile = filename;
  } catch (e) {
    console.warn("voicevox synth failed:", e);
  }

  const [row] = await db
    .insert(minedCards)
    .values({
      userId,
      vocabId,
      targetWord: data.targetWord,
      targetReading: data.targetReading ?? null,
      definition: data.definition ?? null,
      sentenceJp: data.sentence,
      sourceContentId: data.contentId ?? null,
      sourceTitle: data.sourceTitle ?? null,
      sourceUrl: data.sourceUrl ?? null,
      audioPath,
      audioFilename: audioFile,
      status: "pending",
    })
    .returning();

  // Fire-and-forget flush. If the laptop is offline, the card stays
  // pending and the cron retries.
  let flushed = false;
  try {
    const result = await flushUser(userId);
    flushed = result.sent > 0;
  } catch {
    // swallow; cron will retry
  }

  return NextResponse.json({ id: row.id, flushed });
}
