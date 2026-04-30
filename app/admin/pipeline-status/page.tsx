import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGradePipelineStatus } from "@/lib/pipeline/gradeOrchestrator";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "COMPLETE"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status === "PROCESSING"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
        : status === "BLOCKED"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
          : "border-slate-500/30 bg-slate-500/10 text-slate-200";

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

export default async function PipelineStatusPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const rows = await getGradePipelineStatus();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn Pipeline Ops</p>
          <h1 className="text-3xl font-bold">Pipeline Status</h1>
          <p className="max-w-2xl text-sm text-[var(--ll-text-muted)]">
            Monitor grade-level curriculum, audio, and textbook readiness before controlled scale-up.
          </p>
        </header>

        <div className="overflow-x-auto rounded border border-white/10 bg-white/[0.03]">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">
              <tr>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Curriculum %</th>
                <th className="px-4 py-3">Audio %</th>
                <th className="px-4 py-3">Textbooks %</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--ll-text-muted)]" colSpan={5}>
                    No grade pipeline jobs have been queued.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.grade}>
                    <td className="px-4 py-3 font-semibold">Grade {row.grade}</td>
                    <td className="px-4 py-3">{row.curriculumCompletionPct}%</td>
                    <td className="px-4 py-3">{row.audioCompletionPct}%</td>
                    <td className="px-4 py-3">{row.textbookCompletionPct}%</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
