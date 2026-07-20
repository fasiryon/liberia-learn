/**
 * lib/serverFlags.ts  Server-side-only runtime flags
 *
 * Read at call-time (NOT module load) so tests can mutate process.env
 * between assertions without needing vi.resetModules().
 *
 * Note: NEXT_PUBLIC_* flags are client-accessible environment variables
 * and are NOT listed here. See .env.example for the full flag reference
 * including NEXT_PUBLIC_ENABLE_AI_TUTOR.
 *
 * NEVER use NEXT_PUBLIC_ prefixes here  those go in lib/featureFlags.ts.
 * NEVER import this file from client components.
 *
 * See docs/ops/FEATURE_FLAGS.md for the full flag catalogue.
 */

//  Ops Intelligence Flags (Block 5) 

export const SEVERITY_LEVELS = ["info", "warn", "critical"] as const;
export type FindingSeverity = (typeof SEVERITY_LEVELS)[number];

import { isDemo } from "@/lib/environment";

/**
 * Shared boolean env-flag reader every isXEnabled() below routes through.
 * Always compares the trimmed value: `vercel env add` piped from `echo`
 * and dashboard copy/paste can silently append a trailing CRLF, and a bare
 * `=== "true"` / `!== "false"` comparison then fails even though the value
 * reads as "true"/"false" everywhere else (the AI tutor CRLF bug this
 * pattern is named after). Pass `defaultEnabled: true` for a DEFAULT ON
 * flag (unset or unrecognized value stays enabled, only explicit "false"
 * disables it); omit it for a DEFAULT OFF flag (only explicit "true"
 * enables it).
 */
function isFlagEnabled(name: string, defaultEnabled = false): boolean {
  const value = process.env[name]?.trim();
  if (value == null || value === "") return defaultEnabled;
  return defaultEnabled ? value !== "false" : value === "true";
}

function isEnabledInLocalDevByDefault(flagName: string): boolean {
  const value = process.env[flagName]?.trim();
  if (value != null && value !== "") return value === "true";
  return process.env.NODE_ENV !== "production";
}

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
  return isFlagEnabled("OPS_AI_EXPLANATIONS_ENABLED");
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
  return isFlagEnabled("ENABLE_GOV_EXPORTS", true);
}

/**
 * Allows PII fields (e.g. student names) in exports.
 * DEFAULT OFF  safe by default. Must be explicitly set to "true".
 * Requires platform-admin role AND this flag to export PII.
 */
export function isGovStudentPiiExportEnabled(): boolean {
  return isFlagEnabled("ENABLE_GOV_STUDENT_PII_EXPORT");
}

/**
 * Allows platform admins to request national-aggregate exports.
 * Default ON. Set to "false" to restrict to school-scope only.
 */
export function isGovNationalExportEnabled(): boolean {
  if (isGovCircuitBreakerTripped()) return false;
  return isFlagEnabled("ENABLE_GOV_NATIONAL_EXPORT", true);
}

/**
 * Enables the audit log search and CSV export UI for admins.
 * Default ON. Set to "false" to hide (useful during incident investigation).
 */
export function isGovAuditSearchEnabled(): boolean {
  if (isGovCircuitBreakerTripped()) return false;
  return isFlagEnabled("ENABLE_GOV_AUDIT_SEARCH", true);
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
  return isFlagEnabled("ENABLE_GOV_CIRCUIT_BREAKER");
}

//  AI Stabilization Flags (Block 10) 

/**
 * Student AI Tutor endpoint. DEFAULT OFF  must be explicitly enabled.
 * Set AI_TUTOR_ENABLED=true to activate.
 * When false, POST /api/student/tutor returns 404.
 */
export function isAiTutorEnabled(): boolean {
  return isFlagEnabled("AI_TUTOR_ENABLED");
}

/**
 * Teacher Support Assistant endpoint. DEFAULT OFF.
 * Set AI_TEACHER_ASSIST_ENABLED=true to activate.
 * When false, POST /api/teacher/assist returns 404.
 */
export function isAiTeacherAssistEnabled(): boolean {
  return isFlagEnabled("AI_TEACHER_ASSIST_ENABLED");
}

