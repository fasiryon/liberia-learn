/**
 * lib/serverFlags.ts — Server-side-only runtime flags
 *
 * Read at call-time (NOT module load) so tests can mutate process.env
 * between assertions without needing vi.resetModules().
 *
 * NEVER use NEXT_PUBLIC_ prefixes here — those go in lib/featureFlags.ts.
 * NEVER import this file from client components.
 *
 * See docs/ops/FEATURE_FLAGS.md for the full flag catalogue.
 */

// ── Ops Intelligence Flags (Block 5) ─────────────────────────────────────────

export const SEVERITY_LEVELS = ["info", "warn", "critical"] as const;
export type FindingSeverity = (typeof SEVERITY_LEVELS)[number];

/**
 * Returns true if findingSeverity meets or exceeds minSeverity.
 * Unknown values are treated conservatively: unknown finding → info (0),
 * unknown min → warn (1) so nothing fires below warn by default.
 */
export function severityMeetsThreshold(
  findingSeverity: string,
  minSeverity: string
): boolean {
  const fi = SEVERITY_LEVELS.indexOf(findingSeverity as FindingSeverity);
  const mi = SEVERITY_LEVELS.indexOf(minSeverity as FindingSeverity);
  return (fi === -1 ? 0 : fi) >= (mi === -1 ? 1 : mi);
}

/** Ops AI explanations endpoint. Default OFF (must be explicitly enabled). */
export function isOpsAiEnabled(): boolean {
  return process.env.OPS_AI_EXPLANATIONS_ENABLED === "true";
}

/** Minimum severity for AI explanation requests. Default "warn". */
export function getOpsAiMinSeverity(): FindingSeverity {
  const raw = process.env.OPS_AI_MIN_SEVERITY ?? "warn";
  return SEVERITY_LEVELS.includes(raw as FindingSeverity)
    ? (raw as FindingSeverity)
    : "warn";
}

// ── Governance Flags (Block 6) ────────────────────────────────────────────────

/**
 * Master switch for all governance export routes (student performance,
 * class summary, monthly report). Default ON.
 * Set ENABLE_GOV_EXPORTS=false to disable all at once (circuit breaker).
 */
export function isGovExportsEnabled(): boolean {
  if (isGovCircuitBreakerTripped()) return false;
  return process.env.ENABLE_GOV_EXPORTS !== "false";
}

/**
 * Allows PII fields (e.g. student names) in exports.
 * DEFAULT OFF — safe by default. Must be explicitly set to "true".
 * Requires platform-admin role AND this flag to export PII.
 */
export function isGovStudentPiiExportEnabled(): boolean {
  return process.env.ENABLE_GOV_STUDENT_PII_EXPORT === "true";
}

/**
 * Allows platform admins to request national-aggregate exports.
 * Default ON. Set to "false" to restrict to school-scope only.
 */
export function isGovNationalExportEnabled(): boolean {
  if (isGovCircuitBreakerTripped()) return false;
  return process.env.ENABLE_GOV_NATIONAL_EXPORT !== "false";
}

/**
 * Enables the audit log search and CSV export UI for admins.
 * Default ON. Set to "false" to hide (useful during incident investigation).
 */
export function isGovAuditSearchEnabled(): boolean {
  if (isGovCircuitBreakerTripped()) return false;
  return process.env.ENABLE_GOV_AUDIT_SEARCH !== "false";
}

// ── Performance Dashboard (Block 9) ─────────────────────────────────────────

/**
 * Enables the National + School Performance Dashboard endpoints.
 * Default OFF — must be explicitly set to "true".
 * When false, both /api/admin/dashboard/school and /api/admin/dashboard/national
 * return 404 (not 403) to avoid disclosing their existence.
 */
export function isPerformanceDashboardEnabled(): boolean {
  return process.env.ENABLE_PERFORMANCE_DASHBOARD === "true";
}

/**
 * Emergency circuit breaker for the entire governance subsystem.
 * When ENABLE_GOV_CIRCUIT_BREAKER=true, ALL governance exports and audit
 * search are disabled regardless of individual flag settings.
 *
 * Use this as a single kill switch during security incidents.
 * DEFAULT false (circuit is normally OPEN = not tripped).
 */
export function isGovCircuitBreakerTripped(): boolean {
  return process.env.ENABLE_GOV_CIRCUIT_BREAKER === "true";
}
