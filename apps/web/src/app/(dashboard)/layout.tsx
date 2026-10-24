import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginUrlFor } from "@/lib/safe-callback-url";
import { DashboardNav } from "@/components/dashboard/nav";
import { InstallHint } from "@/components/dashboard/install-hint";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    // Come back to this page after signing in (a shortcut, a notification link)
    redirect(loginUrlFor((await headers()).get("x-pathname")) as Route);
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={session.user} />
      {/* One centred column: the app is phone-first and reads best narrow */}
      <main className="mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        <InstallHint />
        {children}
      </main>
    </div>
  );
}