/** Max AI tutor calls per authenticated user per day. Default 20. */
export function getAiTutorDailyLimit(): number {
  const raw = parseInt(process.env.AI_TUTOR_DAILY_LIMIT ?? "20", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

/** RAG-grounded student tutor retrieval. DEFAULT OFF. */
export function isRagTutorEnabled(): boolean {
  return isFlagEnabled("ENABLE_RAG_TUTOR") || isFlagEnabled("NEXT_PUBLIC_ENABLE_RAG_TUTOR");
}

/** Eval run summary logging. DEFAULT OFF. */
export function isEvalDbLoggingEnabled(): boolean {
  return isFlagEnabled("ENABLE_EVAL_DB_LOGGING");
}

/** Teacher lesson generation and co-creation. DEFAULT OFF. */
export function isTeacherGenerationEnabled(): boolean {
  return isFlagEnabled("ENABLE_TEACHER_GENERATION");
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
  return isFlagEnabled("ENABLE_IMPACT_ANALYTICS");
}

/**
 * Enables persistent ImpactSnapshot storage after each impact computation.
 * DEFAULT OFF. When false, impact is computed on-the-fly only (no DB write).
 * When true, each GET /impact call stores a snapshot row for historical trend use.
 */
export function isImpactSnapshotsEnabled(): boolean {
  return isFlagEnabled("ENABLE_IMPACT_SNAPSHOTS");
}

/**
 * AI-powered tutor guidance embedded in assignment context (teacher-facing).
 * DEFAULT OFF. When false, POST /api/teacher/assignment/tutor returns 404.
 */
export function isAssignmentTutorEnabled(): boolean {
  return isFlagEnabled("ENABLE_ASSIGNMENT_TUTOR");
}

/**
 * AI-assisted grading feedback loop (teacher-facing, advisory only).
 * DEFAULT ON. When false, grading assist routes return 404.
 */
export function isAiGradingAssistEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_GRADING_ASSIST", true);
}

/** Teacher AI lesson planning. DEFAULT ON unless explicitly disabled. */
export function isTeacherAiPlanningEnabled(): boolean {
  return isFlagEnabled("ENABLE_TEACHER_AI_PLANNING", true);
}

/** Teacher-facing intervention alerts. DEFAULT ON unless explicitly disabled. */
export function isTeacherInterventionAlertsEnabled(): boolean {
  return isFlagEnabled("ENABLE_TEACHER_INTERVENTION_ALERTS", true);
}

/** Weekly teacher reports. DEFAULT ON unless explicitly disabled. */
export function isWeeklyTeacherReportsEnabled(): boolean {
  return isFlagEnabled("ENABLE_WEEKLY_TEACHER_REPORTS", true);
}

/** Student certificates and public verification. DEFAULT ON unless explicitly disabled. */
export function isCertificatesEnabled(): boolean {
  return isFlagEnabled("ENABLE_CERTIFICATES", true);
}

/** Canva-backed certificate generation. DEFAULT OFF. */
export function isCanvaCertificatesEnabled(): boolean {
  return isFlagEnabled("ENABLE_CANVA_CERTIFICATES");
}

/** Canva-backed MOE progress report generation. DEFAULT OFF. */
export function isCanvaMoeReportsEnabled(): boolean {
  return isFlagEnabled("ENABLE_CANVA_MOE_REPORTS");
}

/** Canva-backed course thumbnail automation. DEFAULT ON in local/dev, explicit in production. */
export function isCanvaCourseThumbnailsEnabled(): boolean {
  return isEnabledInLocalDevByDefault("ENABLE_CANVA_COURSE_THUMBNAILS");
}

/** Canva-backed school onboarding kit automation. DEFAULT ON in local/dev, explicit in production. */
export function isSchoolOnboardingKitsEnabled(): boolean {
  return isEnabledInLocalDevByDefault("ENABLE_SCHOOL_ONBOARDING_KITS");
}

/** Certification banner/video asset generation. DEFAULT ON in local/dev, explicit in production. */
export function isCertificationAssetGenerationEnabled(): boolean {
  return isEnabledInLocalDevByDefault("ENABLE_CERTIFICATION_ASSET_GENERATION");
}

/** Higgsfield video generation. DEFAULT ON in local/dev, explicit in production. */
export function isHiggsfieldVideoGenerationEnabled(): boolean {
  return isEnabledInLocalDevByDefault("ENABLE_HIGGSFIELD_VIDEO_GENERATION");
}

/** Computed student skill badges. DEFAULT ON unless explicitly disabled. */
export function isSkillBadgesEnabled(): boolean {
  return isFlagEnabled("ENABLE_SKILL_BADGES", true);
}

/** Deterministic exam readiness scoring. DEFAULT ON unless explicitly disabled. */
export function isExamReadinessEnabled(): boolean {
  return isFlagEnabled("ENABLE_EXAM_READINESS", true);
}

/** Lightweight future pathway hooks. DEFAULT ON unless explicitly disabled. */
export function isPathwayHooksEnabled(): boolean {
  return isFlagEnabled("ENABLE_PATHWAY_HOOKS", true);
}

/** MOE policy push tools. DEFAULT ON unless explicitly disabled. */
export function isMoePolicyPushEnabled(): boolean {
  return isFlagEnabled("ENABLE_MOE_POLICY_PUSH", true);
}

/** MOE directive governance workflow. DEFAULT ON unless explicitly disabled. */
export function isMoeGovernanceWorkflowEnabled(): boolean {
  return isFlagEnabled("ENABLE_MOE_GOVERNANCE_WORKFLOW", true);
}

/** Curriculum version standardization and drift summaries. DEFAULT ON unless explicitly disabled. */
export function isCurriculumVersionStandardizationEnabled(): boolean {
  return isFlagEnabled("ENABLE_CURRICULUM_VERSION_STANDARDIZATION", true);
}

/**
 * Class-level intervention alert engine (aggregate signals, no student IDs).
 * DEFAULT OFF. When false, GET /api/admin/dashboard/school/interventions returns 404.
 */
export function isInterventionAlertsEnabled(): boolean {
  return isFlagEnabled("ENABLE_INTERVENTION_ALERTS");
}

/**
 * AI interventions recommendation engine (school + district).
 * DEFAULT OFF. When false, interventions endpoints return 404.
 */
export function isAiInterventionsEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_INTERVENTIONS");
}

