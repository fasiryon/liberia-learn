import { describe, it, expect } from "vitest";

/**
 * Regression test for the platform-wide cron 405 bug (2026-07-15): Vercel
 * Cron Jobs invoke via GET, but these routes only ever exported POST. Each
 * now aliases GET to the same handler - this just guards against that
 * silently regressing again.
 */
const ROUTES = [
  "@/app/api/cron/alert-digest/route",
  "@/app/api/cron/alert-inactive/route",
  "@/app/api/cron/alert-low-grade/route",
  "@/app/api/cron/assignment-due-reminders/route",
  "@/app/api/cron/check-ai-budget/route",
  "@/app/api/cron/check-dlq/route",
  "@/app/api/cron/cleanup-offline-packs/route",
  "@/app/api/cron/cleanup-rejected-videos/route",
  "@/app/api/cron/league-weekly-reset/route",
  "@/app/api/cron/nightly-backup/route",
  "@/app/api/cron/process-audio-generation/route",
  "@/app/api/cron/process-textbook-generation/route",
  "@/app/api/cron/release-stale-grades/route",
  "@/app/api/crons/league-snapshot/route",
  "@/app/api/cron/autonomous/stale-approvals/route",
  "@/app/api/cron/autonomous/evaluation-windows/route",
  "@/app/api/cron/autonomous/workflow-recovery/route",
  "@/app/api/cron/autonomous/runtime-health/route",
  "@/app/api/cron/autonomous/dead-letter-inspection/route",
];

describe("cron routes export a GET handler (Vercel Cron invokes via GET, not POST)", () => {
  it.each(ROUTES)("%s exports GET aliased to POST", async (modulePath) => {
    const mod = await import(modulePath);
    expect(typeof mod.GET).toBe("function");
    expect(mod.GET).toBe(mod.POST);
  });
});
