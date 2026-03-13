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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">LiberiaLearn Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Demo Reset</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Reset demo schools to a clean seeded state for preview deployments, MOE walkthroughs, and investor demos.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Back to Admin
          </Link>
        </div>

        <DemoResetClient />
      </div>
    </main>
  );
}