/**
 * Intervention outcomes resolution + dashboard.
 * DEFAULT OFF. When false, outcomes endpoints return 404 and jobs noop.
 */
export function isInterventionOutcomesEnabled(): boolean {
  return isFlagEnabled("ENABLE_INTERVENTION_OUTCOMES");
}

/**
 * Optional AI enhancement for interventions (augment deterministic rules).
 * DEFAULT OFF. Requires OPENAI_API_KEY at request time.
 */
export function isAiInterventionsAiEnhanced(): boolean {
  return isFlagEnabled("AI_INTERVENTIONS_AI_ENHANCED");
}

/**
 * District intelligence dashboards (district aggregate views).
 * DEFAULT OFF. When false, district endpoints return 404.
 */
export function isDistrictIntelligenceEnabled(): boolean {
  return isFlagEnabled("ENABLE_DISTRICT_INTELLIGENCE");
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

export function getAiBudgetDailyCap(): number {
  const raw = parseFloat(process.env.AI_BUDGET_DAILY_CAP_USD ?? "25");
  return Number.isFinite(raw) && raw > 0 ? raw : 25;
}

export function getAiTutorDailyBudgetUsd(): number {
  const raw = parseFloat(process.env.AI_TUTOR_DAILY_BUDGET_USD ?? "5");
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

export function getAiTeacherAssistDailyBudgetUsd(): number {
  const raw = parseFloat(process.env.AI_TEACHER_ASSIST_DAILY_BUDGET_USD ?? "10");
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

export function getAiGradingDailyBudgetUsd(): number {
  const raw = parseFloat(process.env.AI_GRADING_DAILY_BUDGET_USD ?? "8");
  return Number.isFinite(raw) && raw > 0 ? raw : 8;
}

export function getAiCurriculumDailyBudgetUsd(): number {
  const raw = parseFloat(process.env.AI_CURRICULUM_DAILY_BUDGET_USD ?? "20");
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

export function getAiLabsDailyBudgetUsd(): number {
  const raw = parseFloat(process.env.AI_LABS_DAILY_BUDGET_USD ?? "5");
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

/** Adaptive learning engine. DEFAULT ON. Set ENABLE_ADAPTIVE_ENGINE=false to disable. */
export function isAdaptiveEngineEnabled(): boolean {
  return isFlagEnabled("ENABLE_ADAPTIVE_ENGINE", true);
}

export function isConfusionDetectionEnabled(): boolean {
  return isFlagEnabled("ENABLE_CONFUSION_DETECTION");
}

/** Teacher intervention recommendation engine. DEFAULT ON. */
export function isInterventionEngineEnabled(): boolean {
  return isFlagEnabled("ENABLE_INTERVENTION_ENGINE", true);
}

export function isPerformanceEventsEnabled(): boolean {
  return isFlagEnabled("ENABLE_PERFORMANCE_EVENTS", true);
}

export function isPromptRegistryEnabled(): boolean {
  return isFlagEnabled("ENABLE_PROMPT_REGISTRY", true);
}

export function isAuditImmutabilityEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUDIT_IMMUTABILITY", true);
}

export function isTeacherIntelligenceDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_TEACHER_INTELLIGENCE_DASHBOARD", true);
}

export function isGuardianProgressViewEnabled(): boolean {
  return isFlagEnabled("ENABLE_GUARDIAN_PROGRESS_VIEW", true);
}

export function isPilotReadinessDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_PILOT_READINESS_DASHBOARD", true);
}

export function isPilotReadinessEnabled(): boolean {
  return isFlagEnabled("ENABLE_PILOT_READINESS", true);
}

/** Teacher intervention workflow actions. DEFAULT ON. */
export function isInterventionWorkflowEnabled(): boolean {
  return isFlagEnabled("ENABLE_INTERVENTION_WORKFLOW", true);
}

//  Block 21: Classroom Toolkit Flags 

/** Master gate for Classroom Toolkit. DEFAULT OFF. */
export function isClassroomToolkitEnabled(): boolean {
  return isFlagEnabled("ENABLE_CLASSROOM_TOOLKIT");
}

/** Calculator tools gate. DEFAULT OFF. */
export function isToolkitCalculatorEnabled(): boolean {
  return isFlagEnabled("ENABLE_TOOLKIT_CALCULATOR");
}

/** Science tools gate. DEFAULT OFF. */
export function isToolkitScienceToolsEnabled(): boolean {
  return isFlagEnabled("ENABLE_TOOLKIT_SCIENCE_TOOLS");
}

/** Geometry tools gate. DEFAULT OFF. */
export function isToolkitGeoToolsEnabled(): boolean {
  return isFlagEnabled("ENABLE_TOOLKIT_GEO_TOOLS");
}

/** Timer tool gate. DEFAULT OFF. */
export function isToolkitTimerEnabled(): boolean {
  return isFlagEnabled("ENABLE_TOOLKIT_TIMER");
}

/**
 * Longitudinal growth tracking (monthly snapshots).
 * DEFAULT OFF. When false, growth routes return 404.
 */
export function isLongitudinalTrackingEnabled(): boolean {
  return isFlagEnabled("ENABLE_LONGITUDINAL_TRACKING");
}

//  Block 16: Predictive Dropout Risk Flags

/** Master switch for dropout risk scoring routes. DEFAULT OFF. */
export function isDropoutRiskEnabled(): boolean {
  return isFlagEnabled("ENABLE_DROPOUT_RISK");
}

/**
 * Optional AI augmentation for dropout risk scoring (advisory only).
 * DEFAULT OFF. Requires explicit enable + audit/telemetry if used.
 */
export function isDropoutRiskAiEnabled(): boolean {
  return isFlagEnabled("AI_DROPOUT_RISK_ENABLED");
}

/**
 * Curriculum optimization loop (national strand weakness + emphasis advice).
 * DEFAULT OFF. When false, national curriculum signals endpoint returns 404.
 */
export function isCurriculumOptimizationEnabled(): boolean {
  return isFlagEnabled("ENABLE_CURRICULUM_OPTIMIZATION");
}

/**
 * Optional AI augmentation for curriculum optimization advisory summaries.
 * DEFAULT OFF. Deterministic strand ranking works regardless of this flag.
 */
export function isCurriculumOptimizationAiEnabled(): boolean {
  return isFlagEnabled("ENABLE_CURRICULUM_OPTIMIZATION_AI");
}

//  Block 19: Geo Intelligence Flags

/**
 * National geo-performance aggregates (county-level only).
 * DEFAULT OFF. When false, geo-performance endpoints return 404.
 */
export function isGeoIntelligenceEnabled(): boolean {
  return isFlagEnabled("ENABLE_GEO_INTELLIGENCE");
}

//  Block 20: National Insights Flags

/**
 * National insights dashboard aggregates (county-level + curriculum).
 * DEFAULT OFF. When false, national insights endpoint returns 404.
 */
export function isNationalInsightsEnabled(): boolean {
  return isFlagEnabled("ENABLE_NATIONAL_INSIGHTS");
}

//  Block RR-4: MOE Portal Flag + Allowlist

/** MOE/District portal. DEFAULT OFF. */
export function isMoePortalEnabled(): boolean {
  return isFlagEnabled("ENABLE_MOE_PORTAL");
}

/**
 * Dedicated MOE login portal at /moe/login.
 * DEFAULT OFF (development). Set ENABLE_MOE_LOGIN_PORTAL=true to activate.
 * When false: /moe/login redirects to /login; /moe/* routes are still protected.
 * Production default should be "true" — see docs/ENV_VARS.md.
 */
export function isMoeLoginPortalEnabled(): boolean {
  return isFlagEnabled("ENABLE_MOE_LOGIN_PORTAL");
}

/** Optional allowlist (comma-separated emails/domains). Empty = allow all. */
export function getMoePortalAllowlist(): string[] {
  const raw = process.env.MOE_PORTAL_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

//  Block RR-5: Demo Mode Flag

/** Demo mode master switch. DEFAULT OFF. */
export function isDemoModeEnabled(): boolean {
  return isDemo();
}

//  Block RR-2: Guardian Portal + Linking Flags

/** Guardian portal (UI + APIs). DEFAULT ON.
 *  Checks EITHER server or client var so both sides work with one env set.
 *  Set either ENABLE_GUARDIAN_PORTAL=false or NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL=false
 *  to hide the portal again.
 */
export function isGuardianPortalEnabled(): boolean {
  return (
    isFlagEnabled("ENABLE_GUARDIAN_PORTAL", true) &&
    isFlagEnabled("NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL", true)
  );
}

/** Guardian linking APIs (token acceptance + admin invites). DEFAULT ON. */
export function isGuardianLinkingEnabled(): boolean {
  return isFlagEnabled("ENABLE_GUARDIAN_LINKING", true);
}

/**
 * Guardian dashboard + messaging routes. DEFAULT ON.
 * Set ENABLE_GUARDIAN_DASHBOARD=false to disable.
 * When false, /api/guardian/dashboard and /api/guardian/messages return 404.
 */
export function isGuardianDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_GUARDIAN_DASHBOARD", true);
}

//  Block RR-1/RR-3: Enrollment Invites + Account Recovery Flags

/** Enrollment invite APIs (admin + teacher). DEFAULT OFF. */
export function isEnrollmentInvitesEnabled(): boolean {
  return isFlagEnabled("ENABLE_ENROLLMENT_INVITES");
}

/** Account recovery APIs (forgot/reset password). DEFAULT OFF. */
export function isAccountRecoveryEnabled(): boolean {
  return isFlagEnabled("ENABLE_ACCOUNT_RECOVERY");
}

//  AI Factory: Curriculum Feedback Loop (Gap 3)

/**
 * Enables structured telemetry capture on curriculum approval/rejection.
 * DEFAULT OFF. Set ENABLE_CURRICULUM_FEEDBACK=true to activate.
 * When enabled, approval and rejection events are written to CurriculumFeedback.
 * Telemetry failures never crash approval/rejection requests.
 */
export function isCurriculumFeedbackEnabled(): boolean {
  return isFlagEnabled("ENABLE_CURRICULUM_FEEDBACK");
}

// ─── Integrated Lesson Delivery Engine Flags (Parts 1–8) ───────────────────

/**
 * Part 1: AI-generated delivery profile embedded in CurriculumContent.
 * When ON, generateCurriculumPayload() requests and validates deliveryProfile.
 * DEFAULT OFF.
 */
export function isDeliveryProfileEnabled(): boolean {
  return isFlagEnabled("ENABLE_DELIVERY_PROFILE");
}

/**
 * Part 2: Lesson delivery tracking on ScheduledWork.
 * When ON, PATCH /api/teacher/schedule/[id]/deliver is active.
 * DEFAULT OFF.
 */
export function isLessonDeliveryTrackingEnabled(): boolean {
  return isFlagEnabled("ENABLE_LESSON_DELIVERY_TRACKING");
}

/**
 * Part 3: A/B block day pair auto-creation on scheduling.
 * When ON, scheduling a block_a/block_b lesson also creates the sibling day.
 * DEFAULT OFF.
 */
export function isAbBlockSchedulingEnabled(): boolean {
  return isFlagEnabled("ENABLE_AB_BLOCK_SCHEDULING");
}

/**
 * Part 4: Curriculum Unit grouping model and routes.
 * DEFAULT OFF.
 */
export function isUnitGroupingEnabled(): boolean {
  return isFlagEnabled("ENABLE_UNIT_GROUPING");
}

/**
 * Unit assembly layer for composing CurriculumUnit records from lesson artifacts.
 * DEFAULT OFF.
 */
export function isUnitAssemblyEnabled(): boolean {
  return isFlagEnabled("ENABLE_UNIT_ASSEMBLY");
}

/**
 * Textbook PDF compiler for assembled curriculum units.
 * DEFAULT ON.
 */
export function isTextbookCompilerEnabled(): boolean {
  return isFlagEnabled("ENABLE_TEXTBOOK_COMPILER", true);
}

/**
 * Part 5: Assignment/homework lesson linkage + auto-suggestions.
 * When ON, scheduling a lesson with an exit ticket creates an AssignmentSuggestion.
 * DEFAULT OFF.
 */
export function isAssignmentLessonLinkageEnabled(): boolean {
  return isFlagEnabled("ENABLE_ASSIGNMENT_LESSON_LINKAGE");
}

/**
 * Part 5: assignment draft generation.
 * This route is deterministic today and returns a draft only.
 * DEFAULT ON.
 */
export function isAiAssignmentGenerationEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_ASSIGNMENT_GENERATION", true);
}

/**
 * Part 6: Toolkit integration with lesson delivery.
 * When ON, GET /api/teacher/schedule/[id]/tools returns required/optional/contextual tools.
 * DEFAULT OFF.
 */
export function isToolkitLessonIntegrationEnabled(): boolean {
  return isFlagEnabled("ENABLE_TOOLKIT_LESSON_INTEGRATION");
}

/**
 * Part 7: Virtual lab system.
 * When ON, VirtualLab and LabSession routes are active, labs auto-matched on scheduling.
 * DEFAULT OFF.
 */
export function isVirtualLabsEnabled(): boolean {
  return isFlagEnabled("ENABLE_VIRTUAL_LABS");
}

/**
 * AI Labs V1 interactive simulations.
 * Separate from VirtualLab/LabSession assignment and submission flows.
 * DEFAULT OFF.
 */
export function isAiLabsEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_LABS");
}

