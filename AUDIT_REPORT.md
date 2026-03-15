# Audit Report Pre-Sprint-6

Method note: route coverage was inferred from direct route/path references plus matching route-specific test names/content under `__tests__/`. Stub findings were filtered to direct bare returns, hardcoded demo data, and production `console.log` usage to avoid flooding the report with ordinary guard clauses.

## Audit 1: Ghost Routes

Summary: 144 tested, 16 untested.

Findings:

- `MEDIUM` UNTESTED: `app/api/admin/attach-demo-school/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/guardian-link/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/notifications/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/onboarding/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/pilot-score/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/school-branding/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/school-settings/route.ts`
- `MEDIUM` UNTESTED: `app/api/admin/seed-demo/route.ts`
- `MEDIUM` UNTESTED: `app/api/homework/latest/route.ts`
- `MEDIUM` UNTESTED: `app/api/platform/demo/advance-day/route.ts`
- `MEDIUM` UNTESTED: `app/api/platform/demo/simulate-activity/route.ts`
- `MEDIUM` UNTESTED: `app/api/platform/reports/route.ts`
- `MEDIUM` UNTESTED: `app/api/platform/security/accept/route.ts`
- `MEDIUM` UNTESTED: `app/api/platform/security/demote/route.ts`
- `MEDIUM` UNTESTED: `app/api/platform/security/transfer/route.ts`
- `MEDIUM` UNTESTED: `app/api/submissions/create/route.ts`

All other `app/api/**/route.ts` files had at least one matching test reference under `__tests__/`.

## Audit 2: Stub Detection

Summary: 30 filtered findings.

Findings:

- `CRITICAL` `app/api/admin/attach-demo-school/route.ts:5` hardcoded demo identifier: `const DEMO_SCHOOL_ID = "demo-school-monrovia";`
- `CRITICAL` `app/api/admin/attach-demo-school/route.ts:69` hardcoded/demo response payload: `return NextResponse.json({ ok: true, schoolId: DEMO_SCHOOL_ID, logs });`
- `CRITICAL` `app/api/admin/seed-demo/route.ts:5` hardcoded demo identifier: `const DEMO_SCHOOL_ID = "demo-school-monrovia";`
- `HIGH` `app/api/admin/notifications/route.ts:26` direct object return from route: `return NextResponse.json({ logs });`
- `HIGH` `app/api/notifications/log/route.ts:20` direct object return from route: `return NextResponse.json({ logs });`
- `HIGH` `app/api/platform/security/demote/route.ts:33` hardcoded success payload: `return NextResponse.json({ ok: true, demoted: true });`
- `HIGH` `app/api/moe/placements/route.ts:14` bare null return: `return null;`
- `HIGH` `app/api/admin/dashboard/school/intervention-outcomes/route.ts:37` bare null return: `return null;`
- `HIGH` `app/api/teacher/labs/sessions/[sessionId]/route.ts:29` bare null return: `return null;`
- `HIGH` `app/api/teacher/labs/sessions/[sessionId]/route.ts:33` bare null return: `return null;`
- `HIGH` `app/api/teacher/labs/sessions/[sessionId]/route.ts:44` bare null return: `return null;`
- `HIGH` `app/api/teacher/labs/sessions/[sessionId]/route.ts:49` bare null return: `return null;`
- `HIGH` `lib/ai/interventions/recommendationEngine.ts:152` bare null return: `return null;`
- `HIGH` `lib/ai/teacher/teacherAssist.ts:124` bare null return: `return null;`
- `HIGH` `lib/ai/teacher/teacherAssist.ts:131` bare null return: `return null;`
- `HIGH` `lib/ai/teacher/teacherAssist.ts:133` bare null return: `return null;`
- `HIGH` `lib/ai/tutor/studentTutor.ts:171` bare null return: `return null;`
- `HIGH` `lib/ai/units/unitAssembler.ts:595` bare null return: `return null;`
- `HIGH` `lib/ai/units/unitAssembler.ts:604` bare null return: `return null;`
- `HIGH` `lib/workflows/ai/assignmentTutor.ts:106` bare null return: `return null;`
- `HIGH` `lib/workflows/ai/gradingAssist.ts:190` bare null return: `return null;`
- `MEDIUM` `lib/metrics/events.ts:76` empty object return: `return {};`
- `MEDIUM` `lib/reporting/training/index.ts:43` empty object return: `return {};`
- `MEDIUM` `lib/toolkit/toolRegistry.ts:267` bare null return: `return null;`
- `MEDIUM` `lib/toolkit/useToolkitContext.ts:48` bare null return: `return null;`
- `MEDIUM` `lib/trackEvent.ts:48` bare null return: `return null;`
- `LOW` `app/api/health/db/route.ts:24` production logging left in route: `console.log("[health/db] connection info:", JSON.stringify(conn));`
- `LOW` `lib/email.ts:15` production logging left in service: `console.log(\`[EMAIL-DEV] To: \${to} | Subject: \${subject}\`);`
- `LOW` `lib/email.ts:16` production logging left in service: `console.log(html);`
- `LOW` `lib/logger.ts:28` production logging left in logger: `console.log(\`[\${level.toUpperCase()}]\`, message, metadata);`
- `LOW` `lib/logger.ts:38` production logging left in logger: `console.log("Would log to DB:", logData);`
- `LOW` `lib/logging/requestLogger.ts:65` production logging left in request logger: `console.log("[REQUEST]", json);`
- `LOW` `lib/logging/requestLogger.ts:67` production logging left in request logger: `console.log(json);`
- `LOW` `lib/moe/alignment-engine.ts:220` production logging left in MOE alignment engine: `console.log(`
- `LOW` `lib/sms/twilio-provider.ts:22` production logging left in SMS provider: `console.log(\`[SMS-DEV] To: \${input.to} | Body: \${input.body}\`);`
- `LOW` `lib/sms/twilio-provider.ts:27` production logging left in SMS provider: `console.log(\`[SMS-DEV] To: \${input.to} | Body: \${input.body}\`);`

