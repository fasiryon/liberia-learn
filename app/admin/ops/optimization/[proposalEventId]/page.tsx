import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOptimizationRecommendation } from "@/lib/autonomous/optimization/optimizationReviewService";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export default async function OptimizationTracePage({ params }: { params: { proposalEventId: string } }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN") redirect("/");
  const { proposal, reviews } = await getOptimizationRecommendation({ proposalEventId: params.proposalEventId, requester: user });
  const metadata = proposal.metadata ?? {};
  const reviewStatus = reviews[0]?.metadata?.reviewStatus ?? metadata.reviewStatus ?? "PENDING_REVIEW";
  const isApproved = reviewStatus === "APPROVED";
  const implEnabled = isImplementationWorkflowEnabled();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Optimization Evidence</p>
            <h1 className="text-2xl font-semibold">{metadata.title}</h1>
          </div>
          <Link href="/admin/ops/optimization/change-requests" className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]">
            Change Requests →
          </Link>
        </header>
        <section className="rounded border bg-[var(--ll-surface)] p-4 text-sm space-y-1.5">
          <div>Category: {metadata.category}</div>
          <div>Review status: <strong>{reviewStatus}</strong></div>
          <div>Confidence: {metadata.confidence}</div>
          <div>Approval: {metadata.approvalRequirement}</div>
          <div>Applied: no — policy is never mutated automatically</div>
        </section>
        {isApproved && implEnabled && (
          <section className="rounded border border-green-200 bg-green-50 p-4 text-sm space-y-2">
            <p className="font-medium text-green-700">This proposal is approved. You may now create a governed implementation workflow.</p>
            <p className="text-xs text-green-600">Creating a workflow does not mutate any policy or configuration — it starts the human sign-off and staged rollout process.</p>
            <form action={`/api/admin/ops/optimization/${params.proposalEventId}/implementation`} method="POST">
              <button type="submit" className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">
                Create Implementation Workflow
              </button>
            </form>
          </section>
        )}
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
