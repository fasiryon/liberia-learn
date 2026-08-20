# P2-B Qualified Review Operations Final Design

Date: 2026-08-13  
Sprint: P2-B Qualified Review Operations  
Status: DISCOVERY AND FINAL DESIGN COMPLETE; IMPLEMENTATION NOT AUTHORIZED

## Executive decision

Use Option C, a hybrid architecture:

- P2-A remains the canonical immutable curriculum history and lifecycle authority.
- P2-B adds normalized reviewer roster, credential, task, claim, assessment, decision, conflict, and calibration models.
- Individual reviews are operational recommendations against an exact immutable `CurriculumContentRevision`.
- Only a completed P2-B decision creates the authoritative P2-A `CurriculumGovernanceEvent`.
- The P2-A event receives an immutable, versioned snapshot of every reviewer and credential that satisfied the decision policy.
- Existing direct approve, reject, and moderation routes become adapters to the P2-B service after staging parity. They must not remain bypasses.

This document is design only. It does not authorize schema edits, migrations, production writes, role changes, workflow activation, or qualification backfill.

## 1. Existing review-system inventory

Classification meanings: COMPLETE is safe to reuse for its stated responsibility; PARTIAL has useful behavior but cannot satisfy P2-B alone; LEGACY is an older path that must be adapted or retired; DUPLICATED overlaps another review path; UNUSED has no active P2-B use; MISSING does not exist.

| Component | Evidence | Classification | P2-B disposition |
|---|---|---:|---|
| P2-A provenance root, immutable revision, governance event, and evidence | `prisma/schema.prisma`, P2-A writers, readers, migrations, tests | COMPLETE | Reuse unchanged as canonical content and governance history. |
| P2-A exact-revision governance writer and required `AuditLog` coupling | `lib/curriculum/mutations/governanceWriter.ts` | COMPLETE for P2-A; PARTIAL for P2-B orchestration | Reuse through a transaction-capable internal entry point. P2-B adds current-revision and task-policy preconditions before calling it. |
| Admin curriculum approve and reject routes | `app/api/admin/curriculum/approve`, `reject` | LEGACY / PARTIAL | Coarse role permission only; no roster, scope, claim, rubric, conflict, or two-person policy. Convert to P2-B adapters, then remove direct decision behavior. |
| Generic admin governance endpoint | `app/api/admin/curriculum/[contentId]/governance` | LEGACY / PARTIAL | Useful P2-A operator surface, but it accepts governance actions without P2-B qualification. Restrict human review decisions to the P2-B decision service. Keep tightly controlled non-review governance operations only. |
| Regeneration draft queue and actions | `/admin/ops/curriculum-review`, `regenerationAdmin.ts` | PARTIAL | Reuse preview and mechanical quality information. Replace status-filter queue and bulk approval with P2-B tasks. |
| Teacher-edited lesson moderation | `/admin/content-review` and API | DUPLICATED / PARTIAL | Separate queue over `editReviewStatus`; adapt into P2-B school-scoped tasks. It currently lacks tenant filtering on list and action routes and must be remediated before activation. |
| Per-content review page | `/admin/curriculum/[contentId]/review` | PARTIAL | Reuse preview components and upgrade comparison. It has no governed rubric or safe decision contract. |
| Risk triage score and P2-A risk events | `lib/curriculum/riskTriage.ts` | PARTIAL / LEGACY policy | Deterministic and explainable, but limited signals and a weekly budget can auto-approve high-risk content. Retain historical risk events; replace decision policy for P2-B. |
| Risk reviewer notification | `riskTriageNotify.ts` | PARTIAL | Reuses email, but broadcasts to all role holders without task eligibility or tenant scope and does not create the promised inbox item. Replace recipient selection with eligible assigned reviewers. |
| `CurriculumFlag` performance signals | `lib/intelligence/curriculumFlags.ts` | PARTIAL | Useful task-creation signal. It is content-ID based, not exact-revision review state. Resolve a flag only after a linked task outcome. |
| Learner content flags | two student flag APIs and `LessonHelpFlag` | PARTIAL / DUPLICATED | Treat as risk inputs. Do not treat help requests as reviewer decisions. Reconcile duplicate ingestion separately. |
| Content QA agent review | `ContentQaReview`, content QA tools and sweep | LEGACY advisory overlay | Keep as machine evidence or risk signal only. It is polymorphic, mutable, and not revision-specific, so it cannot be a qualified human review. |
| `CurriculumFeedback` approve/reject telemetry | schema and legacy routes | PARTIAL | Historical aggregate signal only. Do not use as reviewer history or calibration truth. |
| Generic autonomous `ApprovalRequest` | autonomous action services and UI | LEGACY for P2-B | It lacks exact curriculum revision, scoped credentials, multiple reviewers, immutable assessments, and required audit behavior. Do not overload it. Reuse only its SLA and compare-and-set implementation patterns. |
| `WorkflowRun` lease pattern | `workflowStateManager.ts` | COMPLETE pattern, UNUSED for curriculum review | Reuse the CAS lease pattern conceptually, not the workflow table. |
| `ChangeRequestSignoff` | optimization subsystem | UNUSED for P2-B | Append-only signoff is a useful pattern, but the domain and policy differ. |
| MOE curriculum version activation | `/api/moe/curriculum/publish` and MOE curriculum UI | PARTIAL / LEGACY | This is release grouping, not qualified content review. It directly projects selected content status and does not create per-revision P2-A approval events. Founder policy is required before integration. |
| P2-A provenance explainability APIs | admin and MOE provenance routes | COMPLETE for current revision | Reuse and extend the review detail query to fetch the task's exact revision, including when it is no longer current. |
| Global curriculum RBAC | `lib/permissions.ts` | PARTIAL | Coarse authority ceiling only. `CURRICULUM_APPROVE` is not evidence of subject qualification. |
| MOE scope resolver | `lib/moe/authority.ts` | COMPLETE pattern | Reuse national and district scope resolution. It does not itself grant curriculum review eligibility. |
| `AuditLog` immutable security trail | schema, triggers, `logAuditRequiredWithId` | COMPLETE | Use for assignment, claim, release, override, credential status, and task transitions. Keep P2-A governance event as the domain decision history. |
| In-app inbox, push, and email | `NotificationInboxItem`, push service, email service | PARTIAL | Reuse channels. Add review notification orchestration, eligibility-based recipients, and delivery logs using existing primitives. |
| Reviewer roster | none | MISSING | Add normalized P2-B model. |
| Scoped reviewer credentials and qualification history | only nullable P2-A snapshot fields | MISSING | Add normalized credential, scope, and status-event models. |
| Review task, assignment, lease, and heartbeat | none for curriculum review | MISSING | Add P2-B operational models and services. |
| Two-person review and separation of duties | none | MISSING | Add policy engine and task slots. |
| Disagreement and resolution history | none | MISSING | Preserve submitted assessments and append a final resolution. |
| Reviewer calibration and review-quality reports | existing tests calibrate content scoring, not people | MISSING | Add controlled exercises and non-punitive analytics. |
| Reviewer workload, throughput, SLA, and coverage reports | none for curriculum review | MISSING | Derive from tasks, assignments, assessments, and credentials. |
| Reviewer seed data | demo MOE accounts only | MISSING | No reviewer or credential seed may be inferred from a role. |

Security findings that precede P2-B activation:

