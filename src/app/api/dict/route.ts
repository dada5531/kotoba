import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { lookup } from "@/lib/dictionary";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const lemma = url.searchParams.get("lemma");
  const reading = url.searchParams.get("reading");
  if (!lemma) return NextResponse.json({ entry: null });
  const entry = await lookup(lemma, reading);
  return NextResponse.json({ entry });
}
