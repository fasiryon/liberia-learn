// app/admin/schools/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as any).role !== "ADMIN") {
    redirect("/dashboard");
  }

  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase text-emerald-300">
              LiberiaLearn · Admin
            </p>
            <h1 className="text-lg font-semibold">Schools</h1>
            <p className="text-[11px] text-slate-400">
              Manage schools in the LiberiaLearn network.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-50"
          >
            ⬅ Back to admin home
          </Link>
        </header>

        {/* Add school form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm">
          <h2 className="text-sm font-semibold mb-2">Add new school</h2>
          <form
            method="POST"
            action="/api/admin/schools"
            className="grid gap-3 md:grid-cols-2"
          >
            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] text-slate-300">School name</label>
              <input
                name="name"
                required
                placeholder="e.g. Zoe Louis School – Barnesville"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Timezone (default Africa/Monrovia)
              </label>
              <input
                name="timezone"
                defaultValue="Africa/Monrovia"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Primary color (hex)
              </label>
              <input
                name="primaryHex"
                defaultValue="#22c55e"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">
                Secondary color (hex)
              </label>
              <input
                name="secondaryHex"
                defaultValue="#0ea5e9"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Add school
              </button>
            </div>
          </form>
        </section>

        {/* Schools list */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm">
          <h2 className="text-sm font-semibold mb-3">Existing schools</h2>
          {schools.length === 0 ? (
            <p className="text-xs text-slate-400">No schools yet.</p>
          ) : (
            <div className="space-y-2">
              {schools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between rounded-xl bg-slate-950/80 px-3 py-2"
                >
                  <div>
                    <p className="text-slate-100">{school.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {school.timezone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-700"
                      style={{ backgroundColor: school.primaryHex ?? "#22c55e" }}
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-slate-700"
                      style={{
                        backgroundColor: school.secondaryHex ?? "#0ea5e9",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