1. The teacher lesson moderation list and action routes are not school-filtered despite admitting ordinary school `ADMIN` users.
2. Current general curriculum approval routes do not bind a school authority to school-owned content.
3. Risk notifications select every global role holder with `CURRICULUM_APPROVE`, rather than eligible, scoped reviewers.
4. Current platform-admin permission bypass is acceptable as an administrative ceiling, but it must not manufacture MOE review authority or subject qualification.

## 2. P2-A integration map

| P2-A primitive | P2-B use | Invariant |
|---|---|---|
| `CurriculumProvenance` | Resolve stable content root, lifecycle, completeness, and current revision. | P2-B never creates a second curriculum lifecycle. |
| `CurriculumContentRevision` | Immutable review target and calibration sample. | Every task, assessment, and decision stores `revisionId` and `provenanceId`. |
| `CurriculumGovernanceEvent` | Final authoritative outcome only. | First and second recommendations are not governance events. The final outcome targets the exact task revision. |
| `approvalBasis` | `HUMAN_REVIEW` for qualified review decisions. | Machine quality checks never masquerade as human review. |
| `reviewAuthority` | Resulting MOE, SCHOOL, or PLATFORM authority. | Derived from task policy, reviewer authority ceiling, credential, and content scope. It is not derived from role alone. |
| `reviewerRoleSnapshot` | Role of the finalizing or resolving actor. | Role is recorded but does not prove qualification. |
| `reviewerQualificationRef` | Stable P2-B decision reference, formatted `p2b-review-decision:<decisionId>`. | Null remains honest on pre-P2-B history. |
| `reviewerQualificationSnapshot` | Versioned multi-reviewer snapshot described in section 18. | Historical decisions remain understandable after expiry, revocation, role change, or departure. |
| `AuditLog` | Required operational security trail. | Every sensitive P2-B transition aborts if its required audit row cannot be created. |
| P2-A risk events | Inputs to task creation and priority explanations. | Existing events remain immutable. P2-B may append a new policy-versioned risk event, never rewrite an old score. |
| `CurriculumEvidence` | Exact-revision review support and source evidence. | Review evidence uses existing append and supersession rules. Assessment records refer to evidence IDs in their immutable snapshot. |
| Revocation and lifecycle | Final P2-B revoke, reinstate, reject, return, approve, and reapprove outcomes call P2-A. | P2-B does not update compatibility status directly. |

Required transaction boundary:

1. Lock the P2-B task and P2-A content root.
2. Verify task revision equals the root's current revision for approval, reapproval, return, and rejection workflows.
3. Verify active claim, optimistic version, reviewer eligibility, conflict rules, credential validity, required independent assessments, and outcome policy.
4. Finalize the assessment and create the P2-B decision.
5. Call a transaction-capable form of the existing P2-A governance writer with the same validation and projection semantics.
6. Store the resulting governance event ID on the P2-B decision.
7. Commit the task completion, P2-A event, lifecycle projection, and required audit records together.

The current P2-A writer owns its transaction. Implementation should extract an internal `appendCurriculumGovernanceEventInTransaction(tx, input)` and keep the public wrapper. This is a transaction-composition refactor, not a provenance semantic change.

## 3. Reviewer roster design

`ReviewerProfile` is a curriculum-review eligibility profile linked one-to-one to `User`. It is not an HR record.

Required roster state:

- active, inactive, or suspended review status
- home organization type: MOE, school, platform, or external partner
- optional school and district scope
- reviewer tier for routing: reviewer, senior reviewer, specialist, or resolver
- language capabilities as BCP 47 style codes, initially `en` and any approved Liberian language codes
- weekly capacity and maximum concurrent claims
- availability for assignment
- current calibration restriction, if any, derived from calibration results or an explicit restriction
- created, verified, suspended, and updated actors recorded through required audit logs

Subjects, grades, domains, curriculum scopes, and authority are not stored as free-form claims on the profile. They come from verified credentials and their scopes.

## 4. Credential and scope design

`ReviewerCredential` is an issued qualification. Core issuance data and scopes become immutable once verified. Any scope change creates a new credential that supersedes the previous one.

Credential fields:

- credential key/type, such as `SUBJECT_REVIEW`, `WAEC_SUBJECT_REVIEW`, `ACCESSIBILITY_REVIEW`, or `STANDARDS_ALIGNMENT`
- issuer name and stable issuer reference where available
- review authority conferred: MOE, SCHOOL, PLATFORM, or UNKNOWN
- valid-from and valid-until
- current projection status: DRAFT, PENDING_VERIFICATION, VERIFIED, SUSPENDED, REVOKED, EXPIRED, or SUPERSEDED
- verification actor and timestamp
- evidence or external reference, never secret source documents
- superseded credential reference

`ReviewerCredentialScope` represents one conjunction of scope dimensions. Multiple scope rows are alternatives. A scope can constrain:

- subject code
- inclusive minimum and maximum grade
- domain code, such as `ACCESSIBILITY`, `FACTUAL_ACCURACY`, `SAFETY`, `LIBERIAN_HISTORY`, or `STANDARDS_ALIGNMENT`
- content type
- curriculum scope: NATIONAL, SCHOOL, WAEC, or IMPORTED_SOURCE
- district, county, or school when policy requires geographic authority
- curriculum standard family or source-authority code

Examples:

- Mathematics Grades 7 to 9: subject `MATH`, grades 7 to 9, NATIONAL.
- WAEC Mathematics: subject `MATH`, grades 10 to 12, WAEC.
- Special Education and Accessibility: domain `ACCESSIBILITY`, applicable grades and content types.
- Liberian History Grades 4 to 6: subject `HISTORY`, grades 4 to 6, domain `LIBERIAN_HISTORY`.

Mutable roster state: availability, capacity, profile status, credential current status projection. Immutable decision state: exact credential and scope IDs plus the full decision-time snapshot.

## 5. Deterministic eligibility engine

The engine is pure policy plus database facts. It does not call an LLM.

Inputs:

- task, exact revision snapshot, subject, grade, content type, standards, WAEC topics, school, and provenance
- policy version, risk band and reasons, required review slot, required authority and specialist domains
- reviewer profile, application role and platform-admin flag
- verified credentials and scopes at the decision timestamp
- active restrictions, automatic provenance conflicts, current claims, capacity, and prior assessment identities
- calibration restrictions required by policy

Evaluation order:

1. Authenticated application user and active reviewer profile.
2. Application role and authority ceiling permits the requested portal and authority.
3. Profile is available and below concurrent capacity.
4. At least one verified, in-date, non-suspended credential scope matches every required subject, grade, domain, content type, curriculum, geography, and authority dimension.
5. No automatic or declared conflict applies.
6. Reviewer is distinct from every reviewer already filling an independent slot.
7. Any required calibration status is current for the scope.
8. The task revision is still eligible for review and current where the workflow requires current revision.

Output contract:

```ts
type ReviewEligibilityResult = {
  eligible: boolean;
  reasonCodes: string[];
  explanation: string[];
  matchedCredentialId: string | null;
  matchedCredentialScopeId: string | null;
  effectiveAuthority: "MOE" | "SCHOOL" | "PLATFORM" | null;
  requiredSlot: "FIRST" | "SECOND" | "RESOLUTION";
  remainingRequirements: Array<{
    authority?: string;
    subject?: string;
    domain?: string;
    mustBeIndependent: boolean;
  }>;
};
```

