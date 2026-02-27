/**
 * lib/serverFlags.ts  Server-side-only runtime flags
 *
 * Read at call-time (NOT module load) so tests can mutate process.env
 * between assertions without needing vi.resetModules().
 *
 * NEVER use NEXT_PUBLIC_ prefixes here  those go in lib/featureFlags.ts.
 * NEVER import this file from client components.
 *
 * See docs/ops/FEATURE_FLAGS.md for the full flag catalogue.
 */

//  Ops Intelligence Flags (Block 5) 

export const SEVERITY_LEVELS = ["info", "warn", "critical"] as const;
export type FindingSeverity = (typeof SEVERITY_LEVELS)[number];

/**
 * Returns true if findingSeverity meets or exceeds minSeverity.
 * Unknown values are treated conservatively: unknown finding  info (0),
 * unknown min  warn (1) so nothing fires below warn by default.
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

//  Governance Flags (Block 6) 

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
 * DEFAULT OFF  safe by default. Must be explicitly set to "true".
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

//  AI Stabilization Flags (Block 10) 

/**
 * Student AI Tutor endpoint. DEFAULT OFF  must be explicitly enabled.
 * Set AI_TUTOR_ENABLED=true to activate.
 * When false, POST /api/student/tutor returns 404.
 */
export function isAiTutorEnabled(): boolean {
  return process.env.AI_TUTOR_ENABLED === "true";
}

/**
 * Teacher Support Assistant endpoint. DEFAULT OFF.
 * Set AI_TEACHER_ASSIST_ENABLED=true to activate.
 * When false, POST /api/teacher/assist returns 404.
 */
export function isAiTeacherAssistEnabled(): boolean {
  return process.env.AI_TEACHER_ASSIST_ENABLED === "true";
}

/** Max AI tutor calls per authenticated user per day. Default 20. */
export function getAiTutorDailyLimit(): number {
  const raw = parseInt(process.env.AI_TUTOR_DAILY_LIMIT ?? "20", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

/** Max teacher assist calls per teacher per day. Default 50. */
export function getAiTeacherAssistDailyLimit(): number {
  const raw = parseInt(process.env.AI_TEACHER_ASSIST_DAILY_LIMIT ?? "50", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

//  Block 12: Impact & Workflow Intelligence Flags 

/**
 * Master switch for impact analytics dashboard routes (school + national).
 * DEFAULT OFF. When false, all impact dashboard routes return 404.
 */
export function isImpactAnalyticsEnabled(): boolean {
  return process.env.ENABLE_IMPACT_ANALYTICS === "true";
}

/**
 * Enables persistent ImpactSnapshot storage after each impact computation.
 * DEFAULT OFF. When false, impact is computed on-the-fly only (no DB write).
 * When true, each GET /impact call stores a snapshot row for historical trend use.
 */
export function isImpactSnapshotsEnabled(): boolean {
  return process.env.ENABLE_IMPACT_SNAPSHOTS === "true";
}

/**
 * AI-powered tutor guidance embedded in assignment context (teacher-facing).
 * DEFAULT OFF. When false, POST /api/teacher/assignment/tutor returns 404.
 */
export function isAssignmentTutorEnabled(): boolean {
  return process.env.ENABLE_ASSIGNMENT_TUTOR === "true";
}

/**
 * AI-assisted grading feedback loop (teacher-facing, advisory only).
 * DEFAULT OFF. When false, POST /api/teacher/grading/assist returns 404.
 */
export function isAiGradingAssistEnabled(): boolean {
  return process.env.ENABLE_AI_GRADING_ASSIST === "true";
}

/**
 * Class-level intervention alert engine (aggregate signals, no student IDs).
 * DEFAULT OFF. When false, GET /api/admin/dashboard/school/interventions returns 404.
 */
export function isInterventionAlertsEnabled(): boolean {
  return process.env.ENABLE_INTERVENTION_ALERTS === "true";
}

/**
 * AI interventions recommendation engine (school + district).
 * DEFAULT OFF. When false, interventions endpoints return 404.
 */
export function isAiInterventionsEnabled(): boolean {
  return process.env.ENABLE_AI_INTERVENTIONS === "true";
}

/**
 * Intervention outcomes resolution + dashboard.
 * DEFAULT OFF. When false, outcomes endpoints return 404 and jobs noop.
 */
export function isInterventionOutcomesEnabled(): boolean {
  return process.env.ENABLE_INTERVENTION_OUTCOMES === "true";
}

/**
 * Optional AI enhancement for interventions (augment deterministic rules).
 * DEFAULT OFF. Requires OPENAI_API_KEY at request time.
 */
export function isAiInterventionsAiEnhanced(): boolean {
  return process.env.AI_INTERVENTIONS_AI_ENHANCED === "true";
}

/**
 * District intelligence dashboards (district aggregate views).
 * DEFAULT OFF. When false, district endpoints return 404.
 */
export function isDistrictIntelligenceEnabled(): boolean {
  return process.env.ENABLE_DISTRICT_INTELLIGENCE === "true";
}

/**
 * Monthly AI spend cap in USD. Default $100.
 * When cumulative estimatedCostUSD in AiInteractionLog for the current
 * calendar month reaches this value, all AI endpoints return 503 gracefully.
 * At 80% of cap an ai.budget.warning metric event is emitted.
 */
export function getAiBudgetMonthlyCap(): number {
  const raw = parseFloat(process.env.AI_BUDGET_MONTHLY_CAP_USD ?? "100");
  return Number.isFinite(raw) && raw > 0 ? raw : 100;
}

//  Block 21: Classroom Toolkit Flags 

/** Master gate for Classroom Toolkit. DEFAULT OFF. */
export function isClassroomToolkitEnabled(): boolean {
  return process.env.ENABLE_CLASSROOM_TOOLKIT === "true";
}

/** Calculator tools gate. DEFAULT OFF. */
export function isToolkitCalculatorEnabled(): boolean {
  return process.env.ENABLE_TOOLKIT_CALCULATOR === "true";
}

/** Science tools gate. DEFAULT OFF. */
export function isToolkitScienceToolsEnabled(): boolean {
  return process.env.ENABLE_TOOLKIT_SCIENCE_TOOLS === "true";
}

/** Geometry tools gate. DEFAULT OFF. */
export function isToolkitGeoToolsEnabled(): boolean {
  return process.env.ENABLE_TOOLKIT_GEO_TOOLS === "true";
}

/** Timer tool gate. DEFAULT OFF. */
export function isToolkitTimerEnabled(): boolean {
  return process.env.ENABLE_TOOLKIT_TIMER === "true";
}

/**
 * Longitudinal growth tracking (monthly snapshots).
 * DEFAULT OFF. When false, growth routes return 404.
 */
export function isLongitudinalTrackingEnabled(): boolean {
  return process.env.ENABLE_LONGITUDINAL_TRACKING === "true";
}

//  Block 16: Predictive Dropout Risk Flags

/** Master switch for dropout risk scoring routes. DEFAULT OFF. */
export function isDropoutRiskEnabled(): boolean {
  return process.env.ENABLE_DROPOUT_RISK === "true";
}

/**
 * Optional AI augmentation for dropout risk scoring (advisory only).
 * DEFAULT OFF. Requires explicit enable + audit/telemetry if used.
 */
export function isDropoutRiskAiEnabled(): boolean {
  return process.env.AI_DROPOUT_RISK_ENABLED === "true";
}



