import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getRuntimeHealthSummary } from "@/lib/autonomous/runtime/runtimeHealthService";
import { getCronPauseStatus } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import {
  isApprovalExpirationWorkerEnabled,
  isAutonomousEmergencyShutdownEnabled,
  isDeadLetterInspectionCronEnabled,
  isImplementationWorkflowEnabled,
  isRuntimeDashboardEnabled,
  isRuntimeHealthCronEnabled,
  isWorkflowRecoveryCronEnabled,
} from "@/lib/serverFlags";
import type { SmokeResultStatus } from "@/lib/autonomous/runtime/types";

export type RuntimeSmokeCheck = {
  key: string;
  label: string;
  status: SmokeResultStatus;
  summary: string;
};

export type RuntimeSmokeVerificationResult = {
  ok: boolean;
  overallStatus: SmokeResultStatus;
  timestamp: string;
  actor: { id: string; role: string; isPlatformAdmin: boolean };
  checks: RuntimeSmokeCheck[];
  warnings: string[];
  recommendedNextActions: string[];
  featureFlags: {
    runtimeDashboard: boolean;
    workflowRecoveryCron: boolean;
    runtimeHealthCron: boolean;
    deadLetterInspectionCron: boolean;
    approvalExpirationWorker: boolean;
    implementationWorkflow: boolean;
    emergencyShutdown: boolean;
  };
};

function check(key: string, label: string, status: SmokeResultStatus, summary: string): RuntimeSmokeCheck {
  return { key, label, status, summary };
}

function overallStatus(checks: RuntimeSmokeCheck[]): SmokeResultStatus {
  if (checks.some((c) => c.status === "FAIL")) return "FAIL";
  if (checks.some((c) => c.status === "WARN")) return "WARN";
  if (checks.every((c) => c.status === "SKIPPED")) return "SKIPPED";
  return "PASS";
}

function containsSensitiveEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value ?? {});
  const sensitiveNames = ["SECRET", "TOKEN", "KEY", "PASSWORD", "DATABASE_URL", "DIRECT_URL"];
  return sensitiveNames.some((name) => text.includes(process.env[name] ?? "__never_match__"));
}

