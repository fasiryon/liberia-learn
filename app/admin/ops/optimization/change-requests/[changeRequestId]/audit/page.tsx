import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getImplementationAuditTrace } from "@/lib/autonomous/optimization/implementationWorkflowService";

export const dynamic = "force-dynamic";

export default async function ImplementationAuditPage({ params }: { params: { changeRequestId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");

  const trace = await getImplementationAuditTrace(params.changeRequestId, user);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Implementation Audit History</p>
            <h1 className="text-2xl font-semibold">{trace.changeRequest.title}</h1>
          </div>
          <Link href={`/admin/ops/optimization/change-requests/${params.changeRequestId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]">
            ← Change Request
          </Link>
        </header>

        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Audit Log Entries ({trace.auditEntries.length})</h2>
          {trace.auditEntries.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No audit entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {trace.auditEntries.map((entry: any) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-medium font-mono text-xs">{entry.action}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">{new Date(entry.createdAt).toLocaleString()} · {entry.userId ?? "system"}</p>
                    {entry.details && <pre className="rounded bg-black/5 p-2 text-xs overflow-auto">{JSON.stringify(entry.details, null, 2)}</pre>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Learning Events ({trace.learningEvents.length})</h2>
          {trace.learningEvents.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No learning events recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {trace.learningEvents.map((event: any) => (
                <li key={event.id} className="text-sm border-b pb-2 last:border-0">
                  <p className="font-mono text-xs font-medium">{event.eventType}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">{new Date(event.occurredAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border bg-[var(--ll-surface)] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Sign-Off History ({trace.signoffs.length})</h2>
          {trace.signoffs.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No sign-offs.</p>
          ) : (
            <ul className="space-y-1">
              {trace.signoffs.map((s: any) => (
                <li key={s.id} className="flex gap-3 text-sm">
                  <span className={s.decision === "APPROVED" ? "text-green-600" : "text-red-600"}>●</span>
                  <span>{s.reviewerRole}</span>
                  <span className="text-[var(--ll-text-muted)]">{s.decision} · {new Date(s.decidedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
