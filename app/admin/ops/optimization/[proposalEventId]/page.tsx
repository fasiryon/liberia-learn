import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOptimizationRecommendation } from "@/lib/autonomous/optimization/optimizationReviewService";

export const dynamic = "force-dynamic";

export default async function OptimizationTracePage({ params }: { params: { proposalEventId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const { proposal, reviews } = await getOptimizationRecommendation({ proposalEventId: params.proposalEventId, requester: user });
  const metadata = proposal.metadata ?? {};
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Optimization Evidence</p>
          <h1 className="text-2xl font-semibold">{metadata.title}</h1>
        </header>
        <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm">
          <div>Category: {metadata.category}</div>
          <div>Review status: {reviews[0]?.metadata?.reviewStatus ?? metadata.reviewStatus}</div>
          <div>Confidence: {metadata.confidence}</div>
          <div>Approval: {metadata.approvalRequirement}</div>
          <div>Applied: no</div>
        </section>
        <section className="rounded border bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Evidence And Lineage</h2>
          <pre className="mt-3 overflow-auto rounded bg-black/5 p-3 text-xs">{JSON.stringify({ evidenceRefs: metadata.evidenceRefs, lineage: metadata.lineage, proposedChange: metadata.proposedChange, rollbackGuidance: metadata.rollbackGuidance }, null, 2)}</pre>
        </section>
        <section className="rounded border bg-[var(--ll-surface)] p-4">
          <h2 className="text-lg font-semibold">Review History</h2>
          <pre className="mt-3 overflow-auto rounded bg-black/5 p-3 text-xs">{JSON.stringify(reviews.map((review: any) => review.metadata), null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}
