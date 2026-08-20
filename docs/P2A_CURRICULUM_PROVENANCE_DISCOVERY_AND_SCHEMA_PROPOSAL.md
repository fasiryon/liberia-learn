# P2-A Curriculum Provenance Discovery and Schema Proposal

## Sprint status

- Sprint: P2-A Curriculum Provenance Discovery + Schema Proposal
- Status: Discovery and design complete
- Implementation: Not started
- Files changed during discovery: None
- Validation: Read-only repository inspection completed. `git diff --check` passed and `prisma/schema.prisma` had no diff.
- Escalation: Schema review is required before Prisma edits, migrations, backfills, production writes, generation changes, or approval changes.

## 1. Executive summary

The repository does not currently have one canonical curriculum provenance record. Provenance is fragmented across mutable `CurriculumContent.payload` JSON, scalar content fields, `AIInteraction`, `AuditLog`, MOE alignment JSON, regeneration jobs, and two version tables that do not provide immutable national-governance history.

The strongest existing pieces are:

- `AIInteraction` for model execution, tokens, cost, provider, and optional prompt metadata.
- `AuditLog` for actions that are actually logged, protected by database update/delete prevention.
- The prompt registry for current prompt keys, semantic-looking versions, and SHA-256 hashes.
- `Standard` and `moeAlignments` for current curriculum alignment.
- Signed availability manifests for offline cache invalidation after a client refresh.

The principal failures are:

- Most AI calls cannot be joined deterministically to the final content revision.
- Approval basis is not explicit.
- Reviewer qualification does not exist.
- `LessonVersion` is pruned and body-only.
- `CurriculumVersion` is a release or operation grouping, not lesson history.
- There is no first-class curriculum evidence collection.
- There is no explicit revocation lifecycle for already-published content.
- Historical rows cannot be assumed to contain provenance that was never recorded.

### Recommendation

Adopt a dedicated provenance table family:

- `CurriculumProvenance`
- `CurriculumContentRevision`
- `CurriculumGovernanceEvent`
- `CurriculumEvidence`
- `CurriculumStandardAlignment`

Add one nullable indexed `generationCorrelationId` to `AIInteraction`.

`CurriculumContent` would receive only a Prisma back-relation. No physical column or row rewrite on the production-live table is required by the recommended design.

## 2. Verified current-state provenance map

| Provenance concern | Current store | Current field(s) | Populated by | Missing from | Canonical today? | Reliability |
|---|---|---|---|---|---|---|
| Content source | Payload and scalars | `payload.metadata.source`, `payload.source`, `teacherCreated`, `derivedFromContentId`, `parentLessonId` | Importer, national factory, unit assembler, forks, selected scripts | Admin AI generation, hero generation, direct regeneration, several seed/textbook paths | No | Low |
| Source standards | `CurriculumContent` scalar JSON and tags | `moeAlignments`, `waecSyllabusTopics`; sometimes payload mirrors | MOE engine, generators, importer, WAEC tagger | Many legacy/generated rows; method/review metadata often absent | `moeAlignments` is operationally canonical | Medium for codes, low for provenance |
| Generator/tool | Payload | `metadata.source`, `metadata.model`, factory/version strings | National factory, generation engine, importer, elite upgrade | Many API and maintenance writers | No | Low |
| Provider | `AIInteraction` | `provider` | Routed AI wrapper | Direct OpenAI scripts and calls without `aiUsage` | Yes for logged execution only | Medium |
| Model | `AIInteraction`, payload | `model`, `payload.metadata.model`, `generationMetadata.model` | Routed calls and selected generators | Several direct SDK and deterministic paths | Execution only | Medium |
| Prompt key | Registry, `AIInteraction`, selected payloads | `promptKey` | Missing-content generator, elite upgrade, parts of curriculum factory | Unit assembler, direct SDK scripts, most V2 calls | No content-level canonical field | Low to medium |
| Prompt version | Registry, `AIInteraction`, selected payloads | `promptVersion` | Missing-content and elite paths | Most curriculum paths | No | Low |
| Prompt hash | Registry, `AIInteraction`, selected payloads | `promptHash` | Missing-content and elite paths | Most curriculum paths | No | Low |
| AI interaction ID | `AIInteraction` | `id`, loose `contentId`, `lessonId` strings | Interaction logger | No final-lesson field; most generators do not pass final ID | No | Low |
| Generation timestamp | Payload and DB timestamps | `generatedAt`, `createdAt`, `updatedAt` | Most factories, inconsistently | Some paths misuse version strings as generated time; regeneration overwrites current state | No | Low |
| Reviewer identity | Payload and audit | `approvedByUserId`, `rejectedByUserId`, `AuditLog.userId` | Human approval/review routes | Policy approval, risk auto-approval, many bulk flows | Human routes only | Medium when transactionally written |
| Review timestamp | Payload and audit | `approvedAt`, `rejectedAt`, audit `createdAt` | Human approval/review routes and scripts | Many bulk/policy approvals | No universal canonical field | Medium |
| Approval basis | Payload convention or audit action | No dedicated field | Inferred from route or action | All flows | No | None |
| Risk score | Payload | `riskScore` | Risk triage | Human approval and historical approval | No | Medium for triaged rows |
| Risk reasons | Payload and audit | `riskReasons` | Risk triage | Same as risk score | No | Medium |
| Flagged state | Payload plus status | `riskFlagged`, `status=NEEDS_REVIEW` | Risk triage | Later approval does not reliably clear flag | No | Medium |
| Evidence | Import/media/WAEC metadata | Filename/hash, media source/license, subject-level source URLs | Importer, media flows, WAEC definitions | Lesson-level evidence, citations, source documents, locators | No | None for governance evidence |
| Version history | `LessonVersion`, `CurriculumVersion`, payload snapshots | Body HTML, metadata, version grouping | Teacher body edit, importer, elite upgrade, MOE release | AI regeneration, approvals, alignment, most updates | No | Low |
| Revocation | Availability response and emergency unpublish | Signed manifest `revoked`, content status | Curriculum GET route, teacher emergency unpublish | Actor, time, reason, replacement, explicit lifecycle | No | None as a governance record |
| Audit trail | `AuditLog` | Action, actor, resource ID/type, details, timestamp | Selected APIs and workers | Several scripts, forks, media, and maintenance writers | Canonical for events actually logged | High but incomplete |
| Legacy provenance state | None | None | Not populated | Every existing row | No | None |

