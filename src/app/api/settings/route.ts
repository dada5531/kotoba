import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateUser } from "@/lib/users";

const Body = z.object({
  ankiFunnelUrl: z.string().url().or(z.literal("")),
  ankiAuthKey: z.string(),
  ankiMainDeckName: z.string().min(1),
  ankiNoteType: z.string().min(1),
  jlptTarget: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  dailyMinutesGoal: z.number().int().min(0).max(600),
  voicevoxSpeakerId: z.number().int().min(0).max(100),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });

  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.format() },
      { status: 400 },
    );
  }

  await updateUser(userId, parsed.data);
  return NextResponse.json({ ok: true });
}
