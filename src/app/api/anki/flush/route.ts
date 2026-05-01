import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { flushUser } from "@/lib/flush";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const result = await flushUser(userId);
  return NextResponse.json(result);
}