/**
 * Part 8: MOE delivery compliance reporting.
 * When ON, GET /api/teacher/schedule enhanced week view + admin compliance report active.
 * DEFAULT OFF.
 */
export function isDeliveryComplianceReportingEnabled(): boolean {
  return isFlagEnabled("ENABLE_DELIVERY_COMPLIANCE_REPORTING");
}

/**
 * Sprint 5: exam generation, delivery, grading, and certification flows.
 * Fail-closed: must be explicitly enabled.
 */
export function isExamSystemEnabled(): boolean {
  return isFlagEnabled("ENABLE_EXAM_SYSTEM");
}

/**
 * Sprint 5: Live SMS sending gate.
 * DEFAULT OFF — when not "true", all SMS is routed through DryRunSMSProvider
 * which logs the intended send without contacting any external API.
 * Set ENABLE_LIVE_SMS=true in production to activate real delivery via
 * Africa's Talking or Twilio (whichever provider credentials are present).
 */
export function isLiveSmsEnabled(): boolean {
  return isFlagEnabled("ENABLE_LIVE_SMS");
}

// ─── Trust, Cost, and Onboarding Sprint Flags ────────────────────────────────

/**
 * AI trust indicator layer (confidence badge + grounding details on AI outputs).
 * DEFAULT OFF. Set ENABLE_AI_TRUST_INDICATORS=true to activate.
 * When enabled, AI tutor and teacher assist responses include trust metadata.
 */
export function isAiTrustIndicatorsEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_TRUST_INDICATORS");
}

/**
 * AI cost monitoring dashboard for school admins and platform admins.
 * DEFAULT ON. Set ENABLE_AI_COST_DASHBOARD=false to hide.
 */
export function isAiCostDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_COST_DASHBOARD", true);
}

/**
 * Polished role-specific onboarding checklists and welcome panels.
 * DEFAULT ON. Set ENABLE_ROLE_ONBOARDING_POLISH=false to hide.
 */
export function isRoleOnboardingPolishEnabled(): boolean {
  return isFlagEnabled("ENABLE_ROLE_ONBOARDING_POLISH", true);
}

/**
 * Teacher training center. DEFAULT ON unless explicitly disabled.
 * Supports the legacy NEXT_PUBLIC_ENABLE_TRAINING_CENTER flag, but reads it
 * through the server flag helper so Vercel CRLF values are trimmed.
 */
export function isTrainingCenterEnabled(): boolean {
  return (
    isFlagEnabled("ENABLE_TRAINING_CENTER", true) &&
    isFlagEnabled("NEXT_PUBLIC_ENABLE_TRAINING_CENTER", true)
  );
}

// Pipeline cost tracking flags

/** Daily TTS audio budget in USD. Default $5. Set TTS_DAILY_BUDGET_USD. */
export function getTtsDailyBudgetUsd(): number {
  const raw = parseFloat(process.env.TTS_DAILY_BUDGET_USD ?? "5");
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

/** Monthly TTS audio cap in USD. Default $100. Set TTS_MONTHLY_CAP_USD. */
export function getTtsMonthlyCapUsd(): number {
  const raw = parseFloat(process.env.TTS_MONTHLY_CAP_USD ?? "100");
  return Number.isFinite(raw) && raw > 0 ? raw : 100;
}

/**
 * Emergency stop for TTS audio generation. DEFAULT OFF.
 * Set TTS_STOP_GENERATION=true to halt all new audio job claims.
 * PENDING rows remain intact — nothing is deleted or failed.
 */
export function isTtsGenerationStopped(): boolean {
  return isFlagEnabled("TTS_STOP_GENERATION");
}

/** Pipeline cost dashboard. DEFAULT ON. Set ENABLE_COST_DASHBOARD=false to hide. */
export function isCostDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_COST_DASHBOARD", true);
}