### Key source references

- [`CurriculumContent` schema](../prisma/schema.prisma#L1916)
- [`AIInteraction` schema](../prisma/schema.prisma#L2634)
- [`LessonVersion` schema](../prisma/schema.prisma#L3837)
- [`CurriculumVersion` schema](../prisma/schema.prisma#L2183)
- [Prompt registry](../lib/ai/promptRegistry.ts#L26)
- [AI interaction logger](../lib/ai/interactionLog.ts#L154)
- [AI routing and fire-and-forget logging](../lib/ai/routedCompletion.ts#L480)
- [Canonical/legacy alignment reader](../lib/moe/alignmentReader.ts#L1)
- [Alignment engine](../lib/moe/alignment-engine.ts#L38)
- [Audit immutability migration](../prisma/migrations/20260522_000001_audit_immutability/migration.sql#L1)

## 3. Generation-path findings

### Admin generation

[`app/api/admin/curriculum/generate/route.ts`](../app/api/admin/curriculum/generate/route.ts#L167) runs AI before the `CurriculumContent` upsert. Payload metadata includes model and generated time, but prompt version/hash and interaction ID are not stored on the content. ADMIN generation can record `approvedByUserId`; teacher policy auto-publish produces approved content without an authoritative reviewer.

[`app/api/admin/curriculum/generate-full-pack/route.ts`](../app/api/admin/curriculum/generate-full-pack/route.ts#L166) is deterministic, but uses similar conditional approval conventions and mutable upsert behavior.

### Teacher generation

[`app/api/teacher/generate-lesson/route.ts`](../app/api/teacher/generate-lesson/route.ts#L190) returns an AI-generated draft without creating a content row. The later save in [`app/api/teacher/lessons/route.ts`](../app/api/teacher/lessons/route.ts#L129) is a separate request with no correlation ID. The save route labels content as `ai_teacher_cocreation` even when the final source cannot be proven.

### Curriculum factory and V2 generation

[`lib/ai/curriculum-factory.ts`](../lib/ai/curriculum-factory.ts#L790) records prompt keys on some calls and model metadata in payload, but usually omits prompt version/hash and final content linkage.

[`lib/curriculum/generateLessonV2.ts`](../lib/curriculum/generateLessonV2.ts#L396) makes multiple AI calls before persistence. It logs a `lesson.deep.v2` key for one pass even though that is not a registered prompt key, and it does not persist a full prompt chain.

### Unit assembler

[`lib/ai/units/unitAssembler.ts`](../lib/ai/units/unitAssembler.ts#L332) calls the routed model without `aiUsage`, so no normalized AI interaction is created. It creates AI lessons and deterministic assessments as immediately published/approved content without reviewer, risk, approval basis, or immutable history.

### Elite upgrade

[`lib/curriculum/eliteUpgrade.ts`](../lib/curriculum/eliteUpgrade.ts#L1082) has the best existing prompt-chain payload. It preserves the source row and creates a new draft and `CurriculumVersion`. However, AI interactions point to the source content, not deterministically to the final upgrade draft.

### Import

[`lib/curriculum/importer.ts`](../lib/curriculum/importer.ts#L419) stores import type, format, filename, raw-text hash, import time, and importing user. It does not retain a canonical source document, URL, rights statement, evidence collection, or approval basis.

### National and deterministic factories

[`lib/curriculum/nationalFactory.ts`](../lib/curriculum/nationalFactory.ts#L447) has useful batch ID, session ID, source, and factory-version metadata. [`lib/curriculum/generationEngine.ts`](../lib/curriculum/generationEngine.ts#L186) uses deterministic templates. These sources are distinguishable in selected payloads but not through one validated canonical structure.

### Missing-content and hero generation

[`scripts/generate-missing-curriculum-content.ts`](../scripts/generate-missing-curriculum-content.ts#L508) is the strongest existing AI linkage path because it knows and logs the planned final content ID plus prompt key/version/hash before persistence.

[`scripts/generate-hero-lessons.ts`](../scripts/generate-hero-lessons.ts#L118) also computes the content ID before AI generation, but does not pass it through V2 telemetry.

### Regeneration

[`lib/curriculum/regenerationQueue.ts`](../lib/curriculum/regenerationQueue.ts#L457) stores run/job IDs in payload but does not propagate those IDs into `AIInteraction`. Successful generation overwrites the same content row without an immutable snapshot.

[`scripts/process-regen-jobs-direct.ts`](../scripts/process-regen-jobs-direct.ts#L141), [`scripts/regenerate-approved-lessons.ts`](../scripts/regenerate-approved-lessons.ts#L141), and [`scripts/regenerate-attached-thin-lessons.ts`](../scripts/regenerate-attached-thin-lessons.ts#L137) also overwrite current content without immutable revision history. Some preserve approved status or directly approve replacement content without a new reviewer decision.

### Secondary AI bypasses

- [`scripts/generate-labs-for-approved.ts`](../scripts/generate-labs-for-approved.ts#L159) calls OpenAI directly and writes generated labs into approved payloads without `AIInteraction`, audit, prompt lineage, or revision history.
- [`scripts/generate-textbooks-for-approved.ts`](../scripts/generate-textbooks-for-approved.ts#L216) has the same bypass for textbook chapters.
- [`scripts/tag-waec-content.ts`](../scripts/tag-waec-content.ts#L60) logs an interaction with content ID when optional LLM classification is used, but does not use registry prompt metadata.
- [`scripts/enrich-generated-lessons.ts`](../scripts/enrich-generated-lessons.ts#L142) performs a deterministic substantive payload rewrite with no revision or audit record.

## 4. Approval and review findings

### Human approval

[`app/api/admin/curriculum/approve/route.ts`](../app/api/admin/curriculum/approve/route.ts#L43) is the strongest approval path. It stores reviewer identity/time in payload and writes a required audit record in the same transaction. It still has no explicit approval-basis field or reviewer qualification.

### Rejection

[`app/api/admin/curriculum/reject/route.ts`](../app/api/admin/curriculum/reject/route.ts#L39) stores rejecting user/time but does not store the provided reason in the content payload or scalar `rejectionReason`. Its audit record stores only a boolean indicating that a reason existed. A best-effort feedback row may contain the reason, but is not authoritative.

### Regeneration review

[`lib/curriculum/regenerationAdmin.ts`](../lib/curriculum/regenerationAdmin.ts#L263) supports approval, return-for-review, and rejection with required transactional auditing. It still lacks explicit basis, qualification, and immutable target revision.

### Risk triage

[`lib/curriculum/riskTriage.ts`](../lib/curriculum/riskTriage.ts#L149) stores risk score/reasons and either flags or auto-approves content. Auto-approval basis must be inferred from `AuditLog.action`. Audit writes are not transactionally required. A later human approval does not reliably clear the earlier `riskFlagged` value.

### Teacher-content moderation

[`app/api/admin/content-review/[lessonId]/route.ts`](../app/api/admin/content-review/%5BlessonId%5D/route.ts#L61) updates edit-review status and publication state but retains reviewer identity only in a best-effort audit record.

### Historical production observation

The execution-state document records that 712 of 1,089 approved-equivalent rows lacked approver identity, only 7 had a real `approvedByUserId`, and 41 approval audit actions existed at that time. These are prior documented production observations, not newly queried counts from this discovery. See [`CURRENT_EXECUTION_STATE.md`](roadmaps/CURRENT_EXECUTION_STATE.md#L462).

No authoritative curriculum reviewer qualification or credential model was found. `TeacherProfile` contains teaching scope and permissions, not national-review credentials.

## 5. Alignment and source-standard findings

`CurriculumContent.moeAlignments` is the operationally canonical field today because the canonical reader explicitly consumes it. It has two live shapes:

- Legacy array
- Engine object containing `contentId`, standards, alignment time, and method

The engine can store standard code, description, confidence, time, and method. It does not store:

- AI provider/model
- Prompt key/version/hash
- Reviewer or review status
- Evidence source
- Immutable alignment version

The scalar field and payload mirrors can disagree because not all writers update both. The scalar `moeAlignments` field should be treated as canonical during transition, with conflicts reported rather than silently repaired.

`waecSyllabusTopics` stores stable topic IDs but represents topic tagging, not complete source-standard provenance or evidence.

## 6. Version and history findings

### `LessonVersion`

`LessonVersion` represents a pre-edit teacher body snapshot. It is created only for selected teacher body edits, stores only `bodyHtml` plus optional metadata, and is pruned to 20 records. It does not capture approval, standards, evidence, prompt lineage, full payload, or most scalar state.

Mutations that do not reliably create `LessonVersion` include:

- AI regeneration
- Admin generation upsert
- Teacher save route updates
- Import upsert
- Alignment changes
- Approval/rejection
- Risk triage
- MOE release changes
- Lab/textbook injection
- Maintenance scripts

### `CurriculumVersion`

`CurriculumVersion` is a release or operation grouping with `DRAFT`, `ACTIVE`, and `ARCHIVED` states. It is used by MOE publishing, imports, and elite upgrades. It is not an immutable lesson-revision stream and cannot reconstruct prior content bodies.

### Reconstruction

Old content can be reconstructed only in limited cases:

- Retained teacher body snapshots within the 20-record buffer
- Elite upgrade source row and payload snapshot
- Some imported rows that created new IDs rather than overwriting
- Audit actions, but never content bodies

AI regeneration does not generally create immutable snapshots.

## 7. Evidence findings

No first-class curriculum evidence model, lesson citation collection, bibliography, source attachment relation, or source-document record was found.

Existing partial data is not enough:

- Import filename and raw hash do not preserve the source document.
- Image source/license fields concern visual assets.
- WAEC source strings are subject-level references.
- Runtime RAG citations concern generated AI answers, not governed curriculum.

An evidence model is therefore justified.

## 8. Revocation findings

There is no explicit curriculum revocation record.

[`app/api/curriculum/[contentId]/route.ts`](../app/api/curriculum/%5BcontentId%5D/route.ts#L82) returns a signed `revoked: true` manifest whenever no accessible row is found. This conflates:

- Revocation
- Rejection
- Unpublishing
- Tenant-access denial
- Missing/deleted content
- Other availability failures

[`app/api/admin/content-review/[lessonId]/unpublish/route.ts`](../app/api/admin/content-review/%5BlessonId%5D/unpublish/route.ts#L22) is the closest equivalent, but applies to teacher-created content and does not record a dedicated revocation lifecycle, replacement content, or immutable event.

Offline cache code can invalidate a lesson after a client refreshes its signed manifest. It does not provide immediate push invalidation. Curriculum revocation and offline-cache invalidation are distinct concerns.

## 9. Write-path matrix

Legend: `P` means partial or conditional. `C` means a `CurriculumVersion`, not immutable lesson history. `L` means a pruned `LessonVersion`.

| Write path | Creates content | AI-generated | Sets model | Prompt key | Prompt version | Reviewer | Approval basis | Risk | Audit | Version | Main bypass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Admin AI generation | Yes/upsert | Yes | Yes | P | No | P | No | No | Best effort | No | AI occurs before row; no deterministic interaction link |
| Admin deterministic generation | Yes | No | No | N/A | N/A | P | No | No | Best effort | No | Can auto-publish without basis |
| Full-pack generation | Yes/upsert | No | No | N/A | N/A | P | No | No | Best effort | No | Mutable overwrite |
| Teacher preview | No | Yes | Returned only | P | No | No | No | No | Class audit | No | Correlation lost before save |
| Teacher save/publish | Yes/update | Not in save | No | No | No | No | No | No | Best effort | No | Claims AI co-creation without proof |
| Unit AI lesson | Yes | Yes | No durable field | No | No | No | No | No | Batch only | No | No `AIInteraction`; immediately approved |
| Unit assessment | Yes | No | No | N/A | N/A | No | No | No | Batch only | No | Immediately approved |
| National factory | Yes | No | Factory name | N/A | N/A | No | No | No | No per row | No | Useful batch metadata, no governance record |
| Coverage/expansion | Yes/upsert | No | P | N/A | N/A | No | No | No | No | No | Expansion can publish by CLI flag |
| Missing-content generation | Yes/replace/update | Yes | Yes | Yes | Yes | No | No | Quality only | No | No | Best current content-ID linkage |
| Hero V2 generation | Yes/upsert | Yes | Yes | P | No | No | No | No | No | No | Known content ID not passed to AI telemetry |
| Import | Yes/upsert | No | N/A | N/A | N/A | Import actor | No | No | Batch | C | No source document/evidence |
| Elite upgrade | Yes/new draft | Yes | P | Yes | Yes | No | No | Scores only | Yes | C | AI interactions link source, not final draft |
| Queue regeneration | No | Yes | Yes | P | No | No | No | Quality | Yes | No | Run/job IDs not propagated to AIInteraction |
| Direct regeneration | No | Yes | Yes | P | No | No | No | Quality | Failure only | No | Overwrite and automatic approval |
| Approved/thin regeneration | No | Yes | Yes | P | No | No | No | P | No | No | Overwrites approved body without review |
| AI lab injection | No | Yes | Not stored | No | No | No | No | No | No | No | Direct OpenAI bypass |
| AI textbook injection | No | Yes | Not stored | No | No | No | No | No | No | Direct OpenAI bypass |
| WAEC LLM tagging | No | Conditional | AI log | No | No | No | N/A | No | AI log | No | No prompt registry metadata |
| Human approval | No | No | No | No | No | Yes | No | No | Required | No | Strong reviewer, missing basis/qualification |
| Human rejection | No | No | No | No | No | Yes | No | No | Required | No | Reason is not durably stored on content |
| Regeneration review | No | No | No | No | No | Yes | No | No | Required | No | Does not target immutable revision |
| Risk flagging | No | No | No | No | No | System | No | Yes | Best effort | No | Audit can fail independently |
| Risk auto-approval | No | No | No | No | No | System label | No | Yes | Best effort | No | Basis inferred from action |
| Teacher body edit | No | No | No | No | No | Editor | No | No | Best effort | L | Body only and pruned |
| Teacher fork | Yes | No | Copied | Copied | Copied | No | No | Copied | No | No | Copies false provenance-like metadata |
| Teacher moderation | No | No | No | No | No | Audit only | No | No | Best effort | No | Reviewer not authoritative |
| Emergency unpublish | No | No | No | No | No | Audit only | No | No | Best effort | No | Not explicit revocation |
| MOE release publish/archive | No | No | No | No | No | Audit only | No | No | Best effort | No | No content snapshot |
| Alignment engine | No | Conditional | No | No | No | No | N/A | No | No | No | Mutable JSON, no alignment review |
| Deterministic enrichment | No | No | No | N/A | N/A | No | No | No | No | No | Substantive rewrite without history |

## 10. Genuine gaps

1. No canonical origin/source type.
2. No universal generation-to-content join.
3. No explicit approval basis.
4. No reviewer qualification or qualification snapshot.
5. No immutable prompt archive.
6. No first-class evidence collection.
7. No immutable full-content revision history.
8. No explicit reapproval, revocation, reinstatement, or supersession lifecycle.
9. No legacy provenance confidence field.
10. No uniform provider/model metadata.
11. Incomplete audit coverage.
12. Rejection reasons can be lost.
13. Forks can inherit false provenance metadata.
14. Secondary enrichment and maintenance paths bypass history.
15. Approval does not identify the exact immutable content body reviewed.

## 11. Existing infrastructure to reuse

- Prompt registry key/version/hash generation
- `AIInteraction` detailed execution and cost metadata
- Append-only `AuditLog` and its database trigger pattern
- Existing `Standard` identifiers
- Compatibility `moeAlignments` reader
- `CurriculumVersion` for release/grouping only
- `LessonVersion` for teacher undo only
- Regeneration run/job IDs
- Existing correlation-ID conventions in other event models
- Signed offline availability manifests

## 12. Design options

| Criterion | Option A: Formalize payload JSON | Option B: Columns on `CurriculumContent` | Option C: Dedicated provenance family |
|---|---|---|---|
| Migration risk | Low initially | Highest on live table | Low to medium, primarily additive |
| Queryability | Weak without expression indexes | Excellent for current state | Excellent with normalized indexes |
| Auditability | Poor without separate events | Current state only | Strong append-only history |
| Type safety | Runtime validation | Strong scalars | Strong normalized governance fields |
| Evidence | Awkward nested arrays | Needs a table anyway | Natural one-to-many relation |
| Reviewer qualifications | Embedded JSON | Coupled nullable columns | Event reference plus snapshot |
| Revocation | Mutable JSON | Current-state columns | Explicit event plus current projection |
| Prompt lineage | Duplicated JSON | Many nullable columns | Direct revision metadata plus AI correlation |
| Historical reconstruction | Weak | Weak without another table | Full immutable revisions |
| Legacy uncertainty | Unstructured | Ambiguous nulls | Explicit confidence classification |
| Main-table coupling | Low | High | Minimal |

Option C is recommended. Payload JSON remains a compatibility mirror, not the national governance source of truth.

## 13. Recommended schema shape

### `CurriculumProvenance`

One root/current projection per content row:

- `id`
- `curriculumContentId`, unique FK to `CurriculumContent.id`
- `legacyState`: `VERIFIED | PARTIAL | LEGACY_UNVERIFIED`
- `currentRevisionId`
- `currentGovernanceEventId`
- `lifecycleState`: `ACTIVE | REVOKED | SUPERSEDED`
- timestamps

### `CurriculumContentRevision`

Append-only full content and generation history:

- `id`, `provenanceId`, `sequence`
- `revisionKind`, `originKind`
- `snapshotSchemaVersion`, `contentSnapshot`, `contentHash`
- `generatorName`, `generatorVersion`
- `provider`, `model`, `generatedAt`
- `generationCorrelationId`
- `primaryPromptKey`, `primaryPromptVersion`, `primaryPromptHash`
- `authorUserId`, `sourceRevisionId`
- `idempotencyKey`, `backfillRunId`, `createdAt`

Origin values:

- `AI_GENERATED`
- `DETERMINISTIC_GENERATED`
- `IMPORTED`
- `HUMAN_AUTHORED`
- `FORKED`
- `AI_UPGRADED`
- `LEGACY_UNKNOWN`

Revision kinds:

- `ORIGINAL_GENERATION`
- `IMPORT`
- `HUMAN_CREATE`
- `HUMAN_EDIT`
- `AI_REGENERATION`
- `AI_UPGRADE`
- `DETERMINISTIC_ENRICHMENT`
- `ALIGNMENT_CHANGE`
- `METADATA_CHANGE`
- `BACKFILL_SNAPSHOT`

### `CurriculumGovernanceEvent`

Append-only review and lifecycle history:

- `id`, `provenanceId`, `revisionId`
- `eventType`, `approvalBasis`
- `actorUserId`, `actorKind`
- `reviewerRoleSnapshot`
- `reviewerQualificationRef`, `reviewerQualificationSnapshot`
- `riskScore`, `riskReasons`
- `reason`, `replacementCurriculumContentId`
- `invalidateOfflineCopies`
- `occurredAt`, `auditLogId`
- `sourceConfidence`, `idempotencyKey`, `backfillRunId`

Event values:

- `SUBMITTED`
- `RISK_ASSESSED`
- `APPROVED`
- `REJECTED`
- `RETURNED_FOR_REVIEW`
- `REAPPROVED`
- `REVOKED`
- `REINSTATED`
- `SUPERSEDED`

Approval basis values:

- `HUMAN_REVIEW`
- `MOE_REVIEW`
- `RISK_AUTO_APPROVAL`
- `ROLE_POLICY_AUTO_APPROVAL`
- `SCHOOL_POLICY_AUTO_APPROVAL`
- `IMPORTED_PREAPPROVED`
- `LEGACY_UNKNOWN`

### `CurriculumEvidence`

Append-only evidence attached to an exact revision:

- `id`, `revisionId`
- `evidenceType`
- `title`, `uri`, `documentRef`
- `citation`, `publisher`, `locator`
- `contentHash`, `license`
- `addedByUserId`, `status`
- `supersedesEvidenceId`, `createdAt`

Evidence types:

- `URL`
- `DOCUMENT`
- `CURRICULUM_STANDARD`
- `TEXTBOOK`
- `REVIEWER_NOTE`
- `EXTERNAL_REFERENCE`

### `CurriculumStandardAlignment`

Revision-specific and queryable alignment provenance:

- `id`, `revisionId`
- Optional FK `standardId`
- Standard code and description snapshots
- Framework
- Method: `EXACT | KEYWORD | AI | IMPORTED | MANUAL | LEGACY_UNKNOWN`
- Confidence
- Provider/model/correlation ID
- Review status, reviewer, and review time
- Superseded alignment reference

## 14. Prompt-lineage solution

1. Create `generationCorrelationId` before the first AI call.
2. Pass it through `AiUsageContext`.
3. Store it on every `AIInteraction` in the operation.
4. Also pass future `contentId` when already known.
5. Return the correlation ID to the client for teacher preview/save flows.
6. Store it on the final immutable content revision.
7. Store primary prompt key/version/hash directly on the revision.
8. Query the complete multi-call chain through correlated `AIInteraction` rows.

This is the smallest deterministic universal linkage. It supports single-call, multi-pass, regeneration, elite-upgrade, and two-request teacher flows.

Prompt metadata is intentionally retained directly on the revision because AI telemetry is currently best effort. `AIInteraction` remains authoritative for detailed execution, cost, latency, fallback, and tokens.

The prompt registry should reject reuse of the same key/version with a different hash and retain historical prompt definitions before claiming full reproducibility.

## 15. Evidence design

Evidence attaches to a content revision because later edits may add, remove, or invalidate sources.

- URL evidence stores URL, title, and publishing/access metadata.
- Document evidence stores external document reference, hash, and page/section locator.
- Textbook evidence stores edition, publisher, identifier, and locator.
- Standards normally use `CurriculumStandardAlignment`.
- Reviewer notes may support a decision, but approval remains a governance event.
- Corrections create superseding evidence records rather than editing historical evidence.
- Backfill never fabricates evidence.

## 16. Immutable history design

Every material content change creates a `CurriculumContentRevision` before the mutable current `CurriculumContent` projection changes.

Covered mutations include:

- Original generation
- Import
- Human creation/edit
- AI regeneration
- Elite upgrade
- Fork
- Lab/textbook injection
- Alignment changes
- Material standards/objective changes

Approval, rejection, risk, reapproval, revocation, reinstatement, and supersession create governance events. They do not create a content revision unless content changed.

All approvals target an exact revision. New revision/event/evidence tables should receive database update/delete prevention following the existing `AuditLog` trigger design.

## 17. Revocation design

Rejection means a proposed revision was not approved. Revocation means already-available content is withdrawn.

A `REVOKED` governance event records:

- Exact affected revision
- Revoking user/system actor
- Time
- Required reason
- Optional replacement content
- Whether future assignment is blocked
- Whether offline copies require invalidation

The transaction should:

1. Append the revocation event.
2. Update the provenance lifecycle projection.
3. Update compatibility `CurriculumContent.status`.
4. Write required `AuditLog`.
5. Cause the existing availability endpoint to issue a signed revoked manifest.

Offline invalidation remains separate. Existing clients invalidate only after refreshing availability, so a maximum refresh interval remains a policy decision.

## 18. Legacy-state model

- `VERIFIED`: All applicable critical fields are directly supported and non-conflicting.
- `PARTIAL`: Some fields are provable, but critical fields remain unknown.
- `LEGACY_UNVERIFIED`: Origin, review, or lineage cannot be established reliably.

“Not applicable” differs from “unknown.” A verified deterministic generator legitimately has no prompt version.

Never use timestamp proximity to claim an AI interaction belongs to content. Valid linkage requires content ID, correlation ID, direct event reference, or another unique identifier.

Likely outcomes:

- Fully reconstructable: limited deterministic/import/human cases with direct and non-conflicting applicable fields.
- Partially reconstructable: many missing-content, elite, importer, triage, and human-review rows.
- Legacy unknown: rows with only mutable status/payload and inferred sources.

## 19. Migration and backfill strategy

### Safe backfill sources

| Source | Safe fields | Unsafe inference |
|---|---|---|
| Payload | Explicit source, import metadata, generator/model/date, elite prompt chain, risk, explicit reviewer/time, run/job IDs | Missing values, inherited fork metadata, fake timestamps |
| Scalar fields | Current status/version, teacher flags, edit metadata, derivation links, current alignments and WAEC tags | Approval basis, original generator, reviewer |
| AuditLog | Explicit action, actor, time, resource and stored details | Assuming absence means no review; omitted reasons |
| AIInteraction | Exact prompt/model/provider when deterministically linked | Timestamp-proximity joins |
| LessonVersion | Retained teacher body snapshots | Full history, approval state, pruned edits |
| CurriculumVersion | Release/operation grouping | Lesson revision sequence |
| MOE alignment object | Codes, method, confidence, time where present | Reviewer/model/prompt when absent |

### Runner design

- Dry-run default
- Cursor pagination by stable `CurriculumContent.id`
- Batches of 50 to 100
- Per-row transaction, no giant national transaction
- Deterministic idempotency keys
- `backfillRunId` on inserted records
- `--after-id`, `--run-id`, and resume support
- One `BACKFILL_SNAPSHOT` revision for the recoverable current state
- Historical governance events only when unambiguous
- Coverage reports by origin, confidence, approval basis, prompt completeness, alignment shape, tenant, and status
- No reconstruction of historical revisions from `updatedAt`

### Conflict rule

If two sources disagree, do not silently choose one.

Conflicting reviewer IDs, prompt hashes, source types, approval times, or revocation states create an anomaly and force `PARTIAL` or `LEGACY_UNVERIFIED` until reviewed.

### Stop thresholds

Stop the write run on:

- Any duplicate provenance root
- Any FK or idempotency violation
- Any conflicting reviewer identity or prompt hash
- Technical failure rate above 1 percent
- Classification distribution drifting more than 5 percentage points from approved dry-run results
- Any unexpected approved row classified as revoked/rejected

### Verification

- One provenance root per migrated content row
- One current revision pointer
- Approval/revocation pointers belong to the same provenance root
- Every approval targets an existing revision
- Correlation joins do not cross generation operations
- No verified AI revision lacks required prompt/model/provider evidence
- No human approval lacks reviewer and time
- No revocation lacks actor, time, and reason
- Legacy and new status counts reconcile
- Idempotent reruns create zero duplicates

### Rollback

Before cutover, new tables can be removed through a separately approved rollback if no reader treats them as canonical.

After cutover, do not delete immutable history. Append correction/invalidation events, update current pointers through an audited transaction, and retain the faulty `backfillRunId` for traceability.

## 20. Read/write transition plan

### Phase 1: Additive schema

- Add new models and nullable AI correlation field.
- Existing reads/writes continue.
- Deploy compatibility readers and dry-run reporting only.

### Phase 2: Canonical write plus legacy mirror

Add one shared provenance writer that transactionally:

- Writes revisions/events
- Updates current pointers
- Updates `CurriculumContent`
- Mirrors temporary compatibility payload fields
- Writes required audit records

Update generation/import/regeneration paths first, then approval, risk, moderation, MOE, and alignment writers.

### Phase 3: Reader migration

Move admin review, risk reporting, MOE governance, approval details, content availability, alignment, and offline manifest readers to the new models.

### Phase 4: New models canonical

- New tables become authoritative.
- Payload mirrors become non-canonical compatibility output.
- Block direct curriculum writes that bypass the shared service.

### Phase 5: Optional cleanup

Only after repository search and usage telemetry prove old reads are gone:

- Stop writing duplicated payload provenance fields.
- Keep `LessonVersion` for teacher undo.
- Keep `CurriculumVersion` for releases.
- Retain historical payload data unless separately approved for cleanup.

No flag-day migration is recommended.

## 21. Exact schema touches requiring review

| Schema touch | Type | Production-live impact | Backfill | Lock/rewrite risk | Rollback | Why needed |
|---|---|---|---|---|---|---|
| `CurriculumProvenance` | New model | FK to live content | Yes | Low | Remove before cutover or stop readers | One root/current projection |
| `CurriculumContentRevision` | New model | Insert volume and FK | Yes | Low | Correction records after cutover | Immutable content history |
| `CurriculumGovernanceEvent` | New model | Insert volume and FKs | Partial | Low | Compensating event | Explicit approval/risk/revocation history |
| `CurriculumEvidence` | New model | Insert volume | Proven evidence only | Low | Superseding record | First-class evidence |
| `CurriculumStandardAlignment` | New model | FK to `Standard` and revision | Where provable | Low | Superseding record | Exact alignment lineage |
| `AIInteraction.generationCorrelationId` | Existing live model | Nullable column and index | Historical rows remain null | Low column risk; create index concurrently | Stop writers and remove if unused | Deterministic AI joins |
| `CurriculumContent.provenance` | **Existing production-live model** | Prisma back-relation only; no physical column | No | No row rewrite | Remove relation | Typed relation to provenance root |
| `User` back-relations | Existing live model | Prisma relation metadata | No | No row rewrite | Remove relation | Reviewer/actor FKs |
| `Standard` back-relation | Existing live model | Prisma relation metadata | No | No row rewrite | Remove relation | Canonical standard identity |
| `AuditLog` back-relation | Existing live model | Prisma relation metadata | No | No row rewrite | Remove relation | Direct event-to-audit linkage |
| New enums | New types | Additive | No | Low | Remove before use | Prevent string drift |
| Immutability triggers | New tables | Blocks updates/deletes | No | Low | Reviewed trigger removal | Protect history |

The design avoids physical columns, indexes, or row rewrites on `CurriculumContent`. It does not initially alter `payload`, `moeAlignments`, `status`, `version`, `LessonVersion`, or `CurriculumVersion`.

## 22. Proposed test strategy

| Scenario | Required invariant | Test level |
|---|---|---|
| AI-generated content | Revision has AI origin, correlation, prompt, provider, model | DB integration |
| Imported content | Import source/hash retained; AI fields are not applicable | Integration |
| Human-authored content | Human origin and author authoritative | Integration |
| Risk auto-approval | Explicit `RISK_AUTO_APPROVAL` plus risk snapshot | Integration |
| Human approval | Reviewer/time and exact target revision stored | Integration |
| Rejection | Durable reason and actor | Integration |
| Regeneration | New revision; prior body reconstructable | Integration |
| Human edit | New revision plus legacy undo behavior | Integration |
| Prompt linkage | All AI calls and final revision share correlation | Integration |
| Multi-pass lineage | Multiple interactions join without ambiguity | Integration |
| Teacher preview/save | Correlation survives client round trip | API integration |
| Evidence | Evidence attaches to exact revision | DB integration |
| Alignment | Standard/method/confidence/model/review queryable | DB integration |
| Revocation | Actor/time/reason/replacement and blocked reads | API + DB integration |
| Offline revocation | Signed revoked manifest invalidates refreshed cache | Integration |
| Reapproval | New approval targets new revision; old remains | Integration |
| Supersession | Replacement relationship explicit | Integration |
| Legacy backfill | Unknown values remain null; confidence downgraded | Migration integration |
| Conflicting sources | Anomaly produced; no verified record | Migration integration |
| Idempotent rerun | Zero duplicate revisions/events | DB integration |
| Audit consistency | Governance event and audit commit/fail together | Transaction integration |
| Append-only enforcement | DB rejects update/delete | DB integration |
| Fork | Does not inherit false approval/risk/generator identity | Integration |
| Writer enforcement | Direct writes cannot bypass provenance service | Architectural/static |
| P2-B compatibility | Qualification reference/snapshot supported | Schema integration |
| Tenant isolation | No cross-tenant reviewer/evidence links | Security integration |
| Cost controls | Correlated calls retain budget accounting | Integration |

## 23. Risks and unresolved decisions

1. Confirm internal `CurriculumContent.id` as the FK while retaining business `contentId` in telemetry.
2. Measure storage growth from full snapshots.
3. Define immutable prompt-template retention.
4. Decide whether AI interaction logging must become required for governed generation.
5. Correct provider inference when provider is omitted.
6. Map inconsistent status vocabulary without changing delivery behavior.
7. Define trusted conditions for `IMPORTED_PREAPPROVED`.
8. Finalize the P2-B reviewer qualification roster and expiry rules separately.
9. Define maximum offline availability refresh interval.
10. Select curriculum source-document storage, rights, retention, and hashing policy.
11. Define governance scope for textbooks, labs, media, and generated documents.
12. Re-query live legacy coverage during the approved dry-run.
13. Establish an append-only correction procedure.
14. Route or block the numerous direct-write scripts.
15. Improve alignment extraction across all lesson body shapes.

## Final escalation status

No Prisma schema, migration, production data, generation flow, approval flow, or backfill was changed.

**IMPLEMENTATION STATUS: NOT STARTED  AWAITING SCHEMA REVIEW**
