import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/mine");
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-6 py-24">
      <h1 className="font-jp text-6xl font-bold">言葉</h1>
      <p className="text-muted-foreground">
        Personal Japanese mining + study platform
      </p>
      <div className="flex gap-3">
        <Link
          href="/sign-in"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md border px-4 py-2"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