/**
 * AI quality/safety evaluation dashboard (Sprint 6.8) for platform admins.
 * DEFAULT ON. Set ENABLE_AI_QUALITY_DASHBOARD=false to hide.
 */
export function isAiQualityDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_AI_QUALITY_DASHBOARD", true);
}

/**
 * Queue-driven NEEDS_REVIEW curriculum regeneration. DEFAULT OFF.
 * Scripts may still perform dry-run planning while this is off, but worker
 * enqueues and job processing are gated to prevent accidental production runs.
 */
export function isCurriculumRegenQueueEnabled(): boolean {
  return isFlagEnabled("ENABLE_CURRICULUM_REGEN_QUEUE");
}

// Autonomous OS Phase 2: recommend-only deterministic detectors.
// All default OFF in production; these gates never enable direct action execution.
export function isDetectorExecutionEnabled(): boolean {
  return isFlagEnabled("ENABLE_DETECTOR_EXECUTION");
}

export function isDetectorRecommendationGenerationEnabled(): boolean {
  return isFlagEnabled("ENABLE_DETECTOR_RECOMMENDATIONS");
}

export function isDetectorMoeAggregationEnabled(): boolean {
  return isFlagEnabled("ENABLE_DETECTOR_MOE_AGGREGATION");
}

export function isGuardianRecommendationsEnabled(): boolean {
  return isFlagEnabled("ENABLE_GUARDIAN_RECOMMENDATIONS");
}

