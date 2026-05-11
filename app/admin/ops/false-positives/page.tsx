import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FalsePositiveReviewPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const where: any = { eventType: "autonomous.evaluation.recorded", status: "false_positive" };
  if (!user.isPlatformAdmin) where.schoolId = user.schoolId ?? "__none__";
  const events = await (prisma as any).learningEvent.findMany({ where, orderBy: { occurredAt: "desc" }, take: 100 });
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Evaluation Review</p>
          <h1 className="text-2xl font-semibold">False Positives</h1>
        </header>
        <section className="space-y-3">
          {events.map((event: any) => (
            <div key={event.id} className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
              <div className="font-medium">{event.metadata?.decisionType ?? event.targetId}</div>
              <div className="text-[var(--ll-text-muted)]">Confidence {event.metadata?.confidenceBefore} to {event.metadata?.confidenceAfter}</div>
              <div className="mt-2">{event.metadata?.explanation}</div>
            </div>
          ))}
          {events.length === 0 ? <div className="rounded border border-[var(--ll-border)] p-6 text-center text-sm text-[var(--ll-text-muted)]">No false-positive reviews recorded.</div> : null}
        </section>
      </div>
    </main>
  );
}

