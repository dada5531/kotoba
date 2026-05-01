import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";

export async function ensureUser(userId: string) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];

  let email = "unknown@kotoba.local";
  try {
    const c = await clerkClient();
    const u = await c.users.getUser(userId);
    email = u.primaryEmailAddress?.emailAddress ?? email;
  } catch {
    // Clerk may not be reachable in dev; fall through with placeholder.
  }

  const [row] = await db
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoNothing()
    .returning();
  return row ?? (await getUser(userId));
}

export async function getUser(userId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0];
}

export async function updateUser(
  userId: string,
  patch: Partial<typeof users.$inferInsert>,
) {
  await db.update(users).set(patch).where(eq(users.id, userId));
}
