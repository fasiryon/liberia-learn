# Project Atlas agent inventory

Audited main snapshot `887f23eccbe5b194c2e7ff93c0b09c843549a9eb` on 2026-10-23. This is discovery and recommendation only. No agent was invoked, no runtime flag changed, and no application code or operational record was modified. The canonical proposed registry is [AGENT_REGISTRY.json](AGENT_REGISTRY.json); this Markdown and the CSV are generated views.

121 catalog entries include 95 executable/configured runtime or external entries and 26 persona documents. Entry counts are not a count of independent autonomous agents. Eight injected factory roles form one deterministic workflow; the tutor adapter and shared answer engine are two API-facing capabilities sharing one engine. See counting policy in the registry.

| Type | Entries |
| --- | --- |
| LLM | 43 |
| LLM infrastructure | 5 |
| deterministic workflow | 9 |
| scheduled automation | 37 |
| external workflow | 1 |
| documentation-only persona | 26 |

| Repository status | Entries |
| --- | --- |
| implemented but unverified | 89 |
| test-only | 2 |
| configured but disabled | 2 |
| unknown | 28 |

Confirmed production-active: **0**. Confirmed obsolete: **0**. Experimental/test-only examples: echo and goal-echo, **2**. These are evidence counts; live active/disabled counts are UNKNOWN. Configured-disabled means checked-in policy/workflow disable evidence, not an inspected production environment. No retirement is authorized by this report.

Evidence strength: E0 live execution, none observed; E1 directly inspected implementation/guard/caller; E2 checked-in execution or historical audit evidence, not reproduced; E3 documentation or branch claim; E4 pattern lead. Source confidence and activation confidence are separate. No provider SDK was executed.

## Catalog


### adaptive-practice-generator