Representative ineligibility codes: `PROFILE_INACTIVE`, `ROLE_CEILING`, `NO_MATCHING_CREDENTIAL`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_SUSPENDED`, `SUBJECT_MISMATCH`, `GRADE_MISMATCH`, `DOMAIN_MISMATCH`, `AUTHORITY_MISMATCH`, `SCHOOL_SCOPE_MISMATCH`, `SELF_REVIEW`, `PRIOR_REVIEWER`, `DECLARED_CONFLICT`, `CAPACITY_REACHED`, `CALIBRATION_REQUIRED`, and `STALE_REVISION`.

## 6. Risk queue design

Risk routing is deterministic and policy-versioned. It uses bands first, then a score within each band, so queue age or throughput can never move ordinary work above critical work.

Priority bands:

1. `CRITICAL`: learner safety, legal sensitivity, urgent factual harm, revoked content still in use, or an explicit policy exception.
2. `HIGH`: national publication, WAEC-authoritative claims, high-impact health/history/civics content, reinstatement, provenance/evidence gaps with broad learner impact, or policy score above the high threshold.
3. `STANDARD`: ordinary qualified review.
4. `LOW`: sampling, calibration, and low-impact housekeeping.

Human-readable priority inputs:

- latest P2-A risk score and reasons plus P2-B policy version
- subject and grade sensitivity
- learner impact estimate and current assignment/publication state
- WAEC topic and national curriculum significance
- factual, safety, legal, cultural, or accessibility sensitivity
- provenance completeness and evidence gaps
- prior rejection, return, repeated regeneration, or reversal
- exact revision age, queue age, and SLA status
- active learner or teacher flags and performance signals

Within a band, `priorityScore` is a stored projection and `priorityReasons` is stored JSON. Queue ordering is `priorityBand`, `priorityScore desc`, `dueAt asc`, `createdAt asc`. Age points are capped and cannot cross a band boundary.

The existing weekly review budget behavior must be retired for P2-B. Exhausted reviewer capacity may raise an alert, pause generation, or extend a low-risk SLA. It must never auto-approve high-risk content.

## 7. Two-person review rules

Two distinct people are required for an approval, reapproval, or reinstatement when any condition applies:

- HIGH or CRITICAL policy band
- national curriculum publication
- WAEC-authoritative or WAEC-aligned official content
- sensitive health, safety, civics, history, or legal content as configured by policy
- major revocation reversal or exceptional policy case
- an explicit MOE or platform governance directive

Slot rules:

| Case | First slot | Second slot | Independence |
|---|---|---|---|
| National curriculum | subject-qualified reviewer | MOE-authorized reviewer with matching scope | Distinct users; one person cannot fill both slots. |
| WAEC authoritative | WAEC subject credential | second subject-qualified or MOE reviewer per policy | Distinct users; at least one WAEC credential. |
| Safety/accessibility specialist | subject reviewer | matching specialist | Distinct users and complementary credential domains. |
| High-risk ordinary content | subject-qualified reviewer | independently qualified reviewer | Same credential type may be allowed, never same person. |
| Reinstatement after revocation | subject or specialist reviewer | senior authority/resolver | Distinct users; authority at least equal to revoking authority. |

Low-risk teacher drafts normally require one school-authorized, subject-qualified review. Existing approved school policy may still permit automated low-risk approval only when P2-A provenance is VERIFIED and P2-B policy explicitly allows it.

Fail-closed negative actions:

- A qualified reviewer may `RETURN_FOR_REVISION` immediately when the content is not being published. The resulting edit creates a new immutable revision and new task.
- A lasting national `REJECT` follows the required review count.
- An urgent qualified revocation may take effect immediately for safety. Reinstatement always follows the full policy and never treats the urgent actor as both reviewers.

## 8. Locking and claim design

Use a database-backed renewable lease. UI state is never authoritative.

Claim algorithm:

1. Begin a transaction and lock the task row.
2. Recompute eligibility and verify the task/revision state.
3. Expire any active assignment whose lease has elapsed.
4. Insert a new assignment attempt for the required slot.
5. Enforce a partial unique index for one active assignment per task and slot.
6. Set a 15-minute initial lease, return assignment ID and optimistic version, and write required audit records.

Heartbeat extends the lease by 15 minutes up to a configurable maximum continuous claim duration. It uses compare-and-set on assignment ID, reviewer ID, version, active status, and unexpired lease. Every successful heartbeat increments `version`.

Release marks the attempt `RELEASED`; expiry marks it `EXPIRED`; admin override marks it `OVERRIDDEN`. Each creates a required audit row. The task returns to `QUEUED` or `AWAITING_SECOND_REVIEW` according to completed assessments.

Submission rejects with HTTP 409 when:

- assignment lease expired or version changed
- assignment belongs to another reviewer
- task revision is no longer current
- reviewer eligibility changed
- required credential expired, was suspended, or was revoked
- another transaction already completed the slot or task

## 9. Review-task state machine

Operational states:

```text
QUEUED -> CLAIMED -> IN_REVIEW
IN_REVIEW -> QUEUED                    on release or lease expiry with no completed slot
IN_REVIEW -> AWAITING_SECOND_REVIEW    on accepted first assessment
AWAITING_SECOND_REVIEW -> CLAIMED      on second claim
IN_REVIEW -> DISAGREEMENT              when required submitted recommendations conflict
DISAGREEMENT -> ESCALATED              when a resolver task is opened
ESCALATED -> CLAIMED                   on resolver claim
IN_REVIEW -> COMPLETED                 on policy-satisfied final outcome
any nonterminal -> CANCELLED_STALE      when the target revision is superseded
any nonterminal -> CANCELLED            by an authorized, audited operator
```

Task state is operational only. P2-A lifecycle remains DRAFT, PENDING_REVIEW, APPROVED, REJECTED, REVOKED, or SUPERSEDED.

Individual submitted assessments are never overwritten. A changed lesson creates a new P2-A revision and a new P2-B task. Reapproval does not reopen or mutate the old task.

## 10. Rubric design

P2-B uses append-only code-versioned rubric definitions plus an immutable assessment snapshot. This matches the P2-A prompt archive pattern and avoids a premature rubric CMS.

Core V1 dimensions:

- standards alignment
- factual correctness
- age appropriateness
- instructional clarity and quality
- assessment alignment
- localization and cultural accuracy
- accessibility
- safety
- evidence/source quality
- language quality

Conditional dimensions:

- WAEC relevance and command-word/mark-scheme alignment when WAEC scope applies
- specialist accessibility or safety dimension when task policy requires it

Each dimension records outcome (`PASS`, `CONCERN`, `FAIL`, `NOT_APPLICABLE`), severity, rationale, and evidence references. `NOT_APPLICABLE` is distinct from missing. The rubric also records an overall recommendation: APPROVE, REJECT, RETURN_FOR_REVISION, ESCALATE, or ABSTAIN_CONFLICT.

Reuse existing quality systems only as inputs:

- the elite rubric covers content structure and pedagogy but not qualified governance
- content QA supplies advisory grade/factual/alignment signals
- mechanical quality gates supply word-count and structural checks
- P2-A evidence supplies revision-specific sources

P2-B does not implement Curriculum V2 or Global Pedagogy Intelligence. More advanced pedagogy dimensions can be added as a new rubric version.

## 11. Calibration model

Calibration is scope-specific and diagnostic, not a single reviewer score.

Controlled exercises use exact immutable revisions with a versioned reference outcome established by a senior panel. Calibration assessments never create P2-A governance events or change learner-visible content.

Metrics by reviewer, subject, grade band, domain, and time window:

- approval and rejection agreement with the reference panel
- decision agreement among independent reviewers
- per-dimension absolute rubric variance
- disagreement and escalation rate with context
- reversal or reapproval rate on later revisions
- evidence-quality and risk-rating consistency
- median active review time and turnaround time
- drift from the reviewer's earlier calibrated baseline

Reports must show sample size and suppress reviewer-level conclusions below the approved minimum, initially five comparable assessments. No composite ranking or disciplinary threshold is generated. Results identify policy confusion, training need, reviewer drift, ambiguous rubrics, and coverage gaps.

## 12. Disagreement and escalation design

When submitted recommendations conflict, the task enters `DISAGREEMENT`. Both assessments, rationales, rubric responses, credential snapshots, and evidence references remain immutable.

Routing:

- school-owned content: senior school reviewer, then platform governance if the school lacks coverage
- national curriculum: senior subject reviewer with MOE authority
- WAEC-authoritative content: WAEC-authorized senior subject reviewer or approved specialist panel
- platform policy or safety: platform governance specialist, with MOE escalation when national authority is implicated
- conflict about authority itself: MOE super authority or founder-approved governance owner

The resolver must be a third eligible person, cannot be an author or prior reviewer, and must record the rubric deltas and resolution rationale. The resolver's final decision creates the single P2-A governance event. The first two assessments are not overwritten or collapsed into a false consensus.

## 13. Conflict-of-interest design

Automatic conflicts:

- reviewer is `authorUserId` of the target revision
- reviewer authored a material ancestor in the source-revision chain when policy requires independence
- reviewer is the known generator/import initiator or current compatibility editor where P2-A captured that identity
- reviewer already filled another independent slot
- reviewer organization or school equals a prohibited organization/school scope
- active restriction matches revision, provenance root, school, subject, domain, or organization

Manual restrictions cover declared personal, organizational, school, source, or subject conflicts. A reviewer may recuse without penalty; recusal releases the claim and writes required audit evidence.

Existing provenance can enforce authorship and recorded material edit/import identities. Unknown legacy authorship remains unknown and requires reviewer declaration. P2-B must not infer a clean conflict state from missing data.

## 14. RBAC and authority findings

Current application roles are `TEACHER`, `STUDENT`, `GUARDIAN`, `ADMIN`, `DISTRICT_ADMIN`, `MOE_OFFICIAL`, `MOE_SUPER_ADMIN`, and `MOE_DISTRICT_ADMIN`; platform admin is a Boolean bypass.

Do not add global roles such as SUBJECT_REVIEWER or CALIBRATION_ADMIN in P2-B. Use reviewer profiles, credentials, and operation permissions instead.

Authority matrix:

| Actor | Ceiling | Credential still required | Limits |
|---|---|---|---|
| School `ADMIN` | SCHOOL | yes | Own-school content only. No national or MOE authority. |
| Rostered `TEACHER` | SCHOOL reviewer if explicitly enabled | yes | Review portal only, not admin portal; cannot review authored content. |
| `MOE_OFFICIAL` | MOE national | yes | Subject/domain scope still enforced. |
| `MOE_SUPER_ADMIN` | MOE national and escalation | yes for subject decisions; operations privilege alone is not qualification | May manage policy and resolve authority escalations. |
| `MOE_DISTRICT_ADMIN` | Current code has district view only | founder decision | No review decision until explicitly granted and scoped. |
| Platform admin | PLATFORM administrative ceiling | yes for curriculum merits | Cannot label a platform decision as MOE. Emergency platform revocation remains separately governed. |

Proposed permissions, added only after review:

- `curriculum:review:queue_read`
- `curriculum:review:claim`
- `curriculum:review:assess`
- `curriculum:review:resolve`
- `curriculum:review:roster_manage`
- `curriculum:review:credential_verify`
- `curriculum:review:calibration_manage`
- `curriculum:review:reports_read`

Reviewer endpoints use both RBAC and `requireQualifiedReviewer(...)`. Neither check substitutes for the other.

## 15. Reporting design

Operational reports:

- queue volume by band, authority, subject, grade, content type, and state
- oldest item, median/p90 age, SLA warning, and breach count
- completion and turnaround by comparable scope
- active claims, abandoned/expired claims, workload, and throughput
- verified credential coverage and uncovered subject/grade/domain cells
- first/second reviewer availability and bottlenecks

Quality and calibration reports:

- approval/rejection agreement
- disagreement and escalation rates
- rubric-dimension variance
- evidence completeness
- reversal, return, and reapproval on later revisions
- calibration drift with sample-size warnings

Reports separate demand, operational performance, policy outcomes, and calibration. They do not publish a punitive leaderboard. All reviewer-level reports require authorized access and minimum sample thresholds.

## 16. Notification integration

Reuse `NotificationInboxItem` as the primary durable user notification, `sendPushToUser` for timely device alerts, `sendEmail` for escalation and credential-expiry notices, and `NotificationLog` for delivery outcomes where the existing sender supports it.

Events:

- new explicit assignment or eligible high-risk queue alert
- claim warning and claim expiry
- second review required
- disagreement and escalation
- returned for revision and final decision
- credential expiring, suspended, or revoked
- SLA warning and breach

Recipients come from the assignment or deterministic eligible-reviewer lookup, never from every global role holder. Notifications include task ID, exact revision ID or safe task link, priority reason, due time, and action required. Sensitive rationale remains in the authenticated task UI.

Inbox creation for state transitions is part of the transition transaction when a named user must be notified. Push and email are best-effort after commit and may be retried. P2-B does not create a new notification platform.

## 17. P2-C extension points

- `ReviewerCredential.credentialType` supports `WAEC_SUBJECT_REVIEW`, `LICENSED_SOURCE_REVIEW`, and `SOURCE_RIGHTS_VERIFICATION` keys without a global role change.
- Credential scopes support WAEC, imported-source, subject, grade, content-type, and source-authority constraints.
- Eligibility policy can require a WAEC-authorized credential and a separate MOE authority slot.
- Tasks preserve source/evidence-gap risk reasons and exact imported revision.
- Rubric versions can add WAEC answer-key, ambiguity, leakage, duplicate, and rationale checks.
- Qualification snapshots preserve the exact WAEC/source authority used.

P2-B does not create rights registers, licenses, past-paper imports, or source ownership claims.

## 18. Schema Option A/B/C comparison and qualification snapshot contract

| Criterion | Option A: extend users/P2-A | Option B: dedicated review system including final history | Option C: normalized operations plus P2-A final snapshots |
|---|---|---|---|
| Integrity | Low to medium; arrays/JSON cannot enforce scopes well | High inside B, but duplicates P2-A governance | High; normalized eligibility plus one canonical lifecycle |
| Simplicity | Superficially simple, policy logic becomes scattered | Operationally clear but conceptually duplicate | Moderate and bounded |
| Auditability | Weak qualification history | Strong but split histories | Strong with explicit responsibility boundary |
| Queryability | Poor for coverage and eligibility | Strong | Strong |
| Migration risk | Low DDL count, high semantic risk to live tables | High | Additive and isolated |
| P2-A compatibility | Risks overloading immutable events and `User` | Duplicates P2-A | Preserves P2-A exactly |
| P2-C readiness | Weak | Strong | Strong |
| School/MOE scale | Weak global-role model | Strong | Strong |

Recommendation: Option C.

P2-A snapshot V1:

```json
{
  "schema": "liberialearn.p2b.reviewer-qualification-snapshot",
  "version": 1,
  "decisionId": "p2b-decision-id",
  "taskId": "p2b-task-id",
  "revisionId": "immutable-revision-id",
  "reviewPolicy": { "key": "qualified-review", "version": "1.0.0" },
  "rubric": { "key": "curriculum-core", "version": "1.0.0" },
  "requiredReviewCount": 2,
  "resultingAuthority": "MOE",
  "reviewers": [
    {
      "slot": "FIRST",
      "userId": "user-id",
      "profileId": "profile-id",
      "role": "MOE_OFFICIAL",
      "organizationType": "MOE",
      "organizationRef": "moe-liberia",
      "credentialId": "credential-id",
      "credentialScopeId": "scope-id",
      "credentialType": "WAEC_SUBJECT_REVIEW",
      "issuer": "issuer-name",
      "reviewAuthority": "MOE",
      "subject": "MATH",
      "gradeMin": 10,
      "gradeMax": 12,
      "domain": null,
      "curriculumScope": "WAEC",
      "validFrom": "ISO-8601",
      "validUntil": "ISO-8601 or null",
      "statusAtDecision": "VERIFIED",
      "verifiedAt": "ISO-8601",
      "eligibilityPolicyVersion": "1.0.0"
    }
  ]
}
```

The snapshot contains no mutable display-name dependency and no secret credential evidence. Names may be joined for current UI display, but IDs and qualification facts are sufficient for historical interpretation.

## 19. Recommended architecture

Services:

- `reviewPolicy.ts`: policy versions, risk band, required slots, SLA, and rubric selection
- `reviewEligibility.ts`: deterministic eligibility with reason codes
- `reviewQueue.ts`: task creation, reprioritization, filters, and stale cancellation
- `reviewClaims.ts`: claim, heartbeat, release, expiry, and admin override
- `reviewAssessments.ts`: draft save, immutable submit, rubric validation, and conflict detection
- `reviewDecision.ts`: policy satisfaction, P2-A transaction coupling, and final outcome
- `reviewCalibration.ts`: controlled exercises and scope-specific metrics
- `reviewReporting.ts`: operational and quality aggregates
- `reviewNotifications.ts`: existing-channel orchestration

All mutation APIs call these services. No API route writes task, assessment, decision, P2-A governance, or compatibility status directly.

## 20. Exact proposed schema

This is the recommended Prisma design draft. Names are final-design proposals, not implementation authorization.

```prisma
enum ReviewerProfileStatus { ACTIVE INACTIVE SUSPENDED }
enum ReviewerOrganizationType { MOE SCHOOL PLATFORM EXTERNAL }
enum ReviewerTier { REVIEWER SENIOR SPECIALIST RESOLVER }
enum ReviewerCredentialStatus { DRAFT PENDING_VERIFICATION VERIFIED SUSPENDED REVOKED EXPIRED SUPERSEDED }
enum ReviewerCurriculumScope { NATIONAL SCHOOL WAEC IMPORTED_SOURCE }
enum ReviewerRestrictionType { CONTENT RECUSAL SCHOOL ORGANIZATION SUBJECT DOMAIN }
enum CurriculumReviewTaskStatus { QUEUED CLAIMED IN_REVIEW AWAITING_SECOND_REVIEW DISAGREEMENT ESCALATED COMPLETED CANCELLED CANCELLED_STALE }
enum CurriculumReviewPriorityBand { CRITICAL HIGH STANDARD LOW }
enum CurriculumReviewSlot { FIRST SECOND RESOLUTION }
enum CurriculumReviewAssignmentStatus { CLAIMED IN_REVIEW RELEASED EXPIRED OVERRIDDEN COMPLETED }
enum CurriculumReviewAssessmentStatus { DRAFT SUBMITTED VOIDED }
enum CurriculumReviewRecommendation { APPROVE REJECT RETURN_FOR_REVISION ESCALATE ABSTAIN_CONFLICT }
enum CurriculumReviewDecisionOutcome { APPROVED REAPPROVED REJECTED RETURNED_FOR_REVIEW REVOKED REINSTATED SUPERSEDED }
enum ReviewCalibrationSessionStatus { DRAFT OPEN CLOSED CANCELLED }