export function isNationalTrendAnalysisEnabled(): boolean {
  return isFlagEnabled("ENABLE_NATIONAL_TREND_ANALYSIS");
}

// Autonomous OS Phase 3: approval-gated actions. Default OFF.
export function isActionGovernanceEnabled(): boolean {
  return isFlagEnabled("ENABLE_ACTION_GOVERNANCE");
}

export function isActionExecutionEnabled(): boolean {
  return isFlagEnabled("ENABLE_ACTION_EXECUTION");
}

export function isAutonomousRecommendOnlyModeEnabled(): boolean {
  return isFlagEnabled("FORCE_AUTONOMOUS_RECOMMEND_ONLY", true);
}

// Autonomous OS Phase 4: governed low-risk execution pilots and hardening.
// Defaults remain OFF/fail-closed unless explicitly enabled.
export function isLowRiskAutonomyEnabled(): boolean {
  return isFlagEnabled("ENABLE_LOW_RISK_AUTONOMY");
}

export function isAutonomousEmergencyShutdownEnabled(): boolean {
  return isFlagEnabled("AUTONOMOUS_EMERGENCY_SHUTDOWN");
}

export function isAutonomousDegradedModeEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUTONOMOUS_DEGRADED_MODE");
}

export function isApprovalExpirationWorkerEnabled(): boolean {
  return isFlagEnabled("ENABLE_APPROVAL_EXPIRATION_WORKER");
}

