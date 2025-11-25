// app/admin/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !session.user ||
    (session.user as any).role !== "ADMIN"
  ) {
    redirect("/login");
  }

  const adminName = session.user?.name || "System Admin";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%),radial-gradient(circle_at_bottom,_#0ea5e922,_transparent_60%)]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-white/5 bg-slate-950/70 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              LIBERIALEARN · ADMIN
            </p>
            <p className="text-lg font-semibold text-slate-50">
              {adminName}
            </p>
            <p className="text-xs text-slate-400">
              This is the control center for schools, teachers, and classes.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500 hover:text-slate-50"
            >
              ← Student demo / Login
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* Body */}
        <section className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/5 bg-slate-950/80 p-4 shadow-lg shadow-black/40 backdrop-blur">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold text-slate-50">Schools</p>
              <p className="mt-1 text-xs text-slate-400">
                (Coming soon) Add and manage schools across Liberia.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold text-slate-50">Teachers</p>
              <p className="mt-1 text-xs text-slate-400">
                (Coming soon) Invite teachers and assign them to classes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold text-slate-50">
                Classes &amp; Curriculum
              </p>
              <p className="mt-1 text-xs text-slate-400">
                (Coming soon) Define subjects, grade levels, and AI lesson
                plans.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