model ReviewerProfile {
  id                  String                   @id @default(cuid())
  userId              String                   @unique
  status              ReviewerProfileStatus    @default(INACTIVE)
  organizationType    ReviewerOrganizationType
  organizationRef     String?
  schoolId            String?
  districtId          String?
  tier                ReviewerTier             @default(REVIEWER)
  languageCodes       String[]                 @default([])
  weeklyCapacity      Int                      @default(5)
  maxConcurrentClaims Int                      @default(1)
  availableForReview  Boolean                  @default(false)
  createdAt           DateTime                 @default(now())
  updatedAt           DateTime                 @updatedAt
  user                User                     @relation(fields: [userId], references: [id], onDelete: Restrict)
  school              School?                  @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  district            District?                @relation(fields: [districtId], references: [id], onDelete: Restrict)
  credentials         ReviewerCredential[]
  restrictions        ReviewerRestriction[]
  assignments         CurriculumReviewAssignment[]
  assessments         CurriculumReviewAssessment[]
  calibrationResults  ReviewCalibrationResult[]
  @@index([status, availableForReview])
  @@index([organizationType, organizationRef])
  @@index([schoolId, status])
  @@index([districtId, status])
}

model ReviewerCredential {
  id                    String                   @id @default(cuid())
  reviewerProfileId     String
  credentialType        String
  issuerName            String
  issuerRef             String?
  reviewAuthority       CurriculumReviewAuthority
  validFrom             DateTime
  validUntil            DateTime?
  status                ReviewerCredentialStatus @default(DRAFT)
  evidenceRef           String?
  notes                 String?                  @db.Text
  verifiedByUserId      String?
  verifiedAt            DateTime?
  supersedesCredentialId String?                 @unique
  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt
  reviewerProfile       ReviewerProfile          @relation(fields: [reviewerProfileId], references: [id], onDelete: Restrict)
  verifiedBy            User?                    @relation("ReviewerCredentialVerifier", fields: [verifiedByUserId], references: [id], onDelete: Restrict)
  supersedes            ReviewerCredential?      @relation("ReviewerCredentialSupersession", fields: [supersedesCredentialId], references: [id], onDelete: Restrict)
  supersededBy          ReviewerCredential?      @relation("ReviewerCredentialSupersession")
  scopes                ReviewerCredentialScope[]
  statusEvents          ReviewerCredentialStatusEvent[]
  assessments           CurriculumReviewAssessment[]
  @@index([reviewerProfileId, status, validUntil])
  @@index([credentialType, status])
  @@index([reviewAuthority, status])
}

