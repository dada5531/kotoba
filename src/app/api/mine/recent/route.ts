import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { minedCards } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const rows = await db
    .select()
    .from(minedCards)
    .where(eq(minedCards.userId, userId))
    .orderBy(desc(minedCards.createdAt))
    .limit(20);
  return NextResponse.json({
    cards: rows.map((r) => ({
      id: r.id,
      targetWord: r.targetWord,
      sentenceJp: r.sentenceJp,
      status: r.status,
      errorMsg: r.errorMsg,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
