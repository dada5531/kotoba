import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { tokenize } from "@/lib/sudachi";

const Body = z.object({ text: z.string().min(1) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const tokens = await tokenize(parsed.data.text);
  return NextResponse.json({ tokens });
}