## Audit 3: Dead Service Detection

Summary: 39 exported functions appear unimported in `app/`, `lib/`, or `scripts/`.

Findings:

- `LOW` DEAD: `lib/accessibilityMode.ts > readA11yMode`
- `LOW` DEAD: `lib/accessibilityMode.ts > writeA11yMode`
- `LOW` DEAD: `lib/accessibilityMode.ts > applyA11yMode`
- `LOW` DEAD: `lib/auth-helpers.ts > requireAuth`
- `LOW` DEAD: `lib/branding.ts > getSchoolBranding`
- `LOW` DEAD: `lib/featureFlags.ts > isFeatureEnabled`
- `LOW` DEAD: `lib/offline-cache.ts > configureCacheLifecycle`
- `LOW` DEAD: `lib/offline-cache.ts > cachePack`
- `LOW` DEAD: `lib/offline-cache.ts > getCachedPack`
- `LOW` DEAD: `lib/offline-cache.ts > invalidatePack`
- `LOW` DEAD: `lib/offline-queue.ts > addToQueue`
- `LOW` DEAD: `lib/offline-queue.ts > getConflicts`
- `LOW` DEAD: `lib/offline-queue.ts > discardConflicts`
- `LOW` DEAD: `lib/offline-queue.ts > isOnline`
- `LOW` DEAD: `lib/onboarding.ts > getNextStep`
- `LOW` DEAD: `lib/onboarding.ts > readOnboardingState`
- `LOW` DEAD: `lib/onboarding.ts > writeOnboardingStep`
- `LOW` DEAD: `lib/onboarding.ts > writeOnboardingDismissed`
- `LOW` DEAD: `lib/onboarding.ts > resetOnboarding`
- `LOW` DEAD: `lib/progress-helpers.ts > computeStreak`
- `LOW` DEAD: `lib/progress-helpers.ts > groupBySubject`
- `LOW` DEAD: `lib/safe-logout.ts > safeLogout`
- `LOW` DEAD: `lib/schedule-helpers.ts > formatScheduleDate`
- `LOW` DEAD: `lib/serverFlags.ts > severityMeetsThreshold`
- `LOW` DEAD: `lib/serverFlags.ts > isOpsAiEnabled`
- `LOW` DEAD: `lib/serverFlags.ts > getOpsAiMinSeverity`
- `LOW` DEAD: `lib/serverFlags.ts > isGovStudentPiiExportEnabled`
- `LOW` DEAD: `lib/serverFlags.ts > isInterventionAlertsEnabled`
- `LOW` DEAD: `lib/serverFlags.ts > isDropoutRiskAiEnabled`
- `LOW` DEAD: `lib/tenant.ts > requireTenantOrPlatformAdmin`
- `LOW` DEAD: `lib/adaptive/practiceGenerator.ts > generateTargetedPractice`
- `LOW` DEAD: `lib/ai/homework-grader.ts > gradeHomeworkSubmission`
- `LOW` DEAD: `lib/ai/rubric-generator.ts > generateHomeworkRubric`
- `LOW` DEAD: `lib/ai/rubric-generator.ts > gradeSubmissionWithRubric`
- `LOW` DEAD: `lib/ai/metrics/aiCorrelationLog.ts > scheduleAiCorrelationCheck`
- `LOW` DEAD: `lib/toolkit/toolkitTelemetry.ts > emitToolOpened`
- `LOW` DEAD: `lib/toolkit/toolkitTelemetry.ts > emitToolClosed`
- `LOW` DEAD: `lib/toolkit/toolkitTelemetry.ts > emitToolkitRendered`
- `LOW` DEAD: `lib/toolkit/useToolkitContext.ts > useToolkitContext`

