# LiberiaLearn Intelligence Flow

## Scope

This document describes the currently implemented intelligence loop used for teacher, guardian, admin, and pilot-readiness surfaces.

## 1. Event Capture

Performance events enter the intelligence layer through:
- [lib/intelligence/recordPerformanceEvent.ts](C:\Users\fasir\liberia-learn\lib\intelligence\recordPerformanceEvent.ts)

This path records student learning activity without bypassing tenant context.

## 2. Confusion Detection

Confusion detection is implemented in:
- [lib/intelligence/confusionDetector.ts](C:\Users\fasir\liberia-learn\lib\intelligence\confusionDetector.ts)

Its output feeds `ConfusionSignal` records that are later surfaced to teacher-facing views and intervention logic.

## 3. Intervention Generation

The intervention engine is implemented in:
- [lib/intelligence/interventionEngine.ts](C:\Users\fasir\liberia-learn\lib\intelligence\interventionEngine.ts)

Current behavior:
- consumes confusion signals
- checks whether the intervention feature flag is enabled
- creates advisory `InterventionRecommendation` records when thresholds are met
- never auto-applies grades or curriculum mutations

## 4. Aggregation

Performance summary aggregation lives in:
- [lib/intelligence/performanceAggregator.ts](C:\Users\fasir\liberia-learn\lib\intelligence\performanceAggregator.ts)

Implemented summaries include:
- student summary
- class summary
- subject summary

## 5. Teacher Surfaces

Teacher-facing intelligence routes:
- [app/api/teacher/performance/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\performance\route.ts)
- [app/api/teacher/confusions/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\confusions\route.ts)
- [app/api/teacher/interventions/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\interventions\route.ts)
- [app/api/teacher/intelligence/[studentId]/route.ts](C:\Users\fasir\liberia-learn\app\api\teacher\intelligence\[studentId]\route.ts)

Teacher UI surfaces:
- [app/teacher/intelligence/TeacherIntelligenceDashboard.tsx](C:\Users\fasir\liberia-learn\app\teacher\intelligence\TeacherIntelligenceDashboard.tsx)
- [components/intelligence/TeacherDashboardScreen.tsx](C:\Users\fasir\liberia-learn\components\intelligence\TeacherDashboardScreen.tsx)
- [components/intelligence/TeacherStudentIntelligenceScreen.tsx](C:\Users\fasir\liberia-learn\components\intelligence\TeacherStudentIntelligenceScreen.tsx)

Advisory-only action suggestions are implemented through:
- [lib/intelligence/advisoryActions.ts](C:\Users\fasir\liberia-learn\lib\intelligence\advisoryActions.ts)

## 6. Guardian Surface

Guardian-safe shaping is implemented in:
- [app/api/guardian/performance/route.ts](C:\Users\fasir\liberia-learn\app\api\guardian\performance\route.ts)
- [components/intelligence/GuardianProgressScreen.tsx](C:\Users\fasir\liberia-learn\components\intelligence\GuardianProgressScreen.tsx)

Current guardian rules:
- summary only
- no raw confusion fields
- no internal intervention reasons
- no actionable teacher-only suggestions

## 7. Admin / Readiness Surface

Readiness computations live in:
- [lib/readiness/readinessService.ts](C:\Users\fasir\liberia-learn\lib\readiness\readinessService.ts)

Current admin routes:
- [app/api/admin/pilot-readiness/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\pilot-readiness\route.ts)
- [app/api/admin/onboarding/readiness/route.ts](C:\Users\fasir\liberia-learn\app\api\admin\onboarding\readiness\route.ts)

These routes consume delivery, intelligence, governance, and ops signals to score readiness without changing the underlying instructional data.
