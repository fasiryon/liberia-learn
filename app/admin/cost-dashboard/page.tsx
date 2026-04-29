import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPipelineCostSummary } from "@/lib/curriculum/pipelineCostSummary";
import { isCostDashboardEnabled } from "@/lib/serverFlags";
import { CostDashboardClient } from "./CostDashboardClient";

export const dynamic = "force-dynamic";

export default async function CostDashboardPage() {
  if (!isCostDashboardEnabled()) redirect("/admin");

  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) redirect("/admin");

  const data = await getPipelineCostSummary();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#0f766e22,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-teal-300">LiberiaLearn Pipeline Ops</p>
          <h1 className="text-3xl font-bold">Cost Dashboard</h1>
          <p className="max-w-3xl text-sm text-[var(--ll-text-muted)]">
            TTS audio and textbook generation spend across all grades and subjects.
            Costs are cumulative over all GENERATED records.
          </p>
        </header>

        <CostDashboardClient initialData={data} />
      </div>
    </main>
  );
}
