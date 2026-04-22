import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const schools = await prisma.school.findMany({
    where: user.isPlatformAdmin ? undefined : { id: user.schoolId ?? "__no_school__" },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <header className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase text-[var(--ll-yellow)]">LiberiaLearn - Admin</p>
            <h1 className="text-lg font-semibold">Schools</h1>
            <p className="text-[11px] text-[var(--ll-text-muted)]">
              Open a school to review setup, people, classes, and readiness.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
          >
            Back to admin home
          </Link>
          {user.isPlatformAdmin ? (
            <Link
              href="/admin/schools/pending"
              className="rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs text-[var(--ll-yellow)] hover:border-emerald-400"
            >
              Pending approvals
            </Link>
          ) : null}
        </header>

        {user.isPlatformAdmin ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
            <h2 className="text-sm font-semibold mb-2">Add new school</h2>
            <form
              method="POST"
              action="/api/admin/schools"
              className="grid gap-3 md:grid-cols-2"
            >
              <div className="space-y-1 md:col-span-2">
                <label className="text-[11px] text-[var(--ll-text)]">School name</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Zoe Louis School - Barnesville"
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[var(--ll-text)]">
                  Timezone (default Africa/Monrovia)
                </label>
                <input
                  name="timezone"
                  defaultValue="Africa/Monrovia"
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[var(--ll-text)]">Primary color (hex)</label>
                <input
                  name="primaryHex"
                  defaultValue="#22c55e"
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[var(--ll-text)]">Secondary color (hex)</label>
                <input
                  name="secondaryHex"
                  defaultValue="#0ea5e9"
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-xs font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
                >
                  Add school
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 text-sm">
          <h2 className="text-sm font-semibold mb-3">Existing schools</h2>
          {schools.length === 0 ? (
            <p className="text-xs text-[var(--ll-text-muted)]">No schools available.</p>
          ) : (
            <div className="space-y-2">
              {schools.map((school) => (
                <Link
                  key={school.id}
                  href={`/admin/schools/${school.id}`}
                  className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 px-3 py-3 transition-colors hover:bg-[var(--ll-bg)]"
                >
                  <div>
                    <p className="text-[var(--ll-text)]">{school.name}</p>
                    <p className="text-[11px] text-[var(--ll-text-muted)]">{school.timezone}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--ll-text-muted)]">
                    <span
                      className="h-4 w-4 rounded-full border border-[var(--ll-border)]"
                      style={{ backgroundColor: school.primaryHex ?? "#22c55e" }}
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-[var(--ll-border)]"
                      style={{ backgroundColor: school.secondaryHex ?? "#0ea5e9" }}
                    />
                    <span>Open</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
