import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { minedCards } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { audioExists, readAudio } from "@/lib/audio-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const { filename } = await params;
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return new NextResponse("bad filename", { status: 400 });
  }

  // Verify the caller owns a mined card referencing this audio file.
  const [owner] = await db
    .select({ id: minedCards.id })
    .from(minedCards)
    .where(
      and(eq(minedCards.audioFilename, filename), eq(minedCards.userId, userId)),
    )
    .limit(1);
  if (!owner) {
    return new NextResponse("not found", { status: 404 });
  }

  if (!(await audioExists(filename))) {
    return new NextResponse("not found", { status: 404 });
  }
  const buf = await readAudio(filename);
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "audio/wav";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