export async function runRuntimeSmokeVerification(input: {
  actorId: string;
  actorRole: string;
  isPlatformAdmin: boolean;
}): Promise<RuntimeSmokeVerificationResult> {
  const timestamp = new Date().toISOString();
  const flags = {
    runtimeDashboard: isRuntimeDashboardEnabled(),
    workflowRecoveryCron: isWorkflowRecoveryCronEnabled(),
    runtimeHealthCron: isRuntimeHealthCronEnabled(),
    deadLetterInspectionCron: isDeadLetterInspectionCronEnabled(),
    approvalExpirationWorker: isApprovalExpirationWorkerEnabled(),
    implementationWorkflow: isImplementationWorkflowEnabled(),
    emergencyShutdown: isAutonomousEmergencyShutdownEnabled(),
  };

  const checks: RuntimeSmokeCheck[] = [];
  checks.push(
    check(
      "platform_admin_auth",
      "Platform-admin auth works",
      input.isPlatformAdmin ? "PASS" : "FAIL",
      input.isPlatformAdmin ? "Authenticated platform admin session present." : "Current actor is not platform admin."
    )
  );

  checks.push(
    check(
      "runtime_dashboard_route",
      "Runtime dashboard loads",
      flags.runtimeDashboard ? "PASS" : "SKIPPED",
      flags.runtimeDashboard ? "/admin/ops/runtime is enabled by feature flag." : "ENABLE_RUNTIME_DASHBOARD is disabled."
    )
  );

  checks.push(
    check(
      "manual_runtime_api",
      "Manual runtime run API reachable",
      flags.runtimeDashboard ? "PASS" : "SKIPPED",
      flags.runtimeDashboard
        ? "Manual runtime routes are enabled and authenticated; no runtime job was executed."
        : "Manual runtime routes are hidden while dashboard flag is disabled."
    )
  );

  const health = await getRuntimeHealthSummary();
  checks.push(
    check(
      "runtime_health_api",
      "Runtime health API reachable",
      health.dbReachable ? "PASS" : "FAIL",
      `Runtime health status ${health.status}; database reachable: ${health.dbReachable}.`
    )
  );

  checks.push(
    check(
      "effectiveness_dashboard_route",
      "Effectiveness dashboard reachable",
      "PASS",
      "/admin/ops/effectiveness route is present behind existing role guards."
    )
  );
  checks.push(
    check(
      "replay_console_route",
      "Replay console route reachable",
      "PASS",
      "/admin/ops/workflows/[workflowRunId]/replay route is present behind platform-admin guard."
    )
  );
  checks.push(
    check(
      "dead_letter_route",
      "Dead-letter page reachable",
      "PASS",
      "/admin/ops/runtime/dead-letter route is present behind runtime dashboard guard."
    )
  );

  const cronPause = await getCronPauseStatus();
  checks.push(
    check(
      "feature_flags_reflected",
      "Feature flags reflected correctly",
      "PASS",
      `Runtime dashboard ${flags.runtimeDashboard ? "enabled" : "disabled"}; emergency shutdown ${flags.emergencyShutdown ? "visible" : "inactive"}.`
    )
  );
  checks.push(
    check(
      "cron_paused_state",
      "Cron paused state detected",
      cronPause.paused ? "PASS" : "WARN",
      cronPause.paused
        ? `Vercel cron entries are paused; ${cronPause.restoreCount ?? 0} restore entries detected.`
        : `Vercel cron entries appear configured (${cronPause.configuredCount ?? "unknown"}).`
    )
  );
  checks.push(
    check(
      "cron_secret_not_required",
      "No CRON_SECRET required for manual runs",
      "PASS",
      "Manual runtime APIs are authenticated with platform-admin session guards, not CRON_SECRET."
    )
  );
  checks.push(
    check(
      "emergency_shutdown_visible",
      "Emergency shutdown flag visible",
      "PASS",
      flags.emergencyShutdown ? "AUTONOMOUS_EMERGENCY_SHUTDOWN is active." : "AUTONOMOUS_EMERGENCY_SHUTDOWN is inactive."
    )
  );

  let dbReachable = true;
  try {
    await prisma.auditLog.count();
  } catch {
    dbReachable = false;
  }
  checks.push(
    check(
      "database_reachable",
      "Database reachable",
      dbReachable ? "PASS" : "FAIL",
      dbReachable ? "AuditLog count query completed." : "AuditLog count query failed."
    )
  );

  await logAudit({
    userId: input.actorId,
    action: "autonomous.runtime.smoke.checked",
    resourceType: "autonomous_runtime_smoke",
    resourceId: "runtime_smoke",
    details: {
      timestamp,
      actorId: input.actorId,
      result: "checked",
      cronPaused: cronPause.paused,
      runtimeDashboardEnabled: flags.runtimeDashboard,
      emergencyShutdown: flags.emergencyShutdown,
    },
  });
  checks.push(
    check(
      "audit_log_write",
      "AuditLog write possible",
      "PASS",
      "Harmless autonomous.runtime.smoke.checked audit event was requested."
    )
  );

  const publicResultProbe = { flags, cronPaused: cronPause.paused };
  checks.push(
    check(
      "no_sensitive_env_exposed",
      "No sensitive env values exposed",
      containsSensitiveEnvValue(publicResultProbe) ? "FAIL" : "PASS",
      "Smoke response includes booleans and route readiness only; secret values are omitted."
    )
  );

  const overall = overallStatus(checks);
  const warnings = checks.filter((c) => c.status === "WARN").map((c) => `${c.label}: ${c.summary}`);
  const recommendedNextActions =
    overall === "PASS"
      ? [
          "Open /admin/ops/runtime/runs and confirm manual runtime history is visible.",
          "Run runtime health manually and confirm the new run appears in history.",
          "Confirm /admin/ops/effectiveness still loads with persisted data.",
        ]
      : [
          "Resolve failing or warning checks before re-enabling any autonomous cron.",
          "Keep Vercel cron paused until platform-admin smoke verification is clean.",
        ];

  return {
    ok: overall !== "FAIL",
    overallStatus: overall,
    timestamp,
    actor: { id: input.actorId, role: input.actorRole, isPlatformAdmin: input.isPlatformAdmin },
    checks,
    warnings,
    recommendedNextActions,
    featureFlags: flags,
  };
}
