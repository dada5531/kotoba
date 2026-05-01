import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureUser } from "@/lib/users";

export const dynamic = "force-dynamic";

const tabs = [
  { href: "/mine", label: "Mine" },
  { href: "/reading", label: "Reading" },
  { href: "/listening", label: "Listening" },
  { href: "/speaking", label: "Speaking" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  await ensureUser(userId);

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4">
          <Link href="/mine" className="font-jp text-2xl font-bold">
            言葉
          </Link>
          <nav className="flex gap-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-md px-3 py-1.5 hover:bg-accent"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      <main className="container mx-auto py-6">{children}</main>
    </div>
  );
}
