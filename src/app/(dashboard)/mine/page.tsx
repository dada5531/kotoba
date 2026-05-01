import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { minedCards } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import MineWorkbench from "./mine-workbench";
import RecentMines from "./recent-mines";

export default async function MinePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(minedCards)
    .where(eq(minedCards.userId, userId))
    .orderBy(desc(minedCards.createdAt))
    .limit(20);

  const recent = rows.map((r) => ({
    id: r.id,
    targetWord: r.targetWord,
    sentenceJp: r.sentenceJp,
    status: r.status,
    errorMsg: r.errorMsg,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <MineWorkbench />
      <RecentMines initial={recent} />
    </div>
  );
}