model ReviewerCredentialScope {
  id                   String                  @id @default(cuid())
  credentialId         String
  subjectCode          String?
  gradeMin             Int?
  gradeMax             Int?
  domainCode           String?
  contentType          String?
  curriculumScope      ReviewerCurriculumScope
  standardFamily       String?
  sourceAuthorityCode  String?
  countyCode           String?
  districtId           String?
  schoolId             String?
  createdAt            DateTime                @default(now())
  credential           ReviewerCredential      @relation(fields: [credentialId], references: [id], onDelete: Restrict)
  district             District?               @relation(fields: [districtId], references: [id], onDelete: Restrict)
  school               School?                 @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  assessments          CurriculumReviewAssessment[]
  @@index([credentialId])
  @@index([subjectCode, gradeMin, gradeMax, curriculumScope])
  @@index([domainCode, curriculumScope])
  @@index([schoolId, subjectCode])
  @@index([districtId, subjectCode])
}

model ReviewerCredentialStatusEvent {
  id                 String                   @id @default(cuid())
  credentialId       String
  fromStatus         ReviewerCredentialStatus?
  toStatus           ReviewerCredentialStatus
  reason             String?                  @db.Text
  actorUserId        String
  auditLogId         String                   @unique
  occurredAt         DateTime                 @default(now())
  credential         ReviewerCredential       @relation(fields: [credentialId], references: [id], onDelete: Restrict)
  actor              User                     @relation("ReviewerCredentialStatusActor", fields: [actorUserId], references: [id], onDelete: Restrict)
  auditLog           AuditLog                 @relation("ReviewerCredentialStatusAudit", fields: [auditLogId], references: [id], onDelete: Restrict)
  @@index([credentialId, occurredAt])
}