## Audit 4: Feature Flag Consistency

Summary: 19 inconsistent flag definitions.

Findings:

- `LOW` UNUSED, UNTESTED: `isOpsAiEnabled` (`OPS_AI_EXPLANATIONS_ENABLED`)
- `LOW` UNUSED, UNTESTED: `getOpsAiMinSeverity` (`OPS_AI_MIN_SEVERITY`)
- `LOW` UNUSED, TESTED: `isGovStudentPiiExportEnabled` (`ENABLE_GOV_STUDENT_PII_EXPORT`)
- `LOW` UNUSED, TESTED: `isRagTutorEnabled` (`ENABLE_RAG_TUTOR`)
- `LOW` UNUSED, UNTESTED: `isInterventionAlertsEnabled` (`ENABLE_INTERVENTION_ALERTS`)
- `LOW` UNUSED, TESTED: `isClassroomToolkitEnabled` (`ENABLE_CLASSROOM_TOOLKIT`)
- `LOW` UNUSED, TESTED: `isToolkitCalculatorEnabled` (`ENABLE_TOOLKIT_CALCULATOR`)
- `LOW` UNUSED, TESTED: `isToolkitScienceToolsEnabled` (`ENABLE_TOOLKIT_SCIENCE_TOOLS`)
- `LOW` UNUSED, TESTED: `isToolkitGeoToolsEnabled` (`ENABLE_TOOLKIT_GEO_TOOLS`)
- `LOW` UNUSED, TESTED: `isToolkitTimerEnabled` (`ENABLE_TOOLKIT_TIMER`)
- `LOW` UNUSED, UNTESTED: `isDropoutRiskAiEnabled` (`AI_DROPOUT_RISK_ENABLED`)
- `LOW` UNUSED, TESTED: `isCurriculumOptimizationAiEnabled` (`ENABLE_CURRICULUM_OPTIMIZATION_AI`)
- `LOW` UNUSED, TESTED: `isDeliveryProfileEnabled` (`ENABLE_DELIVERY_PROFILE`)
- `LOW` UNUSED, UNTESTED: `ENABLE_ENROLLMENT_INVITES` (`NEXT_PUBLIC_ENABLE_ENROLLMENT_INVITES`)
- `LOW` UNUSED, UNTESTED: `ENABLE_ACCOUNT_RECOVERY` (`NEXT_PUBLIC_ENABLE_ACCOUNT_RECOVERY`)
- `LOW` UNUSED, UNTESTED: `ENABLE_MASTERY_ENGINE` (`NEXT_PUBLIC_ENABLE_MASTERY_ENGINE`)
- `MEDIUM` USED, UNTESTED: `ENABLE_GUARDIAN_PORTAL` (`NEXT_PUBLIC_ENABLE_GUARDIAN_PORTAL`)
- `LOW` USED, TESTED, UNDOCUMENTED: `isAdaptiveEngineEnabled` (`ENABLE_ADAPTIVE_ENGINE`)
- `LOW` USED, TESTED, UNDOCUMENTED: `isExamSystemEnabled` (`ENABLE_EXAM_SYSTEM`)

## Audit 5: Route/Auth Consistency

Summary: 31 non-public API routes have no direct `requireRole()`, `getToken()`, `getServerSession()`, or `requireAuth()` call in the route handler file.

Findings:

- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/curriculum/textbook/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/curriculum/units/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/dashboard/national/impact/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/national/curriculum-signals/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/national/geo-performance/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/national/insights/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/admin/placements/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/demo/reset/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/guardian/register/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/health/db/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/homework/[id]/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/homework/latest/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/moe/curriculum-health/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/moe/dashboard/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/moe/delivery-compliance/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/moe/intervention-impact/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/moe/placements/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/moe/standards-coverage/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/demo/advance-day/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/demo/reset/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/demo/simulate-activity/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/reports/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/schools/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/security/accept/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/security/demote/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/security/transfer/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/platform/stats/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/rollout/invite/teacher/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/student/tutor/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/submissions/create/route.ts`
- `CRITICAL` NO AUTH CHECK IN ROUTE: `app/api/submissions/route.ts`