export function isActionRollbackEnabled(): boolean {
  return isFlagEnabled("ENABLE_ACTION_ROLLBACK");
}

// Autonomous OS Phase 5: evaluation and memory-safe learning loops.
// Evaluation is read/append-only; memory writes and retrieval remain gated.
export function isAutonomousEvaluationEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUTONOMOUS_EVALUATION");
}

export function isAutonomousMemoryEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUTONOMOUS_MEMORY");
}

// Autonomous OS Phase 13: read/append-only product signal integration.
// Default ON; set false to stop new product LearningEvent signal writes.
export function isAutonomousSignalIntegrationEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUTONOMOUS_SIGNAL_INTEGRATION", true);
}

// Autonomous OS Phase 14: governance-safe predictive intelligence.
// Default OFF for rollout safety. Forecast retrieval remains read-only; outcome writes
// are explicit and append-only when enabled.
export function isPredictiveIntelligenceEnabled(): boolean {
  return isFlagEnabled("ENABLE_PREDICTIVE_INTELLIGENCE");
}

// Autonomous OS Phase 15: human review workflow for predictions.
// Requires predictive intelligence and remains recommendation/outcome-recording only.
export function isPredictionReviewWorkflowEnabled(): boolean {
  return isPredictiveIntelligenceEnabled() && isFlagEnabled("ENABLE_PREDICTION_REVIEW_WORKFLOW", true);
}

export function isFalsePositiveReviewEnabled(): boolean {
  return isFlagEnabled("ENABLE_FALSE_POSITIVE_REVIEW");
}

// Autonomous OS Phase 6: governance-safe optimization proposals.
// Optimization is recommendation-only; no detector/policy/risk mutation occurs here.
export function isAutonomousOptimizationEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUTONOMOUS_OPTIMIZATION");
}

// Autonomous OS Phase 7: governed implementation workflow for approved optimization proposals.
// Enables the change-request → sign-off → staged-rollout → rollback-verification → post-change-eval path.
// Default OFF; must not be enabled until all downstream rollout infrastructure is validated.
export function isImplementationWorkflowEnabled(): boolean {
  return isFlagEnabled("ENABLE_IMPLEMENTATION_WORKFLOW");
}

// Autonomous OS Phase 9: Production Runtime Wiring
// All default OFF; enable per environment after infrastructure is validated.

/** Master gate for all autonomous OS cron endpoints. DEFAULT OFF. */
export function isAutonomousCronEnabled(): boolean {
  return isFlagEnabled("ENABLE_AUTONOMOUS_CRON");
}

/** Enables stuck-workflow detection and recovery cron. DEFAULT OFF. */
export function isWorkflowRecoveryCronEnabled(): boolean {
  return isFlagEnabled("ENABLE_WORKFLOW_RECOVERY_CRON");
}

/** Enables dead-letter inspection cron (read-only scan + audit log). DEFAULT OFF. */
export function isDeadLetterInspectionCronEnabled(): boolean {
  return isFlagEnabled("ENABLE_DEAD_LETTER_INSPECTION_CRON");
}

/** Enables runtime health snapshot writes via cron. DEFAULT OFF. */
export function isRuntimeHealthCronEnabled(): boolean {
  return isFlagEnabled("ENABLE_RUNTIME_HEALTH_CRON");
}

/** Enables the /admin/ops/runtime dashboard pages. DEFAULT ON. */
export function isRuntimeDashboardEnabled(): boolean {
  return isFlagEnabled("ENABLE_RUNTIME_DASHBOARD", true);
}

// Autonomous OS Phase 10: Replay Console + Incident Investigation UI
// All default ON (investigation tools are safe read/write-only).

/** Enables replay console and incident investigation UI. DEFAULT ON. */
export function isReplayConsoleEnabled(): boolean {
  return isFlagEnabled("ENABLE_REPLAY_CONSOLE", true);
}

/**
 * Agent platform scheduler/goal tick cron. DEFAULT OFF.
 * Set AGENT_CRON_ENABLED=true to let the tick endpoint advance goals and run
 * scheduled agents. No user-facing agent ships yet, so this stays off in prod.
 */
export function isAgentCronEnabled(): boolean {
  return isFlagEnabled("AGENT_CRON_ENABLED");
}
