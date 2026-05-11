import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EvidenceInspectionPage({ params }: { params: { decisionId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const decision = await (prisma as any).agentDecision.findUnique({ where: { id: params.decisionId } });
  if (!decision || !String(decision.decisionType).startsWith("detector.recommendation.")) notFound();

  const refs = Array.isArray(decision.evidenceRefs?.refs) ? decision.evidenceRefs.refs : [];
  const signals = Array.isArray(decision.evidenceRefs?.signals) ? decision.evidenceRefs.signals : [];

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link href={`/admin/ops/recommendations/${decision.id}`} className="text-sm underline">
            Back to recommendation
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Evidence Inspection</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Evidence references only. Raw student PII is not rendered on this page.
          </p>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Signals</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {signals.map((signal: any) => (
              <div key={signal.key} className="rounded border border-[var(--ll-border)] p-3">
                <div className="font-medium">{signal.label ?? signal.key}</div>
                <div className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  value {signal.value} · threshold {signal.direction} {signal.threshold}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Record ID</th>
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2">Occurred</th>
              </tr>
            </thead>
            <tbody>
              {refs.map((reference: any, index: number) => (
                <tr key={`${reference.type}:${reference.id}:${index}`} className="border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2">{reference.type}</td>
                  <td className="px-3 py-2">{reference.id}</td>
                  <td className="px-3 py-2">{reference.schoolId ?? "aggregate"}</td>
                  <td className="px-3 py-2">{reference.occurredAt ? new Date(reference.occurredAt).toLocaleString() : "n/a"}</td>
                </tr>
              ))}
              {refs.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={4}>
                    No evidence references recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
