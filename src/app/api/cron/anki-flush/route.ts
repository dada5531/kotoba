import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { flushAll, recordCronRun } from "@/lib/flush";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const result = await flushAll();
  await recordCronRun(
    "anki_flush",
    result.failed > 0 ? "partial" : "ok",
    `sent=${result.sent} pending=${result.pending} failed=${result.failed}`,
  );
  return NextResponse.json(result);
}
