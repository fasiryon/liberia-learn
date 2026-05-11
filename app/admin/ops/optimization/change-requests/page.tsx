import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listChangeRequests } from "@/lib/autonomous/optimization/optimizationChangeRequestService";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-[var(--ll-text-muted)] bg-gray-100",
  PENDING_REVIEW: "text-yellow-700 bg-yellow-50",
  APPROVED_FOR_ROLLOUT: "text-green-700 bg-green-50",
  REJECTED: "text-red-700 bg-red-50",
  CANCELLED: "text-[var(--ll-text-muted)] bg-gray-100",
  ROLLING_OUT: "text-blue-700 bg-blue-50",
  ROLLOUT_PAUSED: "text-orange-700 bg-orange-50",
  ROLLOUT_VERIFIED: "text-green-700 bg-green-100",
  ROLLED_BACK: "text-red-700 bg-red-100",
  COMPLETED: "text-green-800 bg-green-100",
  FAILED: "text-red-800 bg-red-100",
};

export default async function ChangeRequestListPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL" && user.role !== "DISTRICT_ADMIN") {
    redirect("/");
  }

  if (!isImplementationWorkflowEnabled()) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-[var(--ll-text-muted)]">Implementation workflow is not enabled.</p>
        </div>
      </main>
    );
  }

  let changeRequests: any[] = [];
  try {
    changeRequests = await listChangeRequests({ actor: user, limit: 50 });
  } catch {
    // feature flag or DB issue — show empty state
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Phase 7 — Governed Implementation</p>
            <h1 className="text-2xl font-semibold">Optimization Change Requests</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Governed implementation path for approved optimization proposals. No policy is mutated without full human sign-off.
            </p>
          </div>
          <Link href="/admin/ops/optimization" className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--ll-surface)]">
            ← Optimization
          </Link>
        </header>

        {changeRequests.length === 0 ? (
          <div className="rounded border bg-[var(--ll-surface)] p-6 text-center text-sm text-[var(--ll-text-muted)]">
            No change requests yet. Create one from an approved optimization proposal.
          </div>
        ) : (
          <div className="divide-y rounded border bg-[var(--ll-surface)]">
            {changeRequests.map((cr: any) => {
              const color = STATUS_COLORS[cr.status] ?? "text-[var(--ll-text-muted)] bg-gray-100";
              return (
                <Link key={cr.id} href={`/admin/ops/optimization/change-requests/${cr.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--ll-bg)] transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{cr.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">{cr.category} · {cr.affectedScope} · {new Date(cr.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{cr.status}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
