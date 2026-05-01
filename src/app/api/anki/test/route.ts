import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/users";
import { deckNames } from "@/lib/anki";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });

  const user = await getUser(userId);
  if (!user?.ankiFunnelUrl || !user?.ankiAuthKey) {
    return NextResponse.json({
      ok: false,
      error: "Funnel URL and auth key required.",
    });
  }
  try {
    const decks = await deckNames({
      funnelUrl: user.ankiFunnelUrl,
      authKey: user.ankiAuthKey,
    });
    return NextResponse.json({ ok: true, deckCount: decks.length, decks });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    });
  }
}
