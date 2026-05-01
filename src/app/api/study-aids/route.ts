import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contentItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateJSON, MODELS } from "@/lib/claude";
import { STUDY_AIDS_SYSTEM, studyAidsUser } from "@/lib/prompts/study-aids";

const Body = z.object({ contentId: z.number().int() });

const StudyAidsSchema = z.object({
  summary_easy_jp: z.string(),
  vocab: z
    .array(
      z.object({
        lemma: z.string(),
        reading: z.string(),
        gloss_en: z.string(),
        jlpt_estimate: z
          .enum(["N5", "N4", "N3", "N2", "N1"])
          .nullable()
          .optional(),
      }),
    )
    .min(1)
    .max(15),
  comprehension: z
    .array(z.object({ q_jp: z.string(), a_jp: z.string() }))
    .length(3),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(contentItems)
    .where(
      and(
        eq(contentItems.id, parsed.data.contentId),
        eq(contentItems.userId, userId),
      ),
    )
    .limit(1);
  if (!item) return new NextResponse("not found", { status: 404 });

  if (item.generatedAidsJson) {
    return NextResponse.json({ aids: item.generatedAidsJson, cached: true });
  }

  const aids = await generateJSON({
    model: MODELS.default,
    system: STUDY_AIDS_SYSTEM,
    user: studyAidsUser(item.bodyJp),
    maxTokens: 2048,
    validate: (raw) => StudyAidsSchema.parse(raw),
  });

  await db
    .update(contentItems)
    .set({ generatedAidsJson: aids })
    .where(eq(contentItems.id, item.id));

  return NextResponse.json({ aids, cached: false });
}
