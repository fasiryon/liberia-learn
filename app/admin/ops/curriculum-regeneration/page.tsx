import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurriculumRegenerationOpsData } from "@/lib/curriculum/regenerationAdmin";

export const dynamic = "force-dynamic";

function fmt(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function count(map: Record<string, number>, key: string) {
  return map[key] ?? 0;
}

export default async function CurriculumRegenerationOpsPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");
  const data = await getCurriculumRegenerationOpsData();
  const queue = data.queueDepth;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Platform Operations</p>
            <h1 className="text-2xl font-semibold">Curriculum Regeneration</h1>
          </div>
          <Link className="rounded border border-[var(--ll-border)] px-3 py-2 text-sm" href="/admin/ops/curriculum-review">
            Review Drafts
          </Link>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["Active runs", count(data.runCounts, "pending") + count(data.runCounts, "running") + count(data.runCounts, "paused")],
            ["Completed runs", count(data.runCounts, "completed")],
            ["Failed runs", count(data.runCounts, "completed_with_errors") + count(data.runCounts, "stopped")],
            ["Queue depth", queue?.total ?? "n/a"],
            ["Pending jobs", count(data.jobCounts, "pending")],
            ["Processing jobs", count(data.jobCounts, "processing")],
            ["Approved jobs", count(data.jobCounts, "approved")],
            ["Failed jobs", count(data.jobCounts, "failed")],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <div className="text-sm text-[var(--ll-text-muted)]">{label}</div>
              <div className="text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <h2 className="text-lg font-semibold">Health</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt>Database</dt><dd>{data.health.db}</dd></div>
              <div className="flex justify-between"><dt>Provider</dt><dd>{data.health.provider}</dd></div>
              <div className="flex justify-between"><dt>Worker heartbeat</dt><dd>{data.health.lastWorkerHeartbeat ?? "not recorded"}</dd></div>
              <div className="flex justify-between"><dt>Queue visible</dt><dd>{queue?.visible ?? "n/a"}</dd></div>
              <div className="flex justify-between"><dt>Queue in flight</dt><dd>{queue?.notVisible ?? "n/a"}</dd></div>
            </dl>
          </div>
          <div className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold">QA Summary</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div><div className="text-sm text-[var(--ll-text-muted)]">Approved thin</div><div className="text-xl font-semibold">{data.qa.approvedThinCount}</div></div>
              <div><div className="text-sm text-[var(--ll-text-muted)]">Malformed output</div><div className="text-xl font-semibold">{data.qa.malformedOutputCount}</div></div>
              <div><div className="text-sm text-[var(--ll-text-muted)]">Placeholder/mojibake</div><div className="text-xl font-semibold">{data.qa.placeholderOrMojibakeCount}</div></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {data.qa.qualityGateFailureReasons.map((row) => (
                <span key={row.reason} className="rounded border border-[var(--ll-border)] px-2 py-1">{row.reason}: {row.count}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Needs Review</th>
                <th className="px-3 py-2">Drafts</th>
                <th className="px-3 py-2">Avg Length</th>
                <th className="px-3 py-2">Failure Rate</th>
                <th className="px-3 py-2">Malformed</th>
                <th className="px-3 py-2">Placeholder</th>
              </tr>
            </thead>
            <tbody>
              {data.qa.gradeSubject.map((row) => (
                <tr key={`${row.grade}-${row.subject}`} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2">{row.grade}</td>
                  <td className="px-3 py-2">{row.subject}</td>
                  <td className="px-3 py-2">{row.needsReview}</td>
                  <td className="px-3 py-2">{row.draft}</td>
                  <td className="px-3 py-2">{row.averageContentLength}</td>
                  <td className="px-3 py-2">{Math.round(row.failureRate * 100)}%</td>
                  <td className="px-3 py-2">{row.malformedOutput}</td>
                  <td className="px-3 py-2">{row.placeholderOrMojibake}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-[var(--ll-border)] p-4">
            <h2 className="text-lg font-semibold">Latest Errors</h2>
            <div className="mt-3 space-y-3 text-sm">
              {data.latestErrors.map((error) => (
                <div key={error.id} className="border-t border-[var(--ll-border)] pt-3">
                  <div className="font-medium">{error.curriculumContentId} · {error.lastErrorCode}</div>
                  <div className="text-[var(--ll-text-muted)]">{error.lastErrorMessage}</div>
                </div>
              ))}
              {data.latestErrors.length === 0 ? <p className="text-sm text-[var(--ll-text-muted)]">No recent regeneration errors.</p> : null}
            </div>
          </div>
          <div className="rounded border border-[var(--ll-border)] p-4">
            <h2 className="text-lg font-semibold">Latest Audit Events</h2>
            <div className="mt-3 space-y-2 text-sm">
              {data.auditEvents.map((event) => (
                <div key={event.id} className="flex justify-between gap-4 border-t border-[var(--ll-border)] pt-2">
                  <span>{event.action}</span>
                  <span className="text-[var(--ll-text-muted)]">{fmt(event.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Approved</th>
                <th className="px-3 py-2">Failed</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => (
                <tr key={run.id} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2 font-mono text-xs">{run.id}</td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">{run.totalProcessed}/{run.totalPlanned}</td>
                  <td className="px-3 py-2">{run.totalApproved}</td>
                  <td className="px-3 py-2">{run.totalFailed}</td>
                  <td className="px-3 py-2">{run.currentGradeLevel ?? "n/a"} {run.currentSubject ?? ""}</td>
                  <td className="px-3 py-2">{fmt(run.completedAt ?? run.startedAt ?? run.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