Adaptive Practice Generator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate targeted strand practice Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/adaptive/practiceGenerator.ts](../../../lib/adaptive/practiceGenerator.ts); [app/api/student/adaptive/practice/route.ts](../../../app/api/student/adaptive/practice/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Student practice request; IN Server resolved gap/difficulty; OUT Practice item sealed in server session |
| Tools and permissions | Generation; caller session issuance and scoring |
| Database access | StrandCatalog, StudentMasteryProfile and practice sessions via caller |
| External services | Configured LLM |
| Dependencies | routedCompletion; practiceSession |
| Flags and activation | ENABLE_ADAPTIVE_ENGINE default ON |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Generated practice item correctness and parallel legacy/canonical mastery must stay differentiated |
| Decision / owner / audit depth | INTEGRATE; Academic platform and content owners; B |
| Evidence | ROOT-043 [lib/adaptive/practiceGenerator.ts:84](../../../lib/adaptive/practiceGenerator.ts#L84) |

### agent-safety-language

Agent moderation and language services. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Classify input/output safety and optionally detect/translate guardian language Users: Authorized staff / operations unless stated |
| Implementation | [lib/agents/moderation.ts](../../../lib/agents/moderation.ts); [lib/agents/translation.ts](../../../lib/agents/translation.ts) |
| Type / model / orchestration | LLM infrastructure; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Generic runtime and SMS guardian pipeline; IN Classify input/output safety and optionally detect/translate guardian language; OUT Classify input/output safety and optionally detect/translate guardian language |
| Tools and permissions | Provider classifications and translated text only |
| Database access | AI interaction usage through router |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | Not established by inspected evidence |
| Flags and activation | invoking agent guards |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Extra detection/translation calls can cost more than deterministic language selection; moderation UNCERTAIN must not grant child-facing release. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-025 [lib/agents/translation.ts:42](../../../lib/agents/translation.ts#L42); SEC-E12 [lib/agents/moderation.ts:27](../../../lib/agents/moderation.ts#L27) |

### agent-scan

Read-only master readiness scan. Aliases: Phase-1 demo readiness scanner.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Autonomous repository readiness/security/governance audit Users: developer/operator |
| Implementation | [tools/agent-scan/scan.mjs](../../../tools/agent-scan/scan.mjs); [tools/agent-scan/package.json](../../../tools/agent-scan/package.json) |
| Type / model / orchestration | LLM; Anthropic Claude Agent SDK ^0.2.3; model selected by host/project settings; Claude Agent SDK query async message stream |
| Trigger / inputs / outputs | Explicit node scan.mjs from tools/agent-scan; IN Embedded MASTER_PROMPT plus repository context; OUT ScanOut/reports transcript and requested readiness reports |
| Tools and permissions | Read; Glob; Bash; no code-level command allowlist shown |
| Database access | Not established by inspected evidence |
| External services | Anthropic/Claude Agent SDK |
| Dependencies | project assistant settings; CLI authentication/environment |
| Flags and activation | manual execution; SDK compatible options and credentials required |
| Status and last execution | implemented but unverified; production UNKNOWN; No invocation observed; source only |
| Logging / evaluation / cost | Prompt says read-only; transcript logged; Edit omitted from tools list |
| Risks | Bash can mutate files or invoke credentials despite read-only prompt; SDK uses allowed_tools property, compatibility/enforcement not verified; no explicit spend/max-turn controls |
| Decision / owner / audit depth | IMPROVE; Developer tooling; A |
| Evidence | AUTO-E099 [tools/agent-scan/scan.mjs:58](../../../tools/agent-scan/scan.mjs#L58) |

### ai-lab-action-planner

AI Lab Action Planner. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Translate student request into validated simulation action Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/labs/ai/planLabAction.ts](../../../lib/labs/ai/planLabAction.ts); [app/api/labs/[labId]/plan/route.ts](../../../app/api/labs/[labId]/plan/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Student request with client simulation state; IN Lab ID, state, request; OUT Proposed validated action or rejection |
| Tools and permissions | Allowed simulation actions only; deterministic validator |
| Database access | Learning event/AI usage records via service/caller |
| External services | Configured LLM |
| Dependencies | routedCompletion; validateLabAction |
| Flags and activation | ENABLE_AI_LABS default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Client state is educational observation, never canonical mastery |
| Decision / owner / audit depth | VERIFY THEN ENABLE; Academic platform and content owners; A |
| Evidence | LEARN-E034 [app/api/labs/[labId]/plan/route.ts:19](../../../app/api/labs/[labId]/plan/route.ts#L19) |

### ai-lab-explainer

AI Lab State Explainer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Explain observed simulation transitions Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/labs/ai/explainLabState.ts](../../../lib/labs/ai/explainLabState.ts); [app/api/labs/[labId]/explain/route.ts](../../../app/api/labs/[labId]/explain/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Student simulation request; IN Previous/next client state; OUT Explanation |
| Tools and permissions | Text generation |
| Database access | Usage/learning event logging in helper |
| External services | Configured LLM |
| Dependencies | routedCompletion |
| Flags and activation | ENABLE_AI_LABS default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | No route-level per-user AI rate limit unlike paired planner; verify service budget and add bounds before activation |
| Decision / owner / audit depth | IMPROVE; Academic platform and content owners; B |
| Evidence | LEARN-E035 [app/api/labs/[labId]/explain/route.ts:14](../../../app/api/labs/[labId]/explain/route.ts#L14) |

### ai-provider-router

AI provider routing infrastructure. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Shared completions, embeddings, tier selection and fallback Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/router.ts](../../../lib/ai/router.ts); [lib/ai/routedCompletion.ts](../../../lib/ai/routedCompletion.ts); [lib/ai/providerRetryPolicy.ts](../../../lib/ai/providerRetryPolicy.ts); [lib/ai/budgetGuard.ts](../../../lib/ai/budgetGuard.ts); [lib/ai/circuit-breaker.ts](../../../lib/ai/circuit-breaker.ts) |
| Type / model / orchestration | LLM infrastructure; Groq / OpenAI / xAI; embeddings OpenAI; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Imported by AI features; API keys and route gates; IN Shared completions, embeddings, tier selection and fallback; OUT Shared completions, embeddings, tier selection and fallback |
| Tools and permissions | Provider requests only; callers own authorization |
| Database access | AIInteraction; AiInteractionLog |
| External services | Groq / OpenAI / xAI; embeddings OpenAI |
| Dependencies | Not established by inspected evidence |
| Flags and activation | provider credential presence |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | No live run or measured user outcomes inspected. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-001 [lib/ai/router.ts:1](../../../lib/ai/router.ts#L1); ROOT-002 [lib/ai/routedCompletion.ts:360](../../../lib/ai/routedCompletion.ts#L360); AUTO-E098 [lib/ai/routedCompletion.ts:1](../../../lib/ai/routedCompletion.ts#L1); SEC-E16 [lib/ai/budgetGuard.ts:63](../../../lib/ai/budgetGuard.ts#L63) |

### assignment-ai-grader

Assignment AI Grader. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Draft assignment grading on student submission Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/homeworkGrader.ts](../../../lib/ai/homeworkGrader.ts); [app/api/student/assignments/[id]/submit/route.ts](../../../app/api/student/assignments/[id]/submit/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Submission handling; IN Student content plus assignment instructions; OUT AI grade/feedback/rationale |
| Tools and permissions | Moderation/escalation, text generation; caller persistence |
| Database access | AssignmentSubmission AI fields through caller; escalation records |
| External services | Configured LLM |
| Dependencies | routedCompletion; moderateText; enqueueEscalation |
| Flags and activation | Submission caller guard, runtime UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Moderation blocked result contains synthetic 50 score; preserve provisional status and exclude from official reads |
| Decision / owner / audit depth | CONSOLIDATE; Academic platform and content owners; A |
| Evidence | LEARN-E037 [lib/ai/homeworkGrader.ts:28](../../../lib/ai/homeworkGrader.ts#L28) |

### assignment-tutor

Assignment Tutor Guidance. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Provide assignment guidance through teacher workflow Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/workflows/ai/assignmentTutor.ts](../../../lib/workflows/ai/assignmentTutor.ts); [app/api/teacher/assignment/tutor/route.ts](../../../app/api/teacher/assignment/tutor/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Teacher request; IN Assignment context; OUT Instructional guidance |
| Tools and permissions | Drafting only |
| Database access | Caller assignment context, usage/audit |
| External services | Configured LLM |
| Dependencies | routedCompletion |
| Flags and activation | ENABLE_ASSIGNMENT_TUTOR default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Clarify relationship to canonical grounded student tutor; avoid independent-assessment assistance |
| Decision / owner / audit depth | INTEGRATE; Academic platform and content owners; B |
| Evidence | ROOT-044 [lib/workflows/ai/assignmentTutor.ts:139](../../../lib/workflows/ai/assignmentTutor.ts#L139) |

### autonomous-governance

Governed detector and action workflow family. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Deterministic operational detectors, advisory recommendations, approved interventions, evaluation and recovery Users: Authorized staff / operations unless stated |
| Implementation | [lib/autonomous/detectors/detectorRegistry.ts](../../../lib/autonomous/detectors/detectorRegistry.ts); [lib/autonomous/detectors/detectorExecutionService.ts](../../../lib/autonomous/detectors/detectorExecutionService.ts); [lib/autonomous/actions/actionRegistry.ts](../../../lib/autonomous/actions/actionRegistry.ts); [lib/autonomous/actions/actionExecutor.ts](../../../lib/autonomous/actions/actionExecutor.ts); [lib/autonomous/workflowOrchestrator.ts](../../../lib/autonomous/workflowOrchestrator.ts); [lib/autonomous/runtime/autonomousSchedulerService.ts](../../../lib/autonomous/runtime/autonomousSchedulerService.ts) |
| Type / model / orchestration | deterministic workflow; None in inspected core; optional AI advice is separate registry entry; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Eligible LearningEvent/API detector requests and five autonomous cron pipelines; IN Deterministic operational detectors, advisory recommendations, approved interventions, evaluation and recovery; OUT Deterministic operational detectors, advisory recommendations, approved interventions, evaluation and recovery |
| Tools and permissions | Seven action categories with approval/forbidden effects; teacher support/guardian/governance drafts; approved interventions/curriculum flags |
| Database access | WorkflowRun; AgentDecision; ActionExecution; ApprovalRequest; Intervention; CurriculumFlag; AuditLog; operational memory/outcome records through services |
| External services | None in inspected core; optional AI advice is separate registry entry |
| Dependencies | Not established by inspected evidence |
| Flags and activation | ENABLE_DETECTOR_EXECUTION; ENABLE_ACTION_GOVERNANCE; ENABLE_ACTION_EXECUTION; AUTONOMOUS_RECOMMEND_ONLY_MODE; ENABLE_LOW_RISK_AUTONOMY; five cron flags default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Large governance foundation does not establish operational deployment; SQS autonomous dispatch unsupported; verify approvals, locked tenant context and outcome evidence end-to-end before execution. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-009 [lib/autonomous/actions/actionRegistry.ts:3](../../../lib/autonomous/actions/actionRegistry.ts#L3); ROOT-010 [lib/autonomous/actions/actionExecutor.ts:150](../../../lib/autonomous/actions/actionExecutor.ts#L150); ROOT-011 [lib/autonomous/runtime/workflowRecoveryService.ts:22](../../../lib/autonomous/runtime/workflowRecoveryService.ts#L22) |

### canva-generation

Canva document and asset assistant. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate school documents, certificates, thumbnails and staff/student templates Users: Authorized staff / operations unless stated |
| Implementation | [lib/canva/canvaMcp.ts](../../../lib/canva/canvaMcp.ts); [lib/canva/templates/studentIdCard.ts](../../../lib/canva/templates/studentIdCard.ts); [lib/certificates/canvaCertificate.ts](../../../lib/certificates/canvaCertificate.ts); [lib/reports/moeProgressReport.ts](../../../lib/reports/moeProgressReport.ts); [lib/schools/generateOnboardingKit.ts](../../../lib/schools/generateOnboardingKit.ts); [lib/certifications/generateCertificationAssets.ts](../../../lib/certifications/generateCertificationAssets.ts); [lib/courses/generateCourseThumbnail.ts](../../../lib/courses/generateCourseThumbnail.ts) |
| Type / model / orchestration | LLM; Anthropic default claude-opus-4-1-20250805 + Canva MCP; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authorized document endpoints or asset queue jobs; IN Generate school documents, certificates, thumbnails and staff/student templates; OUT Generate school documents, certificates, thumbnails and staff/student templates |
| Tools and permissions | Anthropic remote Canva MCP credential; generated documents/assets |
| Database access | GeneratedDocument; asset records via callers |
| External services | Anthropic default claude-opus-4-1-20250805 + Canva MCP |
| Dependencies | ai-provider-router |
| Flags and activation | Anthropic key / Canva OAuth or MCP token |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Direct SDK bypasses shared router budget; student ID template includes names/grade/student number in external prompt; review vendor permissions/retention. Server does not specify remote tool allowlist in request. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-005 [lib/canva/canvaMcp.ts:39](../../../lib/canva/canvaMcp.ts#L39); ROOT-006 [lib/canva/templates/studentIdCard.ts:48](../../../lib/canva/templates/studentIdCard.ts#L48) |

### content-factory-v2

Content Factory V2. Aliases: eight-role factory; runFactory.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Produce versioned instructional package candidates through eight dependency-ordered roles Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/content-factory/v2/manager.ts](../../../lib/content-factory/v2/manager.ts) |
| Type / model / orchestration | deterministic workflow; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Blueprint authoring invocation; IN Blueprint, role executors, actor identities; OUT Artifacts and hash-linked audit events; AWAITING_HUMAN_REVIEW |
| Tools and permissions | Injected role executors; appendAudit/persistArtifact callbacks; no official publish tools |
| Database access | No direct DB calls in manager; caller persistence must be reviewed separately |
| External services | None intrinsic; executor may use provider |
| Dependencies | quality validation; instructionalReviewer; eight ROLE_DEPENDENCIES stages |
| Flags and activation | No activation flag in manager; exact runtime bindings remain DRAFT/noneligible |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Do not count eight role names as eight autonomous production LLM agents without executor evidence |
| Decision / owner / audit depth | KEEP; Academic platform and content owners; A |
| Evidence | LEARN-E011 [lib/content-factory/v2/manager.ts:6](../../../lib/content-factory/v2/manager.ts#L6); ROOT-034 [lib/content-factory/v2/manager.ts:6](../../../lib/content-factory/v2/manager.ts#L6) |

### content-qa

content-qa. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | First-pass advisory review of lesson content, video uploads, and essay/code submissions. Never publishes, approves, or finalizes anything. Users: "system" |
| Implementation | [lib/agents/agents/content-qa.agent.ts](../../../lib/agents/agents/content-qa.agent.ts); [lib/agents/tools/contentqa.tools.ts](../../../lib/agents/tools/contentqa.tools.ts); [lib/agents/contentqa/sweep.ts](../../../lib/agents/contentqa/sweep.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | lib/agents/contentqa/sweep.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | contentqa.getSubmission; contentqa.getRubric; contentqa.flagForReview; contentqa.writeAdvisoryGrade; contentqa.matchAgainstCurriculum; safeguarding.escalate |
| Database access | contentQaReview; curriculumContent; gradedSubmission; lessonVideo; user; AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | Not established by inspected evidence |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_CONTENT_QA_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review. |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E001 [lib/agents/agents/content-qa.agent.ts:18](../../../lib/agents/agents/content-qa.agent.ts#L18); AUTO-E002 [lib/agents/contentqa/sweep.ts:18](../../../lib/agents/contentqa/sweep.ts#L18) |

### cron-agents-tick

cron/agents/tick. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled agents tick Users: platform operators |
| Implementation | [app/api/cron/agents/tick/route.ts](../../../app/api/cron/agents/tick/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */10 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/serverFlags; @/lib/agents/goals/tick; @/lib/ops/cronHeartbeat |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E041 [app/api/cron/agents/tick/route.ts:18](../../../app/api/cron/agents/tick/route.ts#L18) |

### cron-alert-digest

cron/alert-digest. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled alert-digest Users: platform operators |
| Implementation | [app/api/cron/alert-digest/route.ts](../../../app/api/cron/alert-digest/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | assessmentAttempt; guardianMessage; homeworkSubmission; teacherAlertPreference; user |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/push/sendPush |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E030 [app/api/cron/alert-digest/route.ts:16](../../../app/api/cron/alert-digest/route.ts#L16) |

### cron-alert-inactive

cron/alert-inactive. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled alert-inactive Users: platform operators |
| Implementation | [app/api/cron/alert-inactive/route.ts](../../../app/api/cron/alert-inactive/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 6 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | assessmentAttempt; enrollment |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/push/sendPush; @/lib/alert-prefs |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E029 [app/api/cron/alert-inactive/route.ts:17](../../../app/api/cron/alert-inactive/route.ts#L17) |

### cron-alert-low-grade

cron/alert-low-grade. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled alert-low-grade Users: platform operators |
| Implementation | [app/api/cron/alert-low-grade/route.ts](../../../app/api/cron/alert-low-grade/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 6 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | assessmentAttempt; enrollment |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/push/sendPush; @/lib/alert-prefs |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E028 [app/api/cron/alert-low-grade/route.ts:17](../../../app/api/cron/alert-low-grade/route.ts#L17) |

### cron-assignment-due-reminders

cron/assignment-due-reminders. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled assignment-due-reminders Users: platform operators |
| Implementation | [app/api/cron/assignment-due-reminders/route.ts](../../../app/api/cron/assignment-due-reminders/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 18 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/assignments/dueTomorrowNotifier |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E018 [app/api/cron/assignment-due-reminders/route.ts:7](../../../app/api/cron/assignment-due-reminders/route.ts#L7) |

### cron-autonomous-dead-letter-inspection

cron/autonomous/dead-letter-inspection. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled autonomous dead-letter-inspection Users: platform operators |
| Implementation | [app/api/cron/autonomous/dead-letter-inspection/route.ts](../../../app/api/cron/autonomous/dead-letter-inspection/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 */6 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/autonomous/runtime/deadLetterInspectionService; @/lib/autonomous/runtime/autonomousCronLog; @/lib/serverFlags |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E026 [app/api/cron/autonomous/dead-letter-inspection/route.ts:9](../../../app/api/cron/autonomous/dead-letter-inspection/route.ts#L9) |

### cron-autonomous-evaluation-windows

cron/autonomous/evaluation-windows. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled autonomous evaluation-windows Users: platform operators |
| Implementation | [app/api/cron/autonomous/evaluation-windows/route.ts](../../../app/api/cron/autonomous/evaluation-windows/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/autonomous/optimization/evaluationWindowScheduler; @/lib/autonomous/runtime/autonomousCronLog; @/lib/serverFlags |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E023 [app/api/cron/autonomous/evaluation-windows/route.ts:9](../../../app/api/cron/autonomous/evaluation-windows/route.ts#L9) |

### cron-autonomous-runtime-health

cron/autonomous/runtime-health. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled autonomous runtime-health Users: platform operators |
| Implementation | [app/api/cron/autonomous/runtime-health/route.ts](../../../app/api/cron/autonomous/runtime-health/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */5 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/autonomous/runtime/runtimeHealthService; @/lib/autonomous/runtime/autonomousCronLog; @/lib/audit; @/lib/serverFlags |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E025 [app/api/cron/autonomous/runtime-health/route.ts:10](../../../app/api/cron/autonomous/runtime-health/route.ts#L10) |

### cron-autonomous-stale-approvals

cron/autonomous/stale-approvals. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled autonomous stale-approvals Users: platform operators |
| Implementation | [app/api/cron/autonomous/stale-approvals/route.ts](../../../app/api/cron/autonomous/stale-approvals/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */15 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/autonomous/actions/staleApprovalWorker; @/lib/autonomous/runtime/autonomousCronLog; @/lib/serverFlags |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E022 [app/api/cron/autonomous/stale-approvals/route.ts:9](../../../app/api/cron/autonomous/stale-approvals/route.ts#L9) |

### cron-autonomous-workflow-recovery

cron/autonomous/workflow-recovery. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled autonomous workflow-recovery Users: platform operators |
| Implementation | [app/api/cron/autonomous/workflow-recovery/route.ts](../../../app/api/cron/autonomous/workflow-recovery/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */10 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/autonomous/runtime/workflowRecoveryService; @/lib/autonomous/runtime/autonomousCronLog; @/lib/serverFlags |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E024 [app/api/cron/autonomous/workflow-recovery/route.ts:9](../../../app/api/cron/autonomous/workflow-recovery/route.ts#L9) |

### cron-check-ai-budget

cron/check-ai-budget. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled check-ai-budget Users: platform operators |
| Implementation | [app/api/cron/check-ai-budget/route.ts](../../../app/api/cron/check-ai-budget/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/ops/aiSpend; @/lib/ops/alerts; @/lib/ops/cronHeartbeat |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E034 [app/api/cron/check-ai-budget/route.ts:9](../../../app/api/cron/check-ai-budget/route.ts#L9) |

### cron-check-dlq

cron/check-dlq. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled check-dlq Users: platform operators |
| Implementation | [app/api/cron/check-dlq/route.ts](../../../app/api/cron/check-dlq/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */15 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/ops/queueDepths; @/lib/ops/alerts; @/lib/ops/cronHeartbeat |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E035 [app/api/cron/check-dlq/route.ts:9](../../../app/api/cron/check-dlq/route.ts#L9) |

### cron-cleanup-offline-packs

cron/cleanup-offline-packs. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled cleanup-offline-packs Users: platform operators |
| Implementation | [app/api/cron/cleanup-offline-packs/route.ts](../../../app/api/cron/cleanup-offline-packs/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 3 * * 0; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | offlinePack |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E039 [app/api/cron/cleanup-offline-packs/route.ts:8](../../../app/api/cron/cleanup-offline-packs/route.ts#L8) |

### cron-cleanup-rejected-videos

cron/cleanup-rejected-videos. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled cleanup-rejected-videos Users: platform operators |
| Implementation | [app/api/cron/cleanup-rejected-videos/route.ts](../../../app/api/cron/cleanup-rejected-videos/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 3 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | lessonVideo |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E040 [app/api/cron/cleanup-rejected-videos/route.ts:10](../../../app/api/cron/cleanup-rejected-videos/route.ts#L10) |

### cron-content-qa-sweep

cron/content-qa-sweep. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled content-qa-sweep Users: platform operators |
| Implementation | [app/api/cron/content-qa-sweep/route.ts](../../../app/api/cron/content-qa-sweep/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */15 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/agents/control; @/lib/agents/contentqa/sweep |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E042 [app/api/cron/content-qa-sweep/route.ts:20](../../../app/api/cron/content-qa-sweep/route.ts#L20) |

### cron-guardian-weekly-digest

cron/guardian-weekly-digest. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled guardian-weekly-digest Users: platform operators |
| Implementation | [app/api/cron/guardian-weekly-digest/route.ts](../../../app/api/cron/guardian-weekly-digest/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 12 * * 6; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | user |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/guardian/sms-service; @/lib/notifications/guardianDigest; @/lib/logger |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E038 [app/api/cron/guardian-weekly-digest/route.ts:10](../../../app/api/cron/guardian-weekly-digest/route.ts#L10) |

### cron-league-snapshot

crons/league-snapshot. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled league-snapshot Users: platform operators |
| Implementation | [app/api/crons/league-snapshot/route.ts](../../../app/api/crons/league-snapshot/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 0 * * 0; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | assignmentSubmission; attendance; leagueSnapshot; school; student; studentProgress |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/loadTest/syntheticIdentity |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E032 [app/api/crons/league-snapshot/route.ts:16](../../../app/api/crons/league-snapshot/route.ts#L16) |

### cron-league-weekly-reset

cron/league-weekly-reset. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled league-weekly-reset Users: platform operators |
| Implementation | [app/api/cron/league-weekly-reset/route.ts](../../../app/api/cron/league-weekly-reset/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 0 * * 1; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | leagueWeekSnapshot |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/league/weeklyScore |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E033 [app/api/cron/league-weekly-reset/route.ts:12](../../../app/api/cron/league-weekly-reset/route.ts#L12) |

### cron-morning-brief-sweep

cron/morning-brief-sweep. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled morning-brief-sweep Users: platform operators |
| Implementation | [app/api/cron/morning-brief-sweep/route.ts](../../../app/api/cron/morning-brief-sweep/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 5 * * 1-5; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/agents/control; @/lib/agents/morningBrief/sweep |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E043 [app/api/cron/morning-brief-sweep/route.ts:17](../../../app/api/cron/morning-brief-sweep/route.ts#L17) |

### cron-nightly-backup

cron/nightly-backup. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled nightly-backup Users: platform operators |
| Implementation | [app/api/cron/nightly-backup/route.ts](../../../app/api/cron/nightly-backup/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 2 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | agentInvocation; attendance; escalationQueue; grade; student; studentGuardian; user |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; A |
| Evidence | AUTO-E031 [app/api/cron/nightly-backup/route.ts:18](../../../app/api/cron/nightly-backup/route.ts#L18); SEC-E17 [app/api/cron/nightly-backup/route.ts:27](../../../app/api/cron/nightly-backup/route.ts#L27); SEC-E18 [app/api/cron/nightly-backup/route.ts:177](../../../app/api/cron/nightly-backup/route.ts#L177) |

### cron-ops-sentinel

cron/ops-sentinel. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled ops-sentinel Users: platform operators |
| Implementation | [app/api/cron/ops-sentinel/route.ts](../../../app/api/cron/ops-sentinel/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */15 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/agents/control; @/lib/agents/opsSentinel/sweep |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E036 [app/api/cron/ops-sentinel/route.ts:19](../../../app/api/cron/ops-sentinel/route.ts#L19) |

### cron-process-audio-generation

cron/process-audio-generation. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled process-audio-generation Users: platform operators |
| Implementation | [app/api/cron/process-audio-generation/route.ts](../../../app/api/cron/process-audio-generation/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */10 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/audio/audioGenerationQueue; @/lib/automation/cronRunLog |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E020 [app/api/cron/process-audio-generation/route.ts:8](../../../app/api/cron/process-audio-generation/route.ts#L8) |

### cron-process-textbook-generation

cron/process-textbook-generation. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled process-textbook-generation Users: platform operators |
| Implementation | [app/api/cron/process-textbook-generation/route.ts](../../../app/api/cron/process-textbook-generation/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */15 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/textbooks/textbookGenerationQueue; @/lib/automation/cronRunLog |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; B |
| Evidence | AUTO-E021 [app/api/cron/process-textbook-generation/route.ts:8](../../../app/api/cron/process-textbook-generation/route.ts#L8) |

### cron-rebuild-leaderboards

cron/rebuild-leaderboards. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled rebuild-leaderboards Users: platform operators |
| Implementation | [app/api/cron/rebuild-leaderboards/route.ts](../../../app/api/cron/rebuild-leaderboards/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 20 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | class |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db; @/lib/gamification/leaderboardService |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Accepts x-cron-secret/query secret only, unlike Bearer contract in other cron routes and Ops Sentinel retry. Verify actual scheduler compatibility; query credentials can enter logs. |
| Decision / owner / audit depth | IMPROVE; Platform operations; B |
| Evidence | AUTO-E019 [app/api/cron/rebuild-leaderboards/route.ts:7](../../../app/api/cron/rebuild-leaderboards/route.ts#L7) |

### cron-refresh-demo-schedule

cron/refresh-demo-schedule. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled refresh-demo-schedule Users: platform operators |
| Implementation | [app/api/cron/refresh-demo-schedule/route.ts](../../../app/api/cron/refresh-demo-schedule/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 0 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | scheduledWork |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/db |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Accepts x-cron-secret/query secret only, unlike Bearer contract in other cron routes and Ops Sentinel retry. Verify actual scheduler compatibility; query credentials can enter logs. |
| Decision / owner / audit depth | IMPROVE; Platform operations; B |
| Evidence | AUTO-E037 [app/api/cron/refresh-demo-schedule/route.ts:27](../../../app/api/cron/refresh-demo-schedule/route.ts#L27) |

### cron-release-stale-grades

cron/release-stale-grades. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled release-stale-grades Users: platform operators |
| Implementation | [app/api/cron/release-stale-grades/route.ts](../../../app/api/cron/release-stale-grades/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule 0 */6 * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/ai/staleGradeReleaser |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; A |
| Evidence | AUTO-E027 [app/api/cron/release-stale-grades/route.ts:6](../../../app/api/cron/release-stale-grades/route.ts#L6) |

### cron-safeguarding-sla-check

cron/safeguarding-sla-check. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Scheduled safeguarding-sla-check Users: platform operators |
| Implementation | [app/api/cron/safeguarding-sla-check/route.ts](../../../app/api/cron/safeguarding-sla-check/route.ts) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | Vercel schedule */15 * * * *; IN scheduler HTTP request; optional route body; OUT HTTP JSON result and route-defined side effects |
| Tools and permissions | CRON_SECRET HTTP guard; privileged server-side route operation |
| Database access | Not established by inspected evidence |
| External services | Vercel scheduler; route-specific dependencies |
| Dependencies | @/lib/agents/safeguarding/slaCheck |
| Flags and activation | Deployment includes vercel.json; CRON_SECRET and any imported server flags/AgentControl conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Guard and scheduled declaration inspected; service implementation requires feature-specific review |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform operations; A |
| Evidence | AUTO-E044 [app/api/cron/safeguarding-sla-check/route.ts:19](../../../app/api/cron/safeguarding-sla-check/route.ts#L19) |

### curriculum-optimizer

Curriculum emphasis advisor. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Deterministic weak-strand emphasis with optional AI advisory text Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/curriculum/curriculumOptimizer.ts](../../../lib/ai/curriculum/curriculumOptimizer.ts); [app/api/admin/national/curriculum-signals/route.ts](../../../app/api/admin/national/curriculum-signals/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | National curriculum signal API; IN Deterministic weak-strand emphasis with optional AI advisory text; OUT Deterministic weak-strand emphasis with optional AI advisory text |
| Tools and permissions | Advisory output; no publish action |
| Database access | aggregated NationalCurriculumSignals |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | ENABLE_CURRICULUM_OPTIMIZATION_AI default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | AI call omits aiUsage so shared budget and persisted telemetry are optional/bypassed. |
| Decision / owner / audit depth | KEEP; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-003 [lib/ai/curriculum/curriculumOptimizer.ts:69](../../../lib/ai/curriculum/curriculumOptimizer.ts#L69) |

### curriculum-review-adjudicator

Platform AI Review Adjudicator. Aliases: platform.ai.adjudicator.v1.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Resolve disagreement in advisory review assessments Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/curriculum/review/aiReview.ts](../../../lib/curriculum/review/aiReview.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Reviewer signatures disagree; IN Immutable earlier review assessments/evidence; OUT Advisory deciding recommendation, not approval |
| Tools and permissions | Review persistence/provider only |
| Database access | AIReviewAgent, CurriculumReviewTask, CurriculumAIReviewAssessment, audit |
| External services | Configured provider |
| Dependencies | subject SME; pedagogy SME; optional WAEC SME |
| Flags and activation | P2B_AI_REVIEW_ENABLED default OFF plus DB enabled |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Same provider family is not truly independent human review |
| Decision / owner / audit depth | KEEP; Academic platform and content owners; A |
| Evidence | LEARN-E013 [lib/curriculum/review/aiReview.ts:27](../../../lib/curriculum/review/aiReview.ts#L27); LEARN-E015 [lib/curriculum/review/aiReview.ts:100](../../../lib/curriculum/review/aiReview.ts#L100) |

### curriculum-review-pedagogy-sme

Platform AI Curriculum SME. Aliases: platform.ai.curriculum-sme.v1.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Advisory pedagogy/accessibility curriculum review Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/curriculum/review/aiReview.ts](../../../lib/curriculum/review/aiReview.ts); [app/api/admin/review-operations/ai/run/route.ts](../../../app/api/admin/review-operations/ai/run/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Same run as subject SME; IN Exact revision and evidence; OUT Persisted rubric recommendation |
| Tools and permissions | Review persistence/provider only |
| Database access | AIReviewAgent, CurriculumReviewTask, CurriculumAIReviewAssessment, audit |
| External services | Configured provider |
| Dependencies | runAIReviewTask; deterministic validator |
| Flags and activation | P2B_AI_REVIEW_ENABLED default OFF plus DB enabled |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Execution and educational effectiveness remain unverified |
| Decision / owner / audit depth | VERIFY THEN ENABLE; Academic platform and content owners; A |
| Evidence | LEARN-E013 [lib/curriculum/review/aiReview.ts:27](../../../lib/curriculum/review/aiReview.ts#L27); LEARN-E014 [app/api/admin/review-operations/ai/run/route.ts:9](../../../app/api/admin/review-operations/ai/run/route.ts#L9); LEARN-E015 [lib/curriculum/review/aiReview.ts:100](../../../lib/curriculum/review/aiReview.ts#L100) |

### curriculum-review-subject-sme

Platform AI Subject SME. Aliases: platform.ai.subject-sme.v1.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Advisory factual/subject curriculum review Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/curriculum/review/aiReview.ts](../../../lib/curriculum/review/aiReview.ts); [app/api/admin/review-operations/ai/run/route.ts](../../../app/api/admin/review-operations/ai/run/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Platform-admin review request; IN Exact revision, provenance and evidence; OUT Persisted rubric review recommendation |
| Tools and permissions | Provider and review assessment persistence; advisory only |
| Database access | AIReviewAgent, CurriculumReviewTask, CurriculumAIReviewAssessment, audit |
| External services | Configured provider via shared router |
| Dependencies | runAIReviewTask; deterministic AI evidence validator |
| Flags and activation | P2B_AI_REVIEW_ENABLED default OFF; DB agent provisioned disabled; guarded run enables records |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Execution and educational effectiveness remain unverified |
| Decision / owner / audit depth | VERIFY THEN ENABLE; Academic platform and content owners; A |
| Evidence | LEARN-E013 [lib/curriculum/review/aiReview.ts:27](../../../lib/curriculum/review/aiReview.ts#L27); LEARN-E014 [app/api/admin/review-operations/ai/run/route.ts:9](../../../app/api/admin/review-operations/ai/run/route.ts#L9); LEARN-E015 [lib/curriculum/review/aiReview.ts:100](../../../lib/curriculum/review/aiReview.ts#L100) |

### curriculum-review-waec-sme

Platform AI WAEC Baseline Alignment SME. Aliases: platform.ai.waec-alignment-sme.v1.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Assess WAEC baseline without claiming approval or imposing curriculum ceiling Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/curriculum/review/aiReview.ts](../../../lib/curriculum/review/aiReview.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Task policy waecBaselineAlignment; IN Exact revision plus authoritative alignment evidence; OUT Evidence-validated alignment recommendation |
| Tools and permissions | Provider and review persistence |
| Database access | AIReviewAgent, CurriculumReviewTask, CurriculumAIReviewAssessment, audit |
| External services | Configured provider |
| Dependencies | specialistRequirements; AI evidence validator |
| Flags and activation | P2B_AI_REVIEW_ENABLED default OFF plus task policy plus DB enabled |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Authoritative topic evidence missing means escalate; no inferred MOE/WAEC approval |
| Decision / owner / audit depth | VERIFY THEN ENABLE; Academic platform and content owners; A |
| Evidence | LEARN-E013 [lib/curriculum/review/aiReview.ts:27](../../../lib/curriculum/review/aiReview.ts#L27); LEARN-E015 [lib/curriculum/review/aiReview.ts:100](../../../lib/curriculum/review/aiReview.ts#L100) |

### district-update

district-update. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generates DRAFT district-standings narratives and school milestone celebration drafts grounded in existing league/engagement data. Never posts or sends anything. Users: "system" |
| Implementation | [lib/agents/agents/district-update.agent.ts](../../../lib/agents/agents/district-update.agent.ts); [lib/agents/tools/districtupdate.tools.ts](../../../lib/agents/tools/districtupdate.tools.ts); [app/api/admin/agents/district-update/run/route.ts](../../../app/api/admin/agents/district-update/run/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | app/api/admin/agents/district-update/run/route.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | districtupdate.getLeagueStandings; districtupdate.getPriorStandings; districtupdate.detectStandingsChanges; districtupdate.getMilestoneCandidates; districtupdate.saveDraftUpdate; districtupdate.flagForHumanReview |
| Database access | class; districtUpdateDraft; enrollment; leagueSnapshot; leagueWeekSnapshot; student; studentStreak; user; AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | Not established by inspected evidence |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_DISTRICT_UPDATE_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review. |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E003 [lib/agents/agents/district-update.agent.ts:20](../../../lib/agents/agents/district-update.agent.ts#L20); AUTO-E004 [app/api/admin/agents/district-update/run/route.ts:24](../../../app/api/admin/agents/district-update/run/route.ts#L24) |

### echo

echo. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Test-only echo agent for harness validation (admin-only). Users: "admin" |
| Implementation | [lib/agents/agents/echo.agent.ts](../../../lib/agents/agents/echo.agent.ts); [lib/agents/tools/echo.tool.ts](../../../lib/agents/tools/echo.tool.ts); [app/api/admin/agents/echo/run/route.ts](../../../app/api/admin/agents/echo/run/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | app/api/admin/agents/echo/run/route.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | echo-tool |
| Database access | AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | Not established by inspected evidence |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_ECHO_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | test-only; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review. |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E005 [lib/agents/agents/echo.agent.ts:10](../../../lib/agents/agents/echo.agent.ts#L10); AUTO-E006 [app/api/admin/agents/echo/run/route.ts:16](../../../app/api/admin/agents/echo/run/route.ts#L16) |

### elite-upgrade

Elite Curriculum Upgrade Drafter. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Draft academically deeper replacement lesson from existing persisted source Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/curriculum/eliteUpgrade.ts](../../../lib/curriculum/eliteUpgrade.ts); [app/api/admin/curriculum/upgrade/route.ts](../../../app/api/admin/curriculum/upgrade/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Admin curriculum upgrade request; IN Source content ID and upgrade context; OUT Draft enriched candidate with generator provenance |
| Tools and permissions | Curriculum reads and draft persistence through governed writers; no proof independent publication authority |
| Database access | CurriculumContent and revision/provenance through mutation layer |
| External services | Configured LLM |
| Dependencies | promptRegistry; routedCompletion; governed mutation writers |
| Flags and activation | Admin route authority; activation UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Large output token budgets plus repair calls; reuse Content Factory package contracts and avoid parallel standards |
| Decision / owner / audit depth | INTEGRATE; Academic platform and content owners; A |
| Evidence | LEARN-E042 [lib/curriculum/eliteUpgrade.ts:1047](../../../lib/curriculum/eliteUpgrade.ts#L1047); LEARN-E047 [lib/curriculum/eliteUpgrade.ts:1180](../../../lib/curriculum/eliteUpgrade.ts#L1180) |

### exam-generation

School exam draft generator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate draft questions/mark schemes for school exams Users: Authorized staff / operations unless stated |
| Implementation | [lib/exams/examGenerator.ts](../../../lib/exams/examGenerator.ts); [app/api/admin/exams/generate/route.ts](../../../app/api/admin/exams/generate/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authorized admin request; IN Generate draft questions/mark schemes for school exams; OUT Generate draft questions/mark schemes for school exams |
| Tools and permissions | Draft output; separate publish/result routes own official lifecycle |
| Database access | Exam and ExamQuestion via caller |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | route permission / usage context |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | LLM generation alone cannot establish governed assessment validity or independent moderation. |
| Decision / owner / audit depth | INTEGRATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-037 [lib/exams/examGenerator.ts:205](../../../lib/exams/examGenerator.ts#L205) |

### exercise-generation

Coding and AI literacy exercise generators. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate structured computing tasks with schemas and prompt contracts Users: Authorized staff / operations unless stated |
| Implementation | [lib/exercises/generateCodeExercise.ts](../../../lib/exercises/generateCodeExercise.ts); [lib/exercises/generateAILiteracy.ts](../../../lib/exercises/generateAILiteracy.ts); [scripts/generate-code-exercises.ts](../../../scripts/generate-code-exercises.ts); [scripts/generate-ai-literacy.ts](../../../scripts/generate-ai-literacy.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Explicit generation CLI; no independent application daemon established; IN Generate structured computing tasks with schemas and prompt contracts; OUT Generate structured computing tasks with schemas and prompt contracts |
| Tools and permissions | Draft exercise output; script persistence |
| Database access | exercise records through generation scripts |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | provider configuration / explicit CLI |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Useful computing foundations; not evidence of complete K-12 computing/engineering progression. |
| Decision / owner / audit depth | INTEGRATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-038 [lib/exercises/generateCodeExercise.ts:76](../../../lib/exercises/generateCodeExercise.ts#L76); ROOT-039 [lib/exercises/generateAILiteracy.ts:150](../../../lib/exercises/generateAILiteracy.ts#L150) |

### github-canonical-clean-bootstrap

Canonical clean bootstrap. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Repository CI, evaluation, release or review workflow Users: platform operators |
| Implementation | [.github/workflows/canonical-clean-bootstrap.yml](../../../.github/workflows/canonical-clean-bootstrap.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | workflow_dispatch, pull_request, push; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E045 [.github/workflows/canonical-clean-bootstrap.yml:1](../../../.github/workflows/canonical-clean-bootstrap.yml#L1) |

### github-ci

CI. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Repository CI, evaluation, release or review workflow Users: platform operators |
| Implementation | [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | push, pull_request; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E046 [.github/workflows/ci.yml:1](../../../.github/workflows/ci.yml#L1) |

### github-deploy-ecs

Deploy ECS Images. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Manually build/push worker Docker image to ECR; does not itself prove ECS rollout Users: platform operators |
| Implementation | [.github/workflows/deploy-ecs.yml](../../../.github/workflows/deploy-ecs.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | workflow_dispatch; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | id-token: write; contents: read; OIDC role assumption; Docker build/push |
| Database access | Not established by inspected evidence |
| External services | GitHub OIDC; AWS ECR |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; A |
| Evidence | AUTO-E047 [.github/workflows/deploy-ecs.yml:1](../../../.github/workflows/deploy-ecs.yml#L1); SEC-E28 [.github/workflows/deploy-ecs.yml:1](../../../.github/workflows/deploy-ecs.yml#L1) |

### github-evals

Weekly RAG Evals. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Weekly RAG evaluation; fixture/run results need commit and dataset matching Users: platform operators |
| Implementation | [.github/workflows/evals.yml](../../../.github/workflows/evals.yml) |
| Type / model / orchestration | scheduled automation; OpenAI via scripts/run-evals.ts; repository implementation |
| Trigger / inputs / outputs | workflow_dispatch, schedule; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | scripts/run-evals.ts |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | DATABASE_URL/DIRECT_URL target and eval-school isolation require external verification |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E048 [.github/workflows/evals.yml:1](../../../.github/workflows/evals.yml#L1) |

### github-lab-review-capture

Lab review capture. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Repository CI, evaluation, release or review workflow Users: platform operators |
| Implementation | [.github/workflows/lab-review-capture.yml](../../../.github/workflows/lab-review-capture.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | workflow_dispatch; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E049 [.github/workflows/lab-review-capture.yml:1](../../../.github/workflows/lab-review-capture.yml#L1) |

### github-lab-runtime-gate

Lab runtime gate. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Repository CI, evaluation, release or review workflow Users: platform operators |
| Implementation | [.github/workflows/lab-runtime-gate.yml](../../../.github/workflows/lab-runtime-gate.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | pull_request; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E050 [.github/workflows/lab-runtime-gate.yml:1](../../../.github/workflows/lab-runtime-gate.yml#L1) |

### github-mergeops

MergeOps. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Read-only MergeOps observer on trusted main Users: platform operators |
| Implementation | [.github/workflows/mergeops.yml](../../../.github/workflows/mergeops.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | push, pull_request_target, workflow_run; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read; pull-requests: read; checks: read; actions: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | mergeops-controller |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Read-only permissions; checkout main; persist-credentials false; ten minute timeout; local reports only |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E052 [.github/workflows/mergeops.yml:1](../../../.github/workflows/mergeops.yml#L1) |

### github-mergeops-safety

MergeOps Safety. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Repository CI, evaluation, release or review workflow Users: platform operators |
| Implementation | [.github/workflows/mergeops-safety.yml](../../../.github/workflows/mergeops-safety.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | pull_request, push; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E051 [.github/workflows/mergeops-safety.yml:1](../../../.github/workflows/mergeops-safety.yml#L1) |

### github-pr-triage

PR Triage. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | No-op placeholder echoes that PR triage is disabled pending syntax repair Users: platform operators |
| Implementation | [.github/workflows/pr-triage.yml](../../../.github/workflows/pr-triage.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | push; IN GitHub event/ref plus declared workflow inputs; OUT Echo message only |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | configured but disabled; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | No PR triage action runs |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | CONSOLIDATE; Developer operations; B |
| Evidence | AUTO-E053 [.github/workflows/pr-triage.yml:1](../../../.github/workflows/pr-triage.yml#L1) |

### github-runtime-gate

Runtime Gate 1. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Repository CI, evaluation, release or review workflow Users: platform operators |
| Implementation | [.github/workflows/runtime-gate.yml](../../../.github/workflows/runtime-gate.yml) |
| Type / model / orchestration | scheduled automation; none; repository implementation |
| Trigger / inputs / outputs | pull_request, push; IN GitHub event/ref plus declared workflow inputs; OUT Job results and uploaded artifacts or declared infrastructure effects |
| Tools and permissions | contents: read |
| Database access | Not established by inspected evidence |
| External services | GitHub Actions |
| Dependencies | Not established by inspected evidence |
| Flags and activation | GitHub Actions enabled; event matches; configured repository secrets/variables if required |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Developer operations; B |
| Evidence | AUTO-E054 [.github/workflows/runtime-gate.yml:1](../../../.github/workflows/runtime-gate.yml#L1) |

### goal-echo

goal-echo. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Test goal lifecycle through continue, human pause, scheduled pause and complete Users: platform operators |
| Implementation | [lib/agents/goals/goalEcho.ts](../../../lib/agents/goals/goalEcho.ts) |
| Type / model / orchestration | deterministic workflow; none; repository implementation |
| Trigger / inputs / outputs | Agent goal scheduler tick or admin goal route; IN entry point parameters; OUT repository-defined result |
| Tools and permissions | Not established by inspected evidence |
| Database access | AgentGoal |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | AGENT_CRON_ENABLED for cron tick |
| Status and last execution | test-only; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | one step/tick; MAX_GOAL_STEPS 50 for continue transitions |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E017 [lib/agents/goals/goalEcho.ts:1](../../../lib/agents/goals/goalEcho.ts#L1) |

### grounded-role-assistant

Shared grounded role assistant. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Answer approved classroom/policy questions for teacher, admin, student and guardian audiences Users: Authorized staff / operations unless stated |
| Implementation | [app/api/rag/query/route.ts](../../../app/api/rag/query/route.ts); [lib/ai/rag/groundedAnswerService.ts](../../../lib/ai/rag/groundedAnswerService.ts); [lib/ai/rag/assistantAccess.ts](../../../lib/ai/rag/assistantAccess.ts); [lib/ai/rag/audienceScope.ts](../../../lib/ai/rag/audienceScope.ts); [lib/ai/rag/assistantActions.ts](../../../lib/ai/rag/assistantActions.ts); [lib/ai/rag/actionDrafts.ts](../../../lib/ai/rag/actionDrafts.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authenticated POST /api/rag/query with mode resolved by server role; IN Answer approved classroom/policy questions for teacher, admin, student and guardian audiences; OUT Answer approved classroom/policy questions for teacher, admin, student and guardian audiences |
| Tools and permissions | Audience-restricted retrieval and bounded draft actions; no official grading or publication |
| Database access | RagChunk; AIInteraction; AuditLog |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | route rate/budget guards and caller school context |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Same engine backs student tutor; entries distinguish role-facing route from tutor adapter. Prompt injection remains adversarial evaluation requirement, not proven bypass. |
| Decision / owner / audit depth | KEEP; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-023 [app/api/rag/query/route.ts:1](../../../app/api/rag/query/route.ts#L1); ROOT-024 [lib/ai/rag/assistantAccess.ts:4](../../../lib/ai/rag/assistantAccess.ts#L4); LEARN-E009 [lib/ai/rag/groundedAnswerService.ts:457](../../../lib/ai/rag/groundedAnswerService.ts#L457); SEC-E29 [lib/ai/rag/assistantActions.ts:46](../../../lib/ai/rag/assistantActions.ts#L46); SEC-E30 [lib/ai/rag/audienceScope.ts:51](../../../lib/ai/rag/audienceScope.ts#L51) |

### homework-grader-legacy

HomeworkGrader. Aliases: homework-grader; gradeHomeworkSubmission.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | AI review of homework using older DB agent/task telemetry Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/homework-grader.ts](../../../lib/ai/homework-grader.ts); [lib/ai/rubric-generator.ts](../../../lib/ai/rubric-generator.ts); [app/api/homework/review/route.ts](../../../app/api/homework/review/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Homework review request; IN HomeworkSubmission and rubric; OUT aiScore/aiFeedback and task metrics |
| Tools and permissions | Prisma reads/writes, moderation, escalation, provider |
| Database access | Agent, AgentTask, AgentMetric, HomeworkSubmission, SystemEvent |
| External services | Configured LLM |
| Dependencies | routedCompletion; moderation |
| Flags and activation | Caller authorization required; not same as modern agent-platform registry |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Separate telemetry/identity family; preserve teacher review and historical task evidence |
| Decision / owner / audit depth | CONSOLIDATE; Academic platform and content owners; A |
| Evidence | ROOT-045 [lib/ai/homework-grader.ts:58](../../../lib/ai/homework-grader.ts#L58) |

### learning-orchestrator

Governed Learning Orchestrator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Select next permissible diagnostic/practice/learning action Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/learning-authority/learningOrchestrator.ts](../../../lib/learning-authority/learningOrchestrator.ts); [lib/learning-authority/learningDecisionStore.ts](../../../lib/learning-authority/learningDecisionStore.ts); [app/api/student/learning-authority/next-action/route.ts](../../../app/api/student/learning-authority/next-action/route.ts); [app/api/student/today/route.ts](../../../app/api/student/today/route.ts) |
| Type / model / orchestration | deterministic workflow; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Learner next-action/dashboard read; IN Canonical learner state and released candidate actions; OUT Persisted decision/action with versioned policy |
| Tools and permissions | Deterministic ranking and policy fallback; caller state/session persistence |
| Database access | Learning decisions and canonical mastery event storage via writers |
| External services | No LLM required by default |
| Dependencies | publishedReleases; studentLearningModel; earlyLearningPolicy |
| Flags and activation | Release scope and server membership; Grade 4 Math registered |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Policy mixture is starting hypothesis; no validated learning effectiveness established |
| Decision / owner / audit depth | KEEP; Academic platform and content owners; A |
| Evidence | LEARN-E002 [app/api/student/learning-authority/next-action/route.ts:1](../../../app/api/student/learning-authority/next-action/route.ts#L1); LEARN-E005 [lib/learning-authority/learningOrchestrator.ts:135](../../../lib/learning-authority/learningOrchestrator.ts#L135) |

### legacy-curriculum-generation

Legacy curriculum payload generation. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Multi-pass model-generated lesson payloads and regeneration Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/curriculum-factory.ts](../../../lib/ai/curriculum-factory.ts); [lib/curriculum/generateLessonV2.ts](../../../lib/curriculum/generateLessonV2.ts); [lib/curriculum/v2/pipeline.ts](../../../lib/curriculum/v2/pipeline.ts); [app/api/admin/curriculum/generate/route.ts](../../../app/api/admin/curriculum/generate/route.ts); [app/api/admin/curriculum/generate-full-pack/route.ts](../../../app/api/admin/curriculum/generate-full-pack/route.ts); [worker/handlers/curriculumRegeneration.ts](../../../worker/handlers/curriculumRegeneration.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authorized curriculum routes, queued regeneration or maintenance scripts; IN Multi-pass model-generated lesson payloads and regeneration; OUT Multi-pass model-generated lesson payloads and regeneration |
| Tools and permissions | Draft generation; persistence/review controlled by caller and curriculum write services |
| Database access | CurriculumContent; revision/provenance records via callers |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | route permissions / provenance gates / provider keys |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Naming overlaps deterministic Content Factory V2 but these are distinct paths; generated payload does not imply approved Excellence bundle or MOE attestation. |
| Decision / owner / audit depth | INTEGRATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-035 [lib/ai/curriculum-factory.ts:611](../../../lib/ai/curriculum-factory.ts#L611); ROOT-036 [lib/curriculum/generateLessonV2.ts:510](../../../lib/curriculum/generateLessonV2.ts#L510) |

### lesson-illustration

Lesson illustration and vision QA workflow. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate Fal illustrations with structural QA and optional OpenAI vision check Users: Authorized staff / operations unless stated |
| Implementation | [lib/media/generateIllustration.ts](../../../lib/media/generateIllustration.ts); [lib/media/falClient.ts](../../../lib/media/falClient.ts); [lib/media/imageQA.ts](../../../lib/media/imageQA.ts); [lib/media/processLesson.ts](../../../lib/media/processLesson.ts) |
| Type / model / orchestration | LLM; Fal FLUX schnell / optional OpenAI gpt-4o-mini; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Lesson media pipeline; IN Generate Fal illustrations with structural QA and optional OpenAI vision check; OUT Generate Fal illustrations with structural QA and optional OpenAI vision check |
| Tools and permissions | External image generation/download; at most two attempts |
| Database access | lesson media via caller |
| External services | Fal FLUX schnell / optional OpenAI gpt-4o-mini |
| Dependencies | ai-provider-router |
| Flags and activation | FAL_KEY; MEDIA_VISION_QA=1 with OpenAI key |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Costs tracked per image attempts but separate from text budget; model quality gate is optional; no learning-effectiveness evidence. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-017 [lib/media/generateIllustration.ts:30](../../../lib/media/generateIllustration.ts#L30); ROOT-018 [lib/media/imageQA.ts:20](../../../lib/media/imageQA.ts#L20) |

### lesson-narration

Lesson speech generation. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate narration and track audio assets Users: Authorized staff / operations unless stated |
| Implementation | [lib/audio/lessonAudioProvider.ts](../../../lib/audio/lessonAudioProvider.ts); [lib/lessons/audioGeneration.ts](../../../lib/lessons/audioGeneration.ts); [lib/audio/audioGenerationQueue.ts](../../../lib/audio/audioGenerationQueue.ts); [lib/elevenlabs.ts](../../../lib/elevenlabs.ts) |
| Type / model / orchestration | LLM infrastructure; OpenAI tts-1; separate ElevenLabs eleven_turbo_v2 path; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Admin queue / process-audio-generation cron; separate ElevenLabs helper; IN Generate narration and track audio assets; OUT Generate narration and track audio assets |
| Tools and permissions | TTS request and audio storage |
| Database access | LessonAudio; audio generation jobs |
| External services | OpenAI tts-1; separate ElevenLabs eleven_turbo_v2 path |
| Dependencies | Not established by inspected evidence |
| Flags and activation | provider key / queue conditions |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Multiple audio pipelines and unimplemented GENERATE_LESSON_AUDIO worker dispatch need explicit ownership. |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-019 [lib/audio/lessonAudioProvider.ts:8](../../../lib/audio/lessonAudioProvider.ts#L8); ROOT-020 [lib/elevenlabs.ts:10](../../../lib/elevenlabs.ts#L10) |

### lesson-quiz-generator

Lesson Quiz and Gap Analysis. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate lesson formative questions and analyze learner gaps Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/lessonQuiz.ts](../../../lib/ai/lessonQuiz.ts); [app/api/student/lessons/[id]/quiz/route.ts](../../../app/api/student/lessons/[id]/quiz/route.ts); [app/api/student/lessons/[id]/quiz/submit/route.ts](../../../app/api/student/lessons/[id]/quiz/submit/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Learner lesson quiz request or submission; IN Lesson content and server scoring context; OUT Quiz plus gap analysis |
| Tools and permissions | Bounded provider generation with fallback content |
| Database access | Lesson/quiz submission records via callers; usage |
| External services | Configured LLM |
| Dependencies | routedCompletion |
| Flags and activation | Caller authorization; deployment UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Generated formative checks must not be mistaken for independently validated assessment forms |
| Decision / owner / audit depth | INTEGRATE; Academic platform and content owners; A |
| Evidence | LEARN-E045 [lib/ai/lessonQuiz.ts:163](../../../lib/ai/lessonQuiz.ts#L163); LEARN-E048 [app/api/student/lessons/[id]/quiz/route.ts:88](../../../app/api/student/lessons/[id]/quiz/route.ts#L88); LEARN-E049 [app/api/student/lessons/[id]/quiz/submit/route.ts:88](../../../app/api/student/lessons/[id]/quiz/submit/route.ts#L88); LEARN-E050 [lib/ai/lessonQuiz.ts:216](../../../lib/ai/lessonQuiz.ts#L216) |

### liberialearn-family

liberialearn-family. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | SMS assistant for guardians: student progress, attendance, homework, teacher contact. Users: "system" |
| Implementation | [lib/agents/agents/liberialearn-family.agent.ts](../../../lib/agents/agents/liberialearn-family.agent.ts); [lib/agents/tools/guardian.tools.ts](../../../lib/agents/tools/guardian.tools.ts); [lib/agents/sms/guardianInbound.ts](../../../lib/agents/sms/guardianInbound.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | lib/agents/sms/guardianInbound.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | guardian.getStudentProgress; guardian.getRecentActivity; guardian.getUpcomingWork; guardian.getTeacherContact; guardian.triggerDigestNow; guardian.flagForTeacher; guardian.requestPhoneUpdate; safeguarding.escalate |
| Database access | assignment; assignmentSubmission; attendance; enrollment; guardianMessage; homework; homeworkSubmission; student; studentMasteryProfile; studentProgress; user; AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | SMS gateway via guardian/sms-service; AI providers |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_GUARDIAN_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review.; Guardian linkage or temporary grantedStudentIds; safeguarding keyword pre-gate |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E007 [lib/agents/agents/liberialearn-family.agent.ts:19](../../../lib/agents/agents/liberialearn-family.agent.ts#L19); AUTO-E008 [lib/agents/sms/guardianInbound.ts:10](../../../lib/agents/sms/guardianInbound.ts#L10) |

### maintenance-generation-tools

Historical and maintenance AI generation CLIs. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Manually invoked content generation, tagging and model comparison; grouped maintenance family Users: Authorized staff / operations unless stated |
| Implementation | [scripts/generate-missing-curriculum-content.ts](../../../scripts/generate-missing-curriculum-content.ts); [scripts/generate-labs-for-approved.ts](../../../scripts/generate-labs-for-approved.ts); [scripts/generate-textbooks-for-approved.ts](../../../scripts/generate-textbooks-for-approved.ts); [scripts/tag-waec-content.ts](../../../scripts/tag-waec-content.ts); [scripts/finetune/eval-compare.ts](../../../scripts/finetune/eval-compare.ts); [scripts/test-gen-single.ts](../../../scripts/test-gen-single.ts); [scripts/moe-alignment-dry-run.ts](../../../scripts/moe-alignment-dry-run.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Explicit CLI invocation; no scheduled registration proven; IN Manually invoked content generation, tagging and model comparison; grouped maintenance family; OUT Manually invoked content generation, tagging and model comparison; grouped maintenance family |
| Tools and permissions | Provider calls and script-specific writes; do not run as audit |
| Database access | script-specific curriculum/lab/textbook data; read/write authority requires per-run review |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | CLI credentials / flags / invocation |
| Status and last execution | unknown; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | CLI family is sampled, not fully validated for retirement or safe dry-run. A script named dry-run can still spend money. Production invocation unknown. |
| Decision / owner / audit depth | INVESTIGATE; Platform engineering with academic reviewer for consequential decisions; C |
| Evidence | DISC-0689 [scripts/finetune/eval-compare.ts:48](../../../scripts/finetune/eval-compare.ts#L48); DISC-0695 [scripts/generate-labs-for-approved.ts:162](../../../scripts/generate-labs-for-approved.ts#L162); DISC-0696 [scripts/generate-labs-for-approved.ts:123](../../../scripts/generate-labs-for-approved.ts#L123); DISC-0699 [scripts/generate-missing-curriculum-content.ts:477](../../../scripts/generate-missing-curriculum-content.ts#L477); DISC-0700 [scripts/generate-missing-curriculum-content.ts:109](../../../scripts/generate-missing-curriculum-content.ts#L109); DISC-0701 [scripts/generate-textbooks-for-approved.ts:219](../../../scripts/generate-textbooks-for-approved.ts#L219); DISC-0702 [scripts/generate-textbooks-for-approved.ts:155](../../../scripts/generate-textbooks-for-approved.ts#L155); DISC-0716 [scripts/moe-alignment-dry-run.ts:181](../../../scripts/moe-alignment-dry-run.ts#L181); DISC-0766 [scripts/tag-waec-content.ts:9](../../../scripts/tag-waec-content.ts#L9); DISC-0768 [scripts/test-gen-single.ts:20](../../../scripts/test-gen-single.ts#L20) |

### mergeops-controller

MergeOps controller. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Observe exact PR head/checks; optional separately permissioned repair/merge controller Users: platform operators |
| Implementation | [tools/mergeops/app.mjs](../../../tools/mergeops/app.mjs); [tools/mergeops/policy.json](../../../tools/mergeops/policy.json); [tools/mergeops/controller.mjs](../../../tools/mergeops/controller.mjs); [tools/mergeops/cli.mjs](../../../tools/mergeops/cli.mjs) |
| Type / model / orchestration | deterministic workflow; none; repository implementation |
| Trigger / inputs / outputs | CLI reporting or separately hosted GitHub App webhook; IN entry point parameters; OUT readiness reports, proposal ledger; conditional review/repair/merge operations remain gated |
| Tools and permissions | observer read-only; separate state writer and contents-write merger permissions only with reviewed policy |
| Database access | Not established by inspected evidence |
| External services | GitHub REST/GraphQL and App installation tokens |
| Dependencies | Not established by inspected evidence |
| Flags and activation | autoMerge false; autoRepair false; permissionsReviewed false; safetyTestsReviewed false; previewDeploymentPolicyReviewed false; mergeAppId null |
| Status and last execution | configured but disabled; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | exact-head/check evidence; bounded repair attempts 2/files20/changedLines400; proposal ledger; preview-deployment exclusions |
| Risks | Deployment configuration and live execution not inspected |
| Decision / owner / audit depth | KEEP; Platform engineering; A |
| Evidence | AUTO-E055 [tools/mergeops/policy.json:1](../../../tools/mergeops/policy.json#L1); AUTO-E056 [tools/mergeops/app.mjs:1](../../../tools/mergeops/app.mjs#L1) |

### moe-alignment

MOE alignment assistance. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Keyword match standards first, LLM fallback and versioned alignment persistence Users: Authorized staff / operations unless stated |
| Implementation | [lib/moe/alignment-engine.ts](../../../lib/moe/alignment-engine.ts); [app/api/moe/align/route.ts](../../../app/api/moe/align/route.ts); [lib/agents/tools/contentqa.tools.ts](../../../lib/agents/tools/contentqa.tools.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authorized MOE alignment request or content QA tool; IN Keyword match standards first, LLM fallback and versioned alignment persistence; OUT Keyword match standards first, LLM fallback and versioned alignment persistence |
| Tools and permissions | Reads standards and lesson; updateCurriculumContent alignment revision |
| Database access | Standard; CurriculumContent; CurriculumRevision |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | route authorization / provenance guards |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | No live run or measured user outcomes inspected. |
| Decision / owner / audit depth | KEEP; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-014 [lib/moe/alignment-engine.ts:51](../../../lib/moe/alignment-engine.ts#L51) |

### moe-narrative-report

moe-narrative-report. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generates DRAFT narrative progress reports for MOE officials (national/district/school scope) grounded in existing MOE dashboard data. Never publishes or sends anything. Users: "system" |
| Implementation | [lib/agents/agents/moe-narrative-report.agent.ts](../../../lib/agents/agents/moe-narrative-report.agent.ts); [lib/agents/tools/moereport.tools.ts](../../../lib/agents/tools/moereport.tools.ts); [app/api/admin/agents/moe-narrative-report/run/route.ts](../../../app/api/admin/agents/moe-narrative-report/run/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | app/api/admin/agents/moe-narrative-report/run/route.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | moereport.getScopeData; moereport.getPriorReport; moereport.detectNotableChanges; moereport.saveDraftReport; moereport.flagForHumanReview |
| Database access | derivedStudentProgress; reportDraft; student; AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | Not established by inspected evidence |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_MOE_REPORT_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review. |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E009 [lib/agents/agents/moe-narrative-report.agent.ts:19](../../../lib/agents/agents/moe-narrative-report.agent.ts#L19); AUTO-E010 [app/api/admin/agents/moe-narrative-report/run/route.ts:19](../../../app/api/admin/agents/moe-narrative-report/run/route.ts#L19) |

### morning-brief

morning-brief. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generates a short daily in-app brief for one teacher (students needing intervention, certificate unlocks close, ungraded work) grounded in the existing Sprint 7.2 differentiation rollup. Never sends or notifies anyone. Users: "system" |
| Implementation | [lib/agents/agents/morning-brief.agent.ts](../../../lib/agents/agents/morning-brief.agent.ts); [lib/agents/tools/morningbrief.tools.ts](../../../lib/agents/tools/morningbrief.tools.ts); [lib/agents/morningBrief/sweep.ts](../../../lib/agents/morningBrief/sweep.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | lib/agents/morningBrief/sweep.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | morningbrief.getTeacherSignals; morningbrief.saveBrief |
| Database access | assignmentSubmission; class; teacherMorningBrief; user; AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | Not established by inspected evidence |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_MORNING_BRIEF_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review. |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E011 [lib/agents/agents/morning-brief.agent.ts:19](../../../lib/agents/agents/morning-brief.agent.ts#L19); AUTO-E012 [lib/agents/morningBrief/sweep.ts:9](../../../lib/agents/morningBrief/sweep.ts#L9) |

### n8n-daily-pulse

Daily Project Pulse n8n template. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Daily founder project briefing from governed context Users: platform operators |
| Implementation | [os-vault/SYSTEM/setup/n8n-workflows/daily-pulse-workflow.json](../../../os-vault/SYSTEM/setup/n8n-workflows/daily-pulse-workflow.json) |
| Type / model / orchestration | external workflow; Anthropic messages API; ANTHROPIC_MODEL environment selection; max_tokens2000; repository implementation |
| Trigger / inputs / outputs | n8n cron node at 06:00; deployed timezone unknown; IN build-context.mjs daily-pulse; OUT Vault GENERATED briefing plus operations log |
| Tools and permissions | n8n executeCommand runs local context builder; HTTP request; writeBinaryFile; appendToFile |
| Database access | Not established by inspected evidence |
| External services | n8n host UNKNOWN; Anthropic API |
| Dependencies | os-vault/daemon/build-context.mjs; os-vault/daemon/context.mjs |
| Flags and activation | Import template into n8n, configure VAULT_PATH/ANTHROPIC_MODEL/key, compatible nodes, enable schedule |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Verify entry point guards and monitoring before activation |
| Risks | No connected n8n instance inspected; template does not establish deployment or node-version compatibility; independent cost/logging path |
| Decision / owner / audit depth | INVESTIGATE; Platform engineering; B |
| Evidence | AUTO-E059 [os-vault/SYSTEM/setup/n8n-workflows/daily-pulse-workflow.json:1](../../../os-vault/SYSTEM/setup/n8n-workflows/daily-pulse-workflow.json#L1) |

### ops-sentinel

ops-sentinel. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Platform health monitoring: cron misses, migration drift, error spikes, cost cap breaches. Users: "system" |
| Implementation | [lib/agents/agents/ops-sentinel.agent.ts](../../../lib/agents/agents/ops-sentinel.agent.ts); [lib/agents/tools/opsSentinel.tools.ts](../../../lib/agents/tools/opsSentinel.tools.ts); [lib/agents/opsSentinel/sweep.ts](../../../lib/agents/opsSentinel/sweep.ts) |
| Type / model / orchestration | deterministic workflow; none for scheduled sweep; optional registered LLM interface; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | lib/agents/opsSentinel/sweep.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT Sweep results, cron retries, EscalationQueue and optional ops alerts |
| Tools and permissions | ops.detectCronMisses; ops.detectMigrationDrift; ops.detectErrorSpike; ops.detectCostCapBreaches; ops.retryCron; ops.clearOpsCaches; ops.proposeFix |
| Database access | AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | internal cron HTTP routes; ops email |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_OPS_SENTINEL_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | deterministic detectors; allowlisted cron retry and cache clearing; other changes escalated; routine sweep bypasses LLM invocation log |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E013 [lib/agents/agents/ops-sentinel.agent.ts:17](../../../lib/agents/agents/ops-sentinel.agent.ts#L17); AUTO-E014 [lib/agents/opsSentinel/sweep.ts:28](../../../lib/agents/opsSentinel/sweep.ts#L28) |

### os-vault-daemon

LiberiaLearn OS daemon. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Queue-file research, draft, audit, sprint review and MOE briefing generation Users: platform operators |
| Implementation | [os-vault/daemon/watcher.mjs](../../../os-vault/daemon/watcher.mjs) |
| Type / model / orchestration | LLM; Anthropic SDK; claude-sonnet-4-6; max_tokens 4000; repository implementation |
| Trigger / inputs / outputs | chokidar add event on QUEUE/*.md including startup backlog; IN Markdown request plus governed context; OUT GENERATED/{briefings,drafts,audits,reviews,misc} Markdown; input renamed DONE or FAILED |
| Tools and permissions | filesystem context reads, generated writes and queue renames; no browser or code-execution tools exposed to model |
| Database access | Not established by inspected evidence |
| External services | Anthropic messages API |
| Dependencies | os-vault/daemon/context.mjs |
| Flags and activation | npm start in os-vault/daemon with ANTHROPIC_API_KEY |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Context file/byte caps and credential-path denial; output marked draft by context instructions; no application DB access |
| Risks | Direct provider bypasses shared AI budget/invocation accounting; add-event concurrency unbounded; no persistent claim/dedupe or bounded retry; SDK defaults not equivalent to platform quotas |
| Decision / owner / audit depth | INTEGRATE; Platform engineering; B |
| Evidence | AUTO-E057 [os-vault/daemon/watcher.mjs:32](../../../os-vault/daemon/watcher.mjs#L32); AUTO-E058 [os-vault/daemon/context.mjs:1](../../../os-vault/daemon/context.mjs#L1) |

### persona-01-daily-project-pulse

01-daily-project-pulse. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [os-vault/SYSTEM/workflows/01-daily-project-pulse.md](../../../os-vault/SYSTEM/workflows/01-daily-project-pulse.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | os-vault-daemon; n8n-daily-pulse |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E080 [os-vault/SYSTEM/workflows/01-daily-project-pulse.md:1](../../../os-vault/SYSTEM/workflows/01-daily-project-pulse.md#L1) |

### persona-02-moe-brief-generator

02-moe-brief-generator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [os-vault/SYSTEM/workflows/02-moe-brief-generator.md](../../../os-vault/SYSTEM/workflows/02-moe-brief-generator.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | os-vault-daemon; n8n-daily-pulse |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E081 [os-vault/SYSTEM/workflows/02-moe-brief-generator.md:1](../../../os-vault/SYSTEM/workflows/02-moe-brief-generator.md#L1) |

### persona-03-security-audit-runner

03-security-audit-runner. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [os-vault/SYSTEM/workflows/03-security-audit-runner.md](../../../os-vault/SYSTEM/workflows/03-security-audit-runner.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | os-vault-daemon; n8n-daily-pulse |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E082 [os-vault/SYSTEM/workflows/03-security-audit-runner.md:1](../../../os-vault/SYSTEM/workflows/03-security-audit-runner.md#L1) |

### persona-04-sprint-review-generator

04-sprint-review-generator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [os-vault/SYSTEM/workflows/04-sprint-review-generator.md](../../../os-vault/SYSTEM/workflows/04-sprint-review-generator.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | os-vault-daemon; n8n-daily-pulse |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E083 [os-vault/SYSTEM/workflows/04-sprint-review-generator.md:1](../../../os-vault/SYSTEM/workflows/04-sprint-review-generator.md#L1) |

### persona-05-weekly-os-review

05-weekly-os-review. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [os-vault/SYSTEM/workflows/05-weekly-os-review.md](../../../os-vault/SYSTEM/workflows/05-weekly-os-review.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | os-vault-daemon; n8n-daily-pulse |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E084 [os-vault/SYSTEM/workflows/05-weekly-os-review.md:1](../../../os-vault/SYSTEM/workflows/05-weekly-os-review.md#L1) |

### persona-06-research-processor

06-research-processor. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [os-vault/SYSTEM/workflows/06-research-processor.md](../../../os-vault/SYSTEM/workflows/06-research-processor.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | os-vault-daemon; n8n-daily-pulse |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E085 [os-vault/SYSTEM/workflows/06-research-processor.md:1](../../../os-vault/SYSTEM/workflows/06-research-processor.md#L1) |

### persona-agent-1-fullsubject-universal

agent-1-fullsubject-universal. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [docs/internal/agents/agent-1-fullsubject-universal.md](../../../docs/internal/agents/agent-1-fullsubject-universal.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence; legacy FULL_SUBJECT/agent numbering needs mapping to current factory contracts before reuse |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering; C |
| Evidence | AUTO-E074 [docs/internal/agents/agent-1-fullsubject-universal.md:1](../../../docs/internal/agents/agent-1-fullsubject-universal.md#L1) |

### persona-curriculum-architect-agent

curriculum-architect-agent. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [docs/internal/agents/curriculum-architect-agent.md](../../../docs/internal/agents/curriculum-architect-agent.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence; legacy FULL_SUBJECT/agent numbering needs mapping to current factory contracts before reuse |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering; C |
| Evidence | AUTO-E075 [docs/internal/agents/curriculum-architect-agent.md:1](../../../docs/internal/agents/curriculum-architect-agent.md#L1) |

### persona-engineer-agent

engineer-agent. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [docs/internal/agents/engineer-agent.md](../../../docs/internal/agents/engineer-agent.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence; legacy FULL_SUBJECT/agent numbering needs mapping to current factory contracts before reuse |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering; C |
| Evidence | AUTO-E076 [docs/internal/agents/engineer-agent.md:1](../../../docs/internal/agents/engineer-agent.md#L1) |

### persona-lab-asset-director

lab-asset-director. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Owns 3D models, materials, lighting and art direction for a LiberiaLearn interactive lab — decides procedural vs glTF/GLB vs generated per component, sets per-profile budgets, LOD, compression and offline packaging, and records provenance for every asset. Use after the storyboard, before build, and whenever an asset changes. Review/spec only; never implements. Users: platform operators |
| Implementation | [.claude/agents/lab-asset-director.md](../../../.claude/agents/lab-asset-director.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Grep, Glob, WebFetch] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E060 [.claude/agents/lab-asset-director.md:1](../../../.claude/agents/lab-asset-director.md#L1) |

### persona-lab-design-director

lab-design-director. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Final experience director for a LiberiaLearn interactive lab. Runs only in review round 3, after earlier rounds, inspects the actual captures and all prior review records, and returns SHIP or DO_NOT_SHIP with P0/P1/P2 findings. Never edits. Users: platform operators |
| Implementation | [.claude/agents/lab-design-director.md](../../../.claude/agents/lab-design-director.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Glob, Grep] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E061 [.claude/agents/lab-design-director.md:1](../../../.claude/agents/lab-design-director.md#L1) |

### persona-lab-experience-director

lab-experience-director. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Owns the experience design of a high-fidelity LiberiaLearn lab — studies supplied references and produces the experience shot list / interaction storyboard. Use after the pedagogy brief, before simulation design and build. Never implements. Users: platform operators |
| Implementation | [.claude/agents/lab-experience-director.md](../../../.claude/agents/lab-experience-director.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Grep, Glob, WebFetch] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E062 [.claude/agents/lab-experience-director.md:1](../../../.claude/agents/lab-experience-director.md#L1) |

### persona-lab-interaction-reviewer

lab-interaction-reviewer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Exercises a LiberiaLearn interactive lab as a learner would (touch, mouse, keyboard) through the local dev-only review harness and reports discoverability, feedback, control, recovery and frustration problems as P0/P1/P2. Never edits repository files. Users: platform operators |
| Implementation | [.claude/agents/lab-interaction-reviewer.md](../../../.claude/agents/lab-interaction-reviewer.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Glob, Grep, Bash] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E063 [.claude/agents/lab-interaction-reviewer.md:1](../../../.claude/agents/lab-interaction-reviewer.md#L1) |

### persona-lab-pedagogy-director

lab-pedagogy-director. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Owns the instructional design of a high-fidelity LiberiaLearn lab. Use at the start of lab production (before any scene or code) and in review round 2. Review only; never implements. Users: platform operators |
| Implementation | [.claude/agents/lab-pedagogy-director.md](../../../.claude/agents/lab-pedagogy-director.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Grep, Glob] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E064 [.claude/agents/lab-pedagogy-director.md:1](../../../.claude/agents/lab-pedagogy-director.md#L1) |

### persona-lab-performance-reviewer

lab-performance-reviewer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Reviews performance, resource and access realism of a LiberiaLearn interactive lab — bundle and asset size, load, memory, renderer lifecycle, animation loops, mobile/LOW profile, FALLBACK_2D, reduced motion and offline packaging. Returns P0/P1/P2. Never edits and never claims physical-device certification without physical devices. Users: platform operators |
| Implementation | [.claude/agents/lab-performance-reviewer.md](../../../.claude/agents/lab-performance-reviewer.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Glob, Grep, Bash] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E065 [.claude/agents/lab-performance-reviewer.md:1](../../../.claude/agents/lab-performance-reviewer.md#L1) |

### persona-lab-science-reviewer

lab-science-reviewer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Reviews the factual, scientific and mathematical correctness of a LiberiaLearn interactive lab — model, equations, geometry, labels, explanations and what the animation communicates. Classifies each claim ACCURATE / PEDAGOGICAL_SIMPLIFICATION / MISLEADING / INCORRECT and returns P0/P1/P2. Never edits. Users: platform operators |
| Implementation | [.claude/agents/lab-science-reviewer.md](../../../.claude/agents/lab-science-reviewer.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Glob, Grep, Bash] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E066 [.claude/agents/lab-science-reviewer.md:1](../../../.claude/agents/lab-science-reviewer.md#L1) |

### persona-lab-simulation-architect

lab-simulation-architect. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Owns the causal correctness of a high-fidelity LiberiaLearn lab — state variables, rules, equations, valid/invalid states and deterministic fixtures, separated from renderer behaviour. Use after the pedagogy brief and storyboard, before build. Does not own curriculum authority and never implements. Users: platform operators |
| Implementation | [.claude/agents/lab-simulation-architect.md](../../../.claude/agents/lab-simulation-architect.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Grep, Glob] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E067 [.claude/agents/lab-simulation-architect.md:1](../../../.claude/agents/lab-simulation-architect.md#L1) |

### persona-lab-visual-reviewer

lab-visual-reviewer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Reviews the ACTUAL rendered captures of a LiberiaLearn interactive lab (stills, motion frame strips) for composition, lighting, materials, camera, labels, animation and polish. Returns P0/P1/P2 findings only; never edits. Users: platform operators |
| Implementation | [.claude/agents/lab-visual-reviewer.md](../../../.claude/agents/lab-visual-reviewer.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Glob, Grep] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E068 [.claude/agents/lab-visual-reviewer.md:1](../../../.claude/agents/lab-visual-reviewer.md#L1) |

### persona-migration-validator

migration-validator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Reviews changed Prisma migrations for data-loss risk. Use for migration changes. Users: platform operators |
| Implementation | [.claude/agents/migration-validator.md](../../../.claude/agents/migration-validator.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Glob] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E069 [.claude/agents/migration-validator.md:1](../../../.claude/agents/migration-validator.md#L1) |

### persona-prompt-registry-enforcer

prompt-registry-enforcer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Checks changed AI code for prompt and provider-routing violations. Use for AI prompt or provider changes. Users: platform operators |
| Implementation | [.claude/agents/prompt-registry-enforcer.md](../../../.claude/agents/prompt-registry-enforcer.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Grep, Glob] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E070 [.claude/agents/prompt-registry-enforcer.md:1](../../../.claude/agents/prompt-registry-enforcer.md#L1) |

### persona-qa-governance-agent

qa-governance-agent. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [docs/internal/agents/qa-governance-agent.md](../../../docs/internal/agents/qa-governance-agent.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence; legacy FULL_SUBJECT/agent numbering needs mapping to current factory contracts before reuse |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering; C |
| Evidence | AUTO-E077 [docs/internal/agents/qa-governance-agent.md:1](../../../docs/internal/agents/qa-governance-agent.md#L1) |

### persona-research-agent

research-agent. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [docs/internal/agents/research-agent.md](../../../docs/internal/agents/research-agent.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence; legacy FULL_SUBJECT/agent numbering needs mapping to current factory contracts before reuse |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering; C |
| Evidence | AUTO-E078 [docs/internal/agents/research-agent.md:1](../../../docs/internal/agents/research-agent.md#L1) |

### persona-security-auditor

security-auditor. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Reviews a defined security-sensitive scope. Use for auth, tenant, privacy, or data-exposure audits. Users: platform operators |
| Implementation | [.claude/agents/security-auditor.md](../../../.claude/agents/security-auditor.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Grep, Glob] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E071 [.claude/agents/security-auditor.md:1](../../../.claude/agents/security-auditor.md#L1) |

### persona-sprint-commit-guard

sprint-commit-guard. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Compares staged files with an expected scope. Use before a sprint commit. Users: platform operators |
| Implementation | [.claude/agents/sprint-commit-guard.md](../../../.claude/agents/sprint-commit-guard.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Bash] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E072 [.claude/agents/sprint-commit-guard.md:1](../../../.claude/agents/sprint-commit-guard.md#L1) |

### persona-test-coverage-analyst

test-coverage-analyst. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Finds coverage gaps in a defined changed or critical path. Use when test adequacy is in question. Users: platform operators |
| Implementation | [.claude/agents/test-coverage-analyst.md](../../../.claude/agents/test-coverage-analyst.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | [Read, Grep, Glob, Bash] |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence |
| Decision / owner / audit depth | KEEP; Platform engineering; C |
| Evidence | AUTO-E073 [.claude/agents/test-coverage-analyst.md:1](../../../.claude/agents/test-coverage-analyst.md#L1) |

### persona-uiux-agent

uiux-agent. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Authoring or review instructions; no independently scheduled application runtime Users: platform operators |
| Implementation | [docs/internal/agents/uiux-agent.md](../../../docs/internal/agents/uiux-agent.md) |
| Type / model / orchestration | documentation-only persona; Host-selected model; no provider established by document; repository implementation |
| Trigger / inputs / outputs | Explicit developer/assistant invocation, or OS context route where referenced; IN Task context defined by prompt; OUT Proposed review/draft/report |
| Tools and permissions | Not established by inspected evidence |
| Database access | Not established by inspected evidence |
| External services | Not established by inspected evidence |
| Dependencies | Not established by inspected evidence |
| Flags and activation | Host assistant must load this prompt; application activation not applicable |
| Status and last execution | unknown; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | Documented role/tool restrictions depend on host enforcement |
| Risks | Prompt presence does not establish executing agent, runtime authority, or execution evidence; legacy FULL_SUBJECT/agent numbering needs mapping to current factory contracts before reuse |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering; C |
| Evidence | AUTO-E079 [docs/internal/agents/uiux-agent.md:1](../../../docs/internal/agents/uiux-agent.md#L1) |

### placement-item-generator

Placement Item Generator. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Issue mathematics placement questions Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/placementAuthority/items.ts](../../../lib/placementAuthority/items.ts); [app/api/student/placement/sessions/[sessionId]/items/route.ts](../../../app/api/student/placement/sessions/[sessionId]/items/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Authenticated placement session item request; IN Server difficulty/history; OUT Learner-safe question plus protected server scoring data |
| Tools and permissions | Provider or deterministic fallback bank |
| Database access | Placement session/items via sessionService |
| External services | Configured LLM |
| Dependencies | routedCompletion; itemBank; scoring |
| Flags and activation | Caller/session activation, production UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | No established multi-subject or psychometric validity; fallback is mathematics |
| Decision / owner / audit depth | IMPROVE; Academic platform and content owners; A |
| Evidence | LEARN-E026 [lib/placementAuthority/items.ts:148](../../../lib/placementAuthority/items.ts#L148) |

### rag-evaluation

Grounded assistant evaluation harness. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Evaluate retrieval recall, citations, answer proxies and fallback Users: Authorized staff / operations unless stated |
| Implementation | [lib/evals/runner.ts](../../../lib/evals/runner.ts); [lib/evals/retrieval.ts](../../../lib/evals/retrieval.ts); [lib/evals/answer.ts](../../../lib/evals/answer.ts); [.github/workflows/evals.yml](../../../.github/workflows/evals.yml) |
| Type / model / orchestration | deterministic workflow; Invokes existing grounded answer provider; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Evaluation CLI / GitHub eval workflow; IN Evaluate retrieval recall, citations, answer proxies and fallback; OUT Evaluate retrieval recall, citations, answer proxies and fallback |
| Tools and permissions | Read scoped test corpus and invoke grounded answer |
| Database access | RagChunk; evaluation records through caller |
| External services | Invokes existing grounded answer provider |
| Dependencies | Not established by inspected evidence |
| Flags and activation | eval workflow inputs/provider/database configuration |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Retrieval/citation scores are quality proxies, not demonstrated learner gains. |
| Decision / owner / audit depth | KEEP; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-021 [lib/evals/runner.ts:287](../../../lib/evals/runner.ts#L287); AUTO-E048 [.github/workflows/evals.yml:1](../../../.github/workflows/evals.yml#L1) |

### rag-indexing

RAG indexing and embeddings. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Chunk approved content and policies, embed and persist retrieval vectors Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/rag/ragIngestionService.ts](../../../lib/ai/rag/ragIngestionService.ts); [lib/ai/rag/embeddingService.ts](../../../lib/ai/rag/embeddingService.ts); [worker/handlers/embeddings.ts](../../../worker/handlers/embeddings.ts) |
| Type / model / orchestration | LLM infrastructure; OpenAI text-embedding-3-small; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Curriculum approve/generate/teacher lesson paths; worker embedding job; IN Chunk approved content and policies, embed and persist retrieval vectors; OUT Chunk approved content and policies, embed and persist retrieval vectors |
| Tools and permissions | RagChunk replace and vector writes; governed curriculum embedding write |
| Database access | RagChunk; CurriculumContent |
| External services | OpenAI text-embedding-3-small |
| Dependencies | Not established by inspected evidence |
| Flags and activation | OPENAI_API_KEY presence |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | No live run or measured user outcomes inspected. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-013 [lib/ai/rag/ragIngestionService.ts:43](../../../lib/ai/rag/ragIngestionService.ts#L43) |

### rag-reranking

Optional retrieval reranking. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Rank hybrid retrieval top candidates before grounded answer Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/rag/ragReranker.ts](../../../lib/ai/rag/ragReranker.ts); [lib/ai/rag/hybridRetrieval.ts](../../../lib/ai/rag/hybridRetrieval.ts) |
| Type / model / orchestration | LLM infrastructure; Cohere rerank-english-v3.0; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Hybrid retrieval when COHERE_API_KEY configured; IN Rank hybrid retrieval top candidates before grounded answer; OUT Rank hybrid retrieval top candidates before grounded answer |
| Tools and permissions | Sends title/content previews to external rerank service |
| Database access | RagChunk via caller |
| External services | Cohere rerank-english-v3.0 |
| Dependencies | Not established by inspected evidence |
| Flags and activation | COHERE_API_KEY presence |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | External content transfer and cost need provider inventory; gracefully falls back to fusion order. |
| Decision / owner / audit depth | VERIFY THEN ENABLE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-012 [lib/ai/rag/ragReranker.ts:35](../../../lib/ai/rag/ragReranker.ts#L35) |

### scaffold-generation

Adaptive scaffold generation. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate structured instructional scaffold variants Users: Authorized staff / operations unless stated |
| Implementation | [lib/adaptive/generateScaffold.ts](../../../lib/adaptive/generateScaffold.ts); [scripts/generate-scaffolds.ts](../../../scripts/generate-scaffolds.ts); [scripts/scaffold-priority.ts](../../../scripts/scaffold-priority.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Explicit scaffold scripts and exported generator; IN Generate structured instructional scaffold variants; OUT Generate structured instructional scaffold variants |
| Tools and permissions | Structured content proposals, no canonical learner-state writer |
| Database access | scaffold records through scripts |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | provider configuration / explicit CLI |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | No live run or measured user outcomes inspected. |
| Decision / owner / audit depth | INTEGRATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-042 [lib/adaptive/generateScaffold.ts:89](../../../lib/adaptive/generateScaffold.ts#L89) |

### school-intervention-advisor

School and district intervention advisor. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Deterministic school risk priority and optional LLM action descriptions Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/interventions/recommendationEngine.ts](../../../lib/ai/interventions/recommendationEngine.ts); [app/api/admin/dashboard/school/interventions/route.ts](../../../app/api/admin/dashboard/school/interventions/route.ts); [app/api/admin/dashboard/district/interventions/route.ts](../../../app/api/admin/dashboard/district/interventions/route.ts); [lib/reporting/dashboard/districtAggregator.ts](../../../lib/reporting/dashboard/districtAggregator.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | School/district dashboards; IN Deterministic school risk priority and optional LLM action descriptions; OUT Deterministic school risk priority and optional LLM action descriptions |
| Tools and permissions | Advisory recommendations from aggregate metrics |
| Database access | ImpactSnapshot; dashboard aggregate inputs |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | AI_INTERVENTIONS_AI_ENHANCED explicit true |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Overlaps detector and learning recommendation systems; optional LLM omits aiUsage; provider failure requires caller review. |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-004 [lib/ai/interventions/recommendationEngine.ts:108](../../../lib/ai/interventions/recommendationEngine.ts#L108) |

### specialist-response-grading

Essay and AI literacy advisory grading. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Evaluate extended responses against rubrics with moderation and usage context Users: Authorized staff / operations unless stated |
| Implementation | [lib/grading/gradeEssay.ts](../../../lib/grading/gradeEssay.ts); [lib/grading/gradeAILiteracy.ts](../../../lib/grading/gradeAILiteracy.ts); [app/api/grading/essay/route.ts](../../../app/api/grading/essay/route.ts); [app/api/grading/ai-literacy/route.ts](../../../app/api/grading/ai-literacy/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authorized grading API / content QA tool; IN Evaluate extended responses against rubrics with moderation and usage context; OUT Evaluate extended responses against rubrics with moderation and usage context |
| Tools and permissions | Provisional rubric feedback; official release requires separate authority |
| Database access | GradedSubmission via caller |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | route authorization / provider and budget guards |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Overlaps homework and teacher grading assistance; do not collapse distinct official/advisory score semantics. |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-040 [lib/grading/gradeEssay.ts:110](../../../lib/grading/gradeEssay.ts#L110); ROOT-041 [lib/grading/gradeAILiteracy.ts:86](../../../lib/grading/gradeAILiteracy.ts#L86) |

### sqs-worker

SQS application job dispatcher. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Dispatch imports, analytics, SMS, embeddings, assets, textbooks and regeneration Users: Authorized staff / operations unless stated |
| Implementation | [worker/index.ts](../../../worker/index.ts); [worker/handlers/index.ts](../../../worker/handlers/index.ts); [lib/queue.ts](../../../lib/queue.ts) |
| Type / model / orchestration | deterministic workflow; AWS SQS / handler providers; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | SQS polling with configured queue URL; IN Dispatch imports, analytics, SMS, embeddings, assets, textbooks and regeneration; OUT Dispatch imports, analytics, SMS, embeddings, assets, textbooks and regeneration |
| Tools and permissions | AWS receive/send/delete; handler-specific database and external actions |
| Database access | handler-specific records |
| External services | AWS SQS / handler providers |
| Dependencies | Not established by inspected evidence |
| Flags and activation | SQS_QUEUE_URL; SQS_DLQ_URL; AWS region/credentials |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | Lesson audio and AUTONOMOUS_WORKFLOW_RUN dispatch return noop and enter retry/DLQ; at-least-once jobs need handler idempotency evidence. |
| Decision / owner / audit depth | IMPROVE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-007 [worker/handlers/index.ts:23](../../../worker/handlers/index.ts#L23); ROOT-008 [worker/index.ts:94](../../../worker/index.ts#L94) |

### student-ai-tutor

Student AI Tutor. Aliases: Learning Assistant; studentTutor.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Grounded lesson explanations and practice for students Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/tutor/studentTutor.ts](../../../lib/ai/tutor/studentTutor.ts); [app/api/student/tutor/route.ts](../../../app/api/student/tutor/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Student POST with question and lesson identity; IN Question plus server-resolved published lesson context; OUT Grounded explanation, citations, fallback/trust status |
| Tools and permissions | Read learner-safe approved retrieval context; no educational writes |
| Database access | Student/lesson/curriculum retrieval through context resolver; route audit and AI usage |
| External services | LLM provider, retrieval/embedding stack, Edge Config |
| Dependencies | groundedAnswerService; tutorContext; moderation; routedCompletion |
| Flags and activation | AI_TUTOR_ENABLED default OFF plus Edge Config aiTutor |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Grounding and moderation are useful defenses; low-latency/citation correctness and real learning benefit unverified |
| Decision / owner / audit depth | IMPROVE; Academic platform and content owners; A |
| Evidence | LEARN-E007 [app/api/student/tutor/route.ts:33](../../../app/api/student/tutor/route.ts#L33); LEARN-E008 [lib/ai/tutor/studentTutor.ts:1](../../../lib/ai/tutor/studentTutor.ts#L1) |

### teacher-ai-assist

Teacher AI Assistant. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Draft teaching support for teachers Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/teacher/teacherAssist.ts](../../../lib/ai/teacher/teacherAssist.ts); [app/api/teacher/assist/route.ts](../../../app/api/teacher/assist/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Teacher request; IN Validated teaching context; OUT Instructional suggestions |
| Tools and permissions | Text generation only in service |
| Database access | Caller-owned context and audit/usage records |
| External services | Configured LLM |
| Dependencies | routedCompletion |
| Flags and activation | AI_TEACHER_ASSIST_ENABLED default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Execution and educational effectiveness remain unverified |
| Decision / owner / audit depth | VERIFY THEN ENABLE; Academic platform and content owners; B |
| Evidence | ROOT-046 [lib/ai/teacher/teacherAssist.ts:164](../../../lib/ai/teacher/teacherAssist.ts#L164) |

### teacher-class-insights

Teacher Class Insights. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Summarize class performance for teachers Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/teacher/classInsights.ts](../../../lib/ai/teacher/classInsights.ts); [app/api/teacher/class-insights/route.ts](../../../app/api/teacher/class-insights/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Teacher request; IN Server supplied class performance; OUT Teaching insight summary |
| Tools and permissions | Generation, no direct canonical writes |
| Database access | Class/student analytics read by caller; usage/audit |
| External services | Configured LLM |
| Dependencies | routedCompletion |
| Flags and activation | Inspect caller guard before activation; production UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Execution and educational effectiveness remain unverified |
| Decision / owner / audit depth | IMPROVE; Academic platform and content owners; B |
| Evidence | ROOT-047 [lib/ai/teacher/classInsights.ts:97](../../../lib/ai/teacher/classInsights.ts#L97) |

### teacher-grading-assists

Teacher Grading Assistance. Aliases: grading-assist; grading/assist.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Suggest feedback/marks for teacher review Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/teacher/gradingAssist.ts](../../../lib/teacher/gradingAssist.ts); [lib/workflows/ai/gradingAssist.ts](../../../lib/workflows/ai/gradingAssist.ts); [app/api/teacher/grading-assist/route.ts](../../../app/api/teacher/grading-assist/route.ts); [app/api/teacher/grading/assist/route.ts](../../../app/api/teacher/grading/assist/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Teacher request; IN Submission/rubric or assignment context; OUT Advisory grade/feedback |
| Tools and permissions | Read caller-owned submission context; no official score authority established in helper |
| Database access | AssignmentSubmission and related assignment via caller; usage/audit |
| External services | Configured LLM |
| Dependencies | routedCompletion |
| Flags and activation | ENABLE_AI_GRADING_ASSIST actual default ON despite stale route comment saying OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Execution and educational effectiveness remain unverified |
| Decision / owner / audit depth | CONSOLIDATE; Academic platform and content owners; A |
| Evidence | ROOT-048 [lib/teacher/gradingAssist.ts:13](../../../lib/teacher/gradingAssist.ts#L13); ROOT-049 [lib/workflows/ai/gradingAssist.ts:214](../../../lib/workflows/ai/gradingAssist.ts#L214) |

### teacher-lesson-planners

Teacher Lesson Planning. Aliases: weekly lesson planner; lesson planner response.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Draft weekly or lesson-level instructional plans Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/teacher/lessonPlanner.ts](../../../lib/teacher/lessonPlanner.ts); [lib/ai/teacher/lessonPlanner.ts](../../../lib/ai/teacher/lessonPlanner.ts); [app/api/teacher/lesson-plan/route.ts](../../../app/api/teacher/lesson-plan/route.ts); [lib/intelligence/teacherActionExecution.ts](../../../lib/intelligence/teacherActionExecution.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Teacher selected class/week or lesson; IN Owned class, curriculum and lesson context; OUT Plan draft; explicit teacher save/bind in caller |
| Tools and permissions | Weekly planner reads owned class and curriculum; caller handles saves |
| Database access | Class, CurriculumContent, lesson-plan records via caller |
| External services | Configured LLM |
| Dependencies | routedCompletion; promptRegistry |
| Flags and activation | ENABLE_TEACHER_AI_PLANNING default ON |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Overlapping planners use separate result contracts, task modes should share governance |
| Decision / owner / audit depth | CONSOLIDATE; Academic platform and content owners; B |
| Evidence | LEARN-E036 [app/api/teacher/lesson-plan/route.ts:64](../../../app/api/teacher/lesson-plan/route.ts#L64) |

### teaching-runtime

teaching-runtime. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Delivers one turn of a live, curriculum-grounded classroom lesson: narration, comprehension checks, and honest out-of-scope deferrals, plus private facilitator coaching prompts. Users: "system" |
| Implementation | [lib/agents/agents/teaching-runtime.agent.ts](../../../lib/agents/agents/teaching-runtime.agent.ts); [lib/agents/tools/teaching.tools.ts](../../../lib/agents/tools/teaching.tools.ts); [lib/teaching/runtime.ts](../../../lib/teaching/runtime.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq llama-3.1-8b-instant / llama-3.3-70b-versatile; OpenAI gpt-4o-mini fallback; xAI grok-3 route where selected; custom bounded JSON action/tool loop, lib/agents/runtime.ts |
| Trigger / inputs / outputs | lib/teaching/runtime.ts; IN trusted caller context plus instruction; tool arguments validated by Zod; OUT LLM final text and/or allowlisted tool results persisted to invocation log |
| Tools and permissions | teaching.sendWhisperPrompt; teaching.flagOutOfScope |
| Database access | teachingSession; AgentControl; AgentInvocation; AgentCostAccounting; AuditLog |
| External services | Not established by inspected evidence |
| Dependencies | lib/agents/bootstrap.ts; lib/agents/runtime.ts; lib/ai/routedCompletion.ts |
| Flags and activation | AGENT_TEACHING_RUNTIME_ENABLED exactly true OR AgentControl.enabledOverride true; DB override wins env false |
| Status and last execution | implemented but unverified; production UNKNOWN; No live execution observed. Code and checked-in test/fixture references are not production telemetry. |
| Logging / evaluation / cost | maxDepth 20; 60s inter-turn timeout; 1 JSON repair; moderation and escalation; per-invocation, per-user and daily cost controls; invocation plus audit transaction. Temperature declared but not forwarded. Runtime tool roles/output schema need enforcement review. |
| Risks | Live flags and AgentControl overrides unknown; prompt injection can propose valid but unauthorized tool arguments; per-tool resource authorization is decisive |
| Decision / owner / audit depth | IMPROVE; Platform engineering; A |
| Evidence | AUTO-E015 [lib/agents/agents/teaching-runtime.agent.ts:13](../../../lib/agents/agents/teaching-runtime.agent.ts#L13); AUTO-E016 [lib/teaching/runtime.ts:2](../../../lib/teaching/runtime.ts#L2); SEC-E25 [lib/agents/tools/teaching.tools.ts:7](../../../lib/agents/tools/teaching.tools.ts#L7) |

### textbook-compiler

Textbook compilation workflow. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Compile student/teacher/workbook/assessment books from existing curriculum Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/textbook/textbookCompiler.ts](../../../lib/ai/textbook/textbookCompiler.ts); [lib/textbooks/textbookGenerationQueue.ts](../../../lib/textbooks/textbookGenerationQueue.ts); [worker/handlers/textbook.ts](../../../worker/handlers/textbook.ts) |
| Type / model / orchestration | deterministic workflow; No model in compiler; separate generation scripts may call OpenAI; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Admin textbook API, DB queue cron or SQS worker; IN Compile student/teacher/workbook/assessment books from existing curriculum; OUT Compile student/teacher/workbook/assessment books from existing curriculum |
| Tools and permissions | Read curriculum, produce textbook assets; no LLM in compiler itself |
| Database access | CurriculumUnit; CurriculumContent; School; TextbookGenerationJob |
| External services | No model in compiler; separate generation scripts may call OpenAI |
| Dependencies | Not established by inspected evidence |
| Flags and activation | queue configuration / caller guards |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | No live run or measured user outcomes inspected. |
| Decision / owner / audit depth | CONSOLIDATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-016 [lib/ai/textbook/textbookCompiler.ts:328](../../../lib/ai/textbook/textbookCompiler.ts#L328) |

### unit-assembler

Curriculum unit assembler. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Select lessons, fill missing content and generate unit supporting material Users: Authorized staff / operations unless stated |
| Implementation | [lib/ai/units/unitAssembler.ts](../../../lib/ai/units/unitAssembler.ts); [app/api/admin/curriculum/units/route.ts](../../../app/api/admin/curriculum/units/route.ts) |
| Type / model / orchestration | LLM; routedCompletion: Groq/OpenAI; xAI optional; Direct function calls; no LangChain/LangGraph observed |
| Trigger / inputs / outputs | Authorized admin unit request; IN Select lessons, fill missing content and generate unit supporting material; OUT Select lessons, fill missing content and generate unit supporting material |
| Tools and permissions | CurriculumUnit writes and governed lesson writes |
| Database access | Standard; CurriculumContent; CurriculumUnit |
| External services | routedCompletion: Groq/OpenAI; xAI optional |
| Dependencies | ai-provider-router |
| Flags and activation | route access / provider availability |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN; code and caller evidence only |
| Logging / evaluation / cost | Router budget/logging requires aiUsage; inspect per caller. No production costs available. |
| Risks | No live run or measured user outcomes inspected. |
| Decision / owner / audit depth | INTEGRATE; Platform engineering with academic reviewer for consequential decisions; B |
| Evidence | ROOT-015 [lib/ai/units/unitAssembler.ts:104](../../../lib/ai/units/unitAssembler.ts#L104) |

### virtual-lab-analyzer

Virtual Lab Session Analyzer. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Draft feedback and suggested score from practical observations Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/ai/lab/labAnalyzer.ts](../../../lib/ai/lab/labAnalyzer.ts); [app/api/student/labs/[labId]/session/route.ts](../../../app/api/student/labs/[labId]/session/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Submission to authorized practical lab session; IN Lab definition, observations/conclusions; OUT Suggested score/analysis |
| Tools and permissions | Moderation/escalation; caller writes session/performance event |
| Database access | VirtualLab, LabSession, StudentPerformanceEvent; escalation/audit |
| External services | Configured LLM |
| Dependencies | routedCompletion; moderation; recordPerformanceEvent |
| Flags and activation | ENABLE_VIRTUAL_LABS default OFF |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | AI score persisted without scorer authority; safety fallback zero becomes apparent performance |
| Decision / owner / audit depth | IMPROVE; Academic platform and content owners; A |
| Evidence | LEARN-E030 [app/api/student/labs/[labId]/session/route.ts:89](../../../app/api/student/labs/[labId]/session/route.ts#L89); LEARN-E031 [lib/ai/lab/labAnalyzer.ts:28](../../../lib/ai/lab/labAnalyzer.ts#L28) |

### waec-alignment-assessor

Standalone WAEC Baseline AI Assessor. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Produce evidence-qualified alignment assessment for curriculum benchmarking Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/curriculum/benchmarking/aiWaecAlignment.ts](../../../lib/curriculum/benchmarking/aiWaecAlignment.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Explicit benchmarking/script caller; IN Objective and authoritative evidence versions; OUT AI_ASSESSED_ALIGNMENT with model/prompt/provenance |
| Tools and permissions | Provider only; deterministic evidence verification |
| Database access | None intrinsic; caller persistence |
| External services | Configured LLM |
| Dependencies | promptRegistry; authoritative evidence validator |
| Flags and activation | P2C benchmarking context; standalone callable deployment UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Same purpose as registered WAEC SME but validator is useful shared foundation; do not claim direct production invocation |
| Decision / owner / audit depth | INTEGRATE; Academic platform and content owners; B |
| Evidence | LEARN-E043 [lib/curriculum/benchmarking/aiWaecAlignment.ts:139](../../../lib/curriculum/benchmarking/aiWaecAlignment.ts#L139); LEARN-E044 [lib/curriculum/benchmarking/aiWaecAlignment.ts:21](../../../lib/curriculum/benchmarking/aiWaecAlignment.ts#L21) |

### waec-practice

WAEC Practice Generator and Marker. Aliases: none established.

| Field | Observed evidence |
| --- | --- |
| Purpose and users | Generate topic practice bank and mark learner answers Users: Students / teachers / qualified reviewers according to entry-point roles |
| Implementation | [lib/waec/practice.ts](../../../lib/waec/practice.ts); [app/api/student/waec/[subject]/practice/route.ts](../../../app/api/student/waec/[subject]/practice/route.ts) |
| Type / model / orchestration | LLM; shared routedCompletion, configured provider/model; production provider unknown; plain TypeScript service |
| Trigger / inputs / outputs | Student GET/POST practice; IN Student subject/grade and supplied item answers; OUT Practice questions, feedback review and legacy mastery changes |
| Tools and permissions | LLM generation, DB bank creation, deterministic scoring, updateMasteryProfile |
| Database access | WaecPracticeItem, StudentMasteryProfile and learner/enrollment reads |
| External services | Configured LLM via routedCompletion |
| Dependencies | waec syllabus; moderation; updateMasteryProfile |
| Flags and activation | No route feature flag observed; authenticated grade eligibility gate; deployed execution UNKNOWN |
| Status and last execution | implemented but unverified; production UNKNOWN; UNKNOWN: no live invocation or dated execution record inspected |
| Logging / evaluation / cost | Shared provider usage infrastructure where aiUsage supplied; exact per-capability completeness requires follow-up |
| Risks | Unbound/replayable marking and unreviewed generated bank; no canonical SLM mutation established |
| Decision / owner / audit depth | IMPROVE; Academic platform and content owners; A |
| Evidence | LEARN-E039 [lib/waec/practice.ts:126](../../../lib/waec/practice.ts#L126); LEARN-E040 [app/api/student/waec/[subject]/practice/route.ts:23](../../../app/api/student/waec/[subject]/practice/route.ts#L23); LEARN-E041 [lib/waec/practice.ts:41](../../../lib/waec/practice.ts#L41) |
