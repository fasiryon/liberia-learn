import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { getCronPauseStatus } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";
import RuntimeSmokeVerificationPanel from "@/components/admin/RuntimeSmokeVerificationPanel";

export const dynamic = "force-dynamic";

export default async function RuntimeSmokePage() {
  await requirePlatformAdmin();
  if (!isRuntimeDashboardEnabled()) redirect("/admin/ops");
  const cronPause = await getCronPauseStatus();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="text-sm underline" href="/admin/ops/runtime">Back to Runtime Dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold">Production Smoke Verification</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Platform-admin readiness check for the deployed runtime while Vercel cron remains paused.
          </p>
        </header>

        <section className="rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
          <h2 className="text-lg font-semibold">Cron State</h2>
          <p className="mt-2 text-[var(--ll-text-muted)]">
            Paused: {cronPause.paused ? "yes" : "no"}; configured entries: {cronPause.configuredCount ?? "unknown"};
            restore entries: {cronPause.restoreCount ?? "unknown"}.
          </p>
        </section>

        <RuntimeSmokeVerificationPanel />
      </div>
    </main>
  );
}
