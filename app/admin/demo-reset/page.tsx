import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { DemoResetClient } from "./DemoResetClient";

export const dynamic = "force-dynamic";

export default async function AdminDemoResetPage() {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-10 text-[var(--ll-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--ll-yellow)]">LiberiaLearn Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Demo Reset</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ll-text-muted)]">
              Reset demo schools to a clean seeded state for preview deployments, MOE walkthroughs, and investor demos.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] transition hover:border-[var(--ll-border)] hover:bg-[var(--ll-bg)]"
          >
            Back to Admin
          </Link>
        </div>

        <DemoResetClient />
      </div>
    </main>
  );
}