model ReviewerRestriction {
  id                String                  @id @default(cuid())
  reviewerProfileId String
  restrictionType   ReviewerRestrictionType
  provenanceId      String?
  revisionId        String?
  schoolId          String?
  organizationRef   String?
  subjectCode       String?
  domainCode        String?
  reason            String                  @db.Text
  effectiveFrom     DateTime                @default(now())
  effectiveUntil    DateTime?
  createdByUserId   String
  auditLogId        String                  @unique
  createdAt         DateTime                @default(now())
  reviewerProfile   ReviewerProfile         @relation(fields: [reviewerProfileId], references: [id], onDelete: Restrict)
  provenance        CurriculumProvenance?   @relation(fields: [provenanceId], references: [id], onDelete: Restrict)
  revision          CurriculumContentRevision? @relation(fields: [revisionId], references: [id], onDelete: Restrict)
  school            School?                 @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  createdBy         User                    @relation("ReviewerRestrictionCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  auditLog          AuditLog                @relation("ReviewerRestrictionAudit", fields: [auditLogId], references: [id], onDelete: Restrict)
  @@index([reviewerProfileId, effectiveFrom, effectiveUntil])
  @@index([revisionId, reviewerProfileId])
  @@index([provenanceId, reviewerProfileId])
  @@index([schoolId, reviewerProfileId])
}

model CurriculumReviewTask {
  id                       String                       @id @default(cuid())
  provenanceId             String
  revisionId               String
  workflowKey              String                       @unique
  status                   CurriculumReviewTaskStatus   @default(QUEUED)
  priorityBand             CurriculumReviewPriorityBand
  priorityScore            Int
  priorityReasons          Json
  riskScore                Int?
  riskReasons              String[]                     @default([])
  reviewPolicyKey          String
  reviewPolicyVersion      String
  rubricKey                String
  rubricVersion            String
  requiredAuthority        CurriculumReviewAuthority
  requiredReviewCount      Int                          @default(1)
  requiredSpecialistDomains String[]                    @default([])
  schoolId                 String?
  dueAt                    DateTime
  completedAt              DateTime?
  cancelledAt              DateTime?
  cancellationReason       String?
  version                  Int                          @default(1)
  createdAt                DateTime                     @default(now())
  updatedAt                DateTime                     @updatedAt
  provenance               CurriculumProvenance         @relation(fields: [provenanceId], references: [id], onDelete: Restrict)
  revision                 CurriculumContentRevision    @relation(fields: [revisionId, provenanceId], references: [id, provenanceId], onDelete: Restrict)
  school                   School?                      @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  assignments              CurriculumReviewAssignment[]
  assessments              CurriculumReviewAssessment[]
  decision                 CurriculumReviewDecision?
  @@index([status, priorityBand, priorityScore, dueAt])
  @@index([revisionId, status])
  @@index([provenanceId, createdAt])
  @@index([schoolId, status, dueAt])
}

model CurriculumReviewAssignment {
  id                String                           @id @default(cuid())
  taskId            String
  slot              CurriculumReviewSlot
  reviewerProfileId String
  status            CurriculumReviewAssignmentStatus @default(CLAIMED)
  claimedAt         DateTime                         @default(now())
  leaseExpiresAt    DateTime
  lastHeartbeatAt   DateTime?
  releasedAt        DateTime?
  releaseReason     String?
  completedAt       DateTime?
  assignedByUserId  String?
  version           Int                              @default(1)
  createdAt         DateTime                         @default(now())
  updatedAt         DateTime                         @updatedAt
  task              CurriculumReviewTask             @relation(fields: [taskId], references: [id], onDelete: Restrict)
  reviewerProfile   ReviewerProfile                  @relation(fields: [reviewerProfileId], references: [id], onDelete: Restrict)
  assignedBy        User?                            @relation("CurriculumReviewAssignedBy", fields: [assignedByUserId], references: [id], onDelete: Restrict)
  assessment        CurriculumReviewAssessment?
  @@index([taskId, slot, status])
  @@index([reviewerProfileId, status, leaseExpiresAt])
  @@index([leaseExpiresAt, status])
}

model CurriculumReviewAssessment {
  id                       String                           @id @default(cuid())
  taskId                   String
  assignmentId             String                           @unique
  reviewerProfileId        String
  slot                     CurriculumReviewSlot
  status                   CurriculumReviewAssessmentStatus @default(DRAFT)
  credentialId             String
  credentialScopeId        String
  credentialSnapshot       Json
  reviewerRoleSnapshot     String
  rubricKey                String
  rubricVersion            String
  rubricSnapshot           Json
  rubricResponses          Json
  recommendation           CurriculumReviewRecommendation?
  rationale                String?                          @db.Text
  evidenceRefs             Json?
  reviewerRiskScore        Int?
  reviewerRiskReasons      String[]                         @default([])
  submittedAt              DateTime?
  version                  Int                              @default(1)
  createdAt                DateTime                         @default(now())
  updatedAt                DateTime                         @updatedAt
  task                     CurriculumReviewTask             @relation(fields: [taskId], references: [id], onDelete: Restrict)
  assignment               CurriculumReviewAssignment       @relation(fields: [assignmentId], references: [id], onDelete: Restrict)
  reviewerProfile          ReviewerProfile                  @relation(fields: [reviewerProfileId], references: [id], onDelete: Restrict)
  credential               ReviewerCredential               @relation(fields: [credentialId], references: [id], onDelete: Restrict)
  credentialScope          ReviewerCredentialScope          @relation(fields: [credentialScopeId], references: [id], onDelete: Restrict)
  @@unique([taskId, slot, reviewerProfileId])
  @@index([taskId, status, slot])
  @@index([reviewerProfileId, submittedAt])
  @@index([credentialId, submittedAt])
}

model CurriculumReviewDecision {
  id                       String                          @id @default(cuid())
  taskId                   String                          @unique
  outcome                  CurriculumReviewDecisionOutcome
  resolverUserId           String
  resolverRoleSnapshot     String
  resultingAuthority       CurriculumReviewAuthority
  qualificationSnapshot    Json
  rationale                String                          @db.Text
  governanceEventId        String                          @unique
  auditLogId               String                          @unique
  decidedAt                DateTime                        @default(now())
  createdAt                DateTime                        @default(now())
  task                     CurriculumReviewTask            @relation(fields: [taskId], references: [id], onDelete: Restrict)
  resolver                 User                            @relation("CurriculumReviewDecisionResolver", fields: [resolverUserId], references: [id], onDelete: Restrict)
  governanceEvent          CurriculumGovernanceEvent       @relation("CurriculumReviewDecisionGovernance", fields: [governanceEventId], references: [id], onDelete: Restrict)
  auditLog                 AuditLog                        @relation("CurriculumReviewDecisionAudit", fields: [auditLogId], references: [id], onDelete: Restrict)
  @@index([outcome, decidedAt])
  @@index([resultingAuthority, decidedAt])
}

model ReviewCalibrationSession {
  id                   String                         @id @default(cuid())
  name                 String
  status               ReviewCalibrationSessionStatus @default(DRAFT)
  policyKey            String
  policyVersion        String
  rubricKey            String
  rubricVersion        String
  scopeDefinition      Json
  sampleDefinition     Json
  referenceSnapshot    Json
  opensAt              DateTime?
  closesAt             DateTime?
  createdByUserId      String
  createdAt            DateTime                       @default(now())
  updatedAt            DateTime                       @updatedAt
  createdBy            User                           @relation("ReviewCalibrationCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  results              ReviewCalibrationResult[]
  @@index([status, opensAt, closesAt])
}

model ReviewCalibrationResult {
  id                  String                    @id @default(cuid())
  sessionId           String
  reviewerProfileId   String
  revisionId          String
  assessmentSnapshot  Json
  metricSnapshot      Json
  completedAt         DateTime                  @default(now())
  session             ReviewCalibrationSession  @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  reviewerProfile     ReviewerProfile           @relation(fields: [reviewerProfileId], references: [id], onDelete: Restrict)
  revision            CurriculumContentRevision @relation(fields: [revisionId], references: [id], onDelete: Restrict)
  @@unique([sessionId, reviewerProfileId, revisionId])
  @@index([reviewerProfileId, completedAt])
  @@index([revisionId, completedAt])
}
```

Required migration SQL beyond Prisma:

- CHECK grade bounds are 1 through 12 and `gradeMin <= gradeMax`.
- CHECK verified credential has `verifiedByUserId` and `verifiedAt`.
- CHECK submitted assessment has recommendation, rationale, and `submittedAt`.
- CHECK completed task has a decision and no active claim, enforced by the service and deferred trigger where practical.
- Partial unique index on `(taskId, slot)` for assignment status `CLAIMED` or `IN_REVIEW`.
- Trigger preventing update/delete of submitted assessments, decisions, credential status events, and calibration results.
- Trigger preventing update/delete of credential core/scopes after first VERIFIED status, except controlled status projection and supersession fields.
- `onDelete: Restrict` for all governance and reviewer identity links.

The implementation also adds Prisma-only relation backfields to `User`, `School`,
`District`, `AuditLog`, `CurriculumProvenance`, `CurriculumContentRevision`, and
`CurriculumGovernanceEvent`. Those array or optional backfields do not add columns
to the existing tables. All physical foreign-key columns live on the new P2-B
tables.

The apparent decision `auditLogId` and P2-A event `auditLogId` should point to the same required audit row. The implementation must create one row and set both foreign keys inside the transaction, not create duplicate audit entries for the same final decision.

## 21. Exact migration and backfill strategy

1. Obtain explicit advisor/founder approval for the production-live schema addition.
2. Migration A adds P2-B enums and tables only. It does not alter P2-A columns, P2-A history, `User.role`, or compatibility status fields.
3. Migration B adds partial indexes, CHECK constraints, append-only triggers, and post-verification credential guards.
4. Deploy application code with `P2B_REVIEW_OPERATIONS_ENABLED=false`. New tables remain unused.
5. Dry-run candidate roster report from existing `User` roles. It may suggest accounts for manual review, but writes no profiles or credentials.
6. Human operators create profiles and enter evidence-backed credentials. New credentials start `PENDING_VERIFICATION`; an independent authorized verifier moves them to VERIFIED.
7. No credentials are inferred from `ADMIN`, `TEACHER`, MOE role, email domain, historical approval, or employment title.
8. Historical P2-A governance remains unchanged. Reports label qualification as `UNKNOWN` when the P2-A snapshot is null.
9. Dry-run pending-task bootstrap resolves each candidate to its exact current P2-A revision and reports duplicates, missing roots, stale lifecycle, invalid school scope, and risk gaps.
10. Create tasks only for currently pending work after dry-run approval. Do not create fictional historical tasks, assessments, assignments, or SLA timestamps.
11. Run shadow eligibility and queue ordering in staging. Legacy routes still decide during this phase, while parity reports compare outcomes.
12. Convert direct human decision routes to P2-B adapters and remove high-risk budget auto-approval in staging.
13. Run concurrency and staging E2E. Verify P2-A event snapshots and compatibility projections.
14. Obtain separate authorization for production migration, roster activation, route cutover, and workflow enablement.
15. Enable by authority/scope in stages: platform test fixtures, one school workflow, MOE national workflow, then general coverage.

Rollback before activation is application disable plus leaving additive tables in place. After P2-B decisions exist, history is never deleted; rollback disables new task creation and routes decisions through an explicitly reviewed forward-fix.

## 22. API plan

Roster and credential administration:

- `GET/POST /api/admin/review-operations/reviewers`
- `GET/PATCH /api/admin/review-operations/reviewers/:profileId`
- `POST /api/admin/review-operations/reviewers/:profileId/credentials`
- `GET /api/admin/review-operations/credentials/:credentialId`
- `POST /api/admin/review-operations/credentials/:credentialId/verify`
- `POST /api/admin/review-operations/credentials/:credentialId/suspend`
- `POST /api/admin/review-operations/credentials/:credentialId/revoke`
- `POST /api/admin/review-operations/credentials/:credentialId/supersede`
- `POST /api/admin/review-operations/eligibility/check`

Reviewer operations:

- `GET /api/review/tasks` with band, subject, grade, authority, state, SLA, and eligible-only filters
- `GET /api/review/tasks/:taskId` returning exact revision, P2-A provenance/evidence, policy, rubric, assessments allowed for the caller, and claim state
- `POST /api/review/tasks/:taskId/claim`
- `POST /api/review/assignments/:assignmentId/heartbeat`
- `POST /api/review/assignments/:assignmentId/release`
- `PUT /api/review/assignments/:assignmentId/assessment` for optimistic draft save
- `POST /api/review/assignments/:assignmentId/submit`
- `POST /api/review/tasks/:taskId/escalate`
- `POST /api/review/tasks/:taskId/resolve`

Operations and reports:

- `POST /api/admin/review-operations/tasks` for controlled enqueue/review request
- `POST /api/admin/review-operations/tasks/:taskId/override-claim`
- `POST /api/admin/review-operations/tasks/:taskId/cancel`
- `GET /api/admin/review-operations/reports/queue`
- `GET /api/admin/review-operations/reports/reviewers`
- `GET /api/admin/review-operations/reports/coverage`
- `GET/POST /api/admin/review-operations/calibration/sessions`
- `GET /api/admin/review-operations/calibration/sessions/:sessionId/results`

All mutation requests require an idempotency key, optimistic version where applicable, required audit, and explicit 409 conflicts. Existing approve/reject endpoints return a deprecation header before becoming thin P2-B adapters.

## 23. Operational UI plan

Minimum safe UI:

- `/review/queue`: eligible tasks only, priority band/reasons, SLA age, subject/grade, authority, second-review need, and claim state
- `/review/tasks/[taskId]`: exact revision preview, stale-revision warning, provenance completeness, origin, standards, WAEC topics, evidence, risk reasons, learner impact, and immutable revision ID
- rubric workspace: autosaved optimistic draft, required rationales, evidence references, conflict/recusal control, and recommendation
- claim banner: owner, lease countdown, heartbeat state, release, and lost-claim behavior
- two-person panel: completed slot without exposing first recommendation to a blinded second reviewer where policy requires independent review
- disagreement/resolution panel: both submitted rubrics, deltas, evidence, escalation route, and resolver rationale
- roster and credential admin: verification state, scopes, expiry, suspension/revocation, and coverage gaps
- operations dashboard: queue volume/aging, claims, workload, credential coverage, SLA, disagreement, and calibration summaries
- calibration workspace and report with minimum-sample warnings

Reuse the existing lesson preview, P2-A provenance explanation, coverage UI, audit UI, and notification bell. Do not redesign student or teacher learning experiences.

## 24. Test plan

Unit tests:

- subject, grade, domain, content type, curriculum, geography, and authority matching
- expired, suspended, revoked, unverified, and superseded credentials
- application role ceiling and profile availability/capacity
- automatic authorship/source-chain conflicts and declared restrictions
- deterministic risk band, score, reasons, age cap, and SLA
- two-person slot matrix and specialist/authority combinations
- rubric validation, `NOT_APPLICABLE`, and recommendation rules
- calibration metric formulas and minimum-sample suppression

Database/integration tests:

- two simultaneous claims produce exactly one active assignment for one slot
- lease heartbeat CAS, release, expiry, re-claim, and admin override
- stale revision between claim and submit returns 409 and creates no P2-A event
- credential revoked between claim and submit blocks submission
- same reviewer cannot fill two independent slots
- submitted assessments, decisions, status events, and calibration results reject update/delete
- qualification snapshot is byte-stable/canonical and includes all reviewers
- task completion and P2-A event/audit commit or roll back together
- first review, second review, agreement, disagreement, escalation, resolver decision
- safe immediate return for revision and new-revision reapproval workflow
- urgent revocation and two-person reinstatement
- unauthorized and cross-tenant queue/action access
- legacy route adapter cannot bypass eligibility or two-person policy
- risk capacity exhaustion never auto-approves high-risk content
- historical P2-A null qualification remains null/unknown

Route/UI/E2E tests:

- queue filters and eligible-only visibility
- exact revision/provenance/evidence rendering
- claim loss and stale form handling
- blinded second review where configured
- MOE, school, and platform authority distinctions
- notification events and links
- workload, coverage, disagreement, calibration, and SLA reports
- staging full path from task creation to signed P2-A governance snapshot and learner availability consequence

Mandatory gate for every implementation sprint:

1. `npx prisma generate`
2. `npx tsc --noEmit`
3. `npx vitest run`
4. `npm run build`

## 25. P2-B completion gate

P2-B is complete only when all are true:

1. Reviewer roster is operational with active/inactive/suspended status and capacity.
2. Scoped, evidence-backed credentials are verified and enforced.
3. Credential issuance and status history is auditable; no credential is fabricated.
4. Queue creation and ordering are deterministic and explainable.
5. High-risk capacity pressure cannot result in automatic approval.
6. Claim and lease concurrency is proven with real database tests.
7. Every task, assessment, decision, and governance event targets an exact immutable revision.
8. Stale revisions and changed eligibility fail closed.
9. Two-person rules work for all configured national, WAEC, high-risk, specialist, and reinstatement cases.
10. Separation of duties and conflicts are enforced.
11. Submitted assessments and disagreements are preserved.
12. Escalation and resolver authority are operational.
13. Reject, return, revision, reapproval, revoke, and reinstate workflows are distinct and tested.
14. Qualification snapshots remain understandable after expiry, revocation, role change, and departure.
15. RBAC, tenant isolation, authority, and qualification checks all apply.
16. Queue aging, workload, coverage, agreement, disagreement, escalation, reversal, and calibration reports operate with sample warnings.
17. Existing notification channels deliver assignment, SLA, disagreement, escalation, return, and credential events.
18. P2-A governance remains the canonical lifecycle and immutable final history.
19. Existing P2-A history remains unchanged and honest.
20. P2-C WAEC/source-review credential extensions are proven without implementing rights/licensing.
21. All mandatory tests and build pass.
22. Staging E2E passes with database concurrency, P2-A event, audit, compatibility projection, and rollback evidence.
23. Human review approves production migration and workflow activation separately.

## 26. Founder and advisor decisions required

1. MOE publish semantics: is curriculum-version activation an approval, a release action requiring prior qualified approval, or both? Recommended: release action only, and every included current revision must already have a qualifying MOE governance decision.
2. Authority policy for school content: may school authority publish only within its school, and can any school content enter the national library without a later MOE decision? Recommended: school-only publication until MOE review.
3. `MOE_DISTRICT_ADMIN`: remain read-only or become eligible for district-scoped review with verified credentials? Recommended: read-only until explicitly approved.
4. Teacher subject experts: may rostered `TEACHER` users review content they did not author? Recommended: yes, through `/review`, with explicit school or MOE credential and conflict checks.
5. Two-person matrix thresholds: approve the initial sensitive subjects/domains, risk thresholds, and national/WAEC requirements.
6. Blinding policy: should second reviewers see the first recommendation before submitting? Recommended: no for calibration and high-risk independent review; yes only for explicit collaborative resolution.
7. Evidence minimums: which subjects/content types require source evidence before approval? This is carried from P2-A and remains necessary.
8. Reviewer credential issuers and verifiers: name the authorized MOE, school, and platform owners who may verify each credential type.
9. Review SLA: approve initial targets. Recommended starting point: CRITICAL 4 hours, HIGH 24 hours, STANDARD 5 business days, LOW 10 business days, with operational review after real data.
10. Rubric V1 ownership: approve the core dimensions and who can issue a new rubric version.
11. Calibration governance: approve reference-panel membership, exercise cadence, minimum sample size, and remediation process.
12. Emergency revocation: confirm that one authorized safety reviewer can fail closed immediately while reinstatement requires full two-person review.
13. Platform-admin merits decisions: recommended prohibition unless the operator also has a matching verified credential; emergency operational revocation remains distinct.
14. Existing tenant gap: authorize immediate remediation of cross-school teacher-content moderation before P2-B activation.
15. Schema and migration approval: required by the standing advisor contract before any production-live table change.

## 27. Production safety confirmation

- No production database, deployment, environment variable, reviewer role, curriculum row, P2-A history, qualification, queue, or workflow was changed.
- No schema or migration file was changed.
- No production reviewer qualification was inferred or fabricated.
- The only repository mutation in this sprint is this design document.
- Implementation, staging migration, production migration, backfill, route cutover, and activation remain separate reviewed steps.

Local validation on the design branch:

- Independent repository proof: recorded P2-A production commit exists; 14 of 14 P2-A enums, four of four P2-A models, and 10 immutability/root guards were re-derived from checked-out files.
- `npx prisma generate`: PASS with Prisma Client 6.19.3.
- `npx tsc --noEmit`: PASS.
- `npx vitest run`: PASS, 4,669 tests in 571 files.
- `npm run build`: PASS, 377 static pages generated. Existing lint, image optimization, dependency, browsers-list, and dynamic-route warnings remain warning-only.
- `git diff --check`: PASS.

**P2-B QUALIFIED REVIEW OPERATIONS DESIGN COMPLETE  IMPLEMENTATION AWAITS REVIEW**
