# P2-A Final Design Reconciliation Before Schema Approval

## Document status

- Sprint: P2-A Curriculum Provenance
- Pass: Final design reconciliation
- Architecture direction: Dedicated provenance architecture approved
- Implementation: Not started
- Schema authorization: Not yet granted
- Alignment normalization: Explicitly deferred beyond initial P2-A
- Primary discovery source: [`P2A_CURRICULUM_PROVENANCE_DISCOVERY_AND_SCHEMA_PROPOSAL.md`](P2A_CURRICULUM_PROVENANCE_DISCOVERY_AND_SCHEMA_PROPOSAL.md)

No Prisma schema, migration, backfill, production data, generation flow, approval flow, or application code was changed while producing this design.

## 1. Revised architecture

P2-A will use exactly four core provenance models:

1. `CurriculumProvenance`
2. `CurriculumContentRevision`
3. `CurriculumGovernanceEvent`
4. `CurriculumEvidence`

It will also add:

- `AIInteraction.generationCorrelationId`
- Only the Prisma back-relations required by the four models
- Database update/delete guards for immutable history

P2-A will not add `CurriculumStandardAlignment` or another normalized standards table.

The live `CurriculumContent.moeAlignments` field and the existing reader in [`lib/moe/alignmentReader.ts`](../lib/moe/alignmentReader.ts#L1) remain the operationally canonical alignment system. Every immutable content revision snapshots the exact scalar `moeAlignments` value and `waecSyllabusTopics` present when the revision is created. That snapshot is historical evidence of the alignment state for that revision, not a second current alignment authority.

Consumers of a revision snapshot must pass the snapshotted `moeAlignments` through the same existing reader. P2-A must not introduce a second alignment writer, second set of alignment records, or independent normalization logic.

### Core invariants

- `CurriculumContent` remains the mutable current delivery projection.
- `CurriculumContentRevision` is the immutable content history.
- `CurriculumGovernanceEvent` is the immutable governance history.
- `CurriculumEvidence` is immutable revision-specific evidence.
- Approval, rejection, reapproval, revocation, reinstatement, and supersession target an exact revision.
- Governance-only changes do not create content revisions.
- Material content changes always create revisions.
- The provenance root has no generic current-governance-event pointer.
- Existing payload governance fields are compatibility mirrors during transition, not the new source of truth.

## 2. Final four-model responsibility breakdown

### `CurriculumProvenance`

Purpose:

- One stable root per `CurriculumContent` row
- Current provenance completeness projection
- Current curriculum lifecycle projection
- Pointer to the current immutable content revision

It intentionally does not store:

- Prompt details
- Generator details
- Review details
- Risk history
- Evidence collections
- A generic current-governance-event pointer

There is no non-ambiguous meaning for a generic current event because risk assessment, approval, revocation, reinstatement, and supersession are different event dimensions. Current lifecycle is stored explicitly, and historical events are queried from the append-only stream.

Final fields:

- `id`
- `curriculumContentId`
- `provenanceCompleteness`
- `lifecycleState`
- `currentRevisionId`
- `createdAt`
- `updatedAt`

### `CurriculumContentRevision`

Purpose:

- Immutable reconstruction of the governed curriculum content
- Material instructional metadata
- Origin and generation lineage
- Primary prompt lineage
- Link to the complete AI execution chain through `generationCorrelationId`
- Derivation/fork/upgrade lineage through `sourceRevisionId`

### `CurriculumGovernanceEvent`

Purpose:

- Append-only domain history for submission, risk, approval, rejection, reapproval, revocation, reinstatement, and supersession
- Explicit approval mechanism and authority
- Exact revision targeted by each decision
- Explicit revocation consequences
- Direct link to the general `AuditLog` security record where one exists

### `CurriculumEvidence`

Purpose:

- Append-only evidence attached to an exact immutable revision
- Reference and citation metadata only
- No source-document storage platform in P2-A
- Supersession/withdrawal without rewriting old evidence

## 3. Provenance completeness model

The canonical field is `provenanceCompleteness`, not `legacyState`.

Values:

- `VERIFIED`
- `PARTIAL`
- `UNVERIFIED`

### Definitions

`VERIFIED` means every provenance attribute applicable to the current revision origin and current lifecycle is directly recorded, internally consistent, hash-valid, and non-conflicting.

`PARTIAL` means the origin or governance path is known, but at least one applicable provenance attribute is absent or capture failed. There is no unresolved contradiction about the fields that are present.

`UNVERIFIED` means origin or governance cannot be established reliably, or existing sources conflict in a way that prevents a trustworthy conclusion.

### Not applicable versus unknown

Null does not always mean incomplete.

| Origin | AI provider/model/prompt applicability | Other verified requirements |
|---|---|---|
| `AI_GENERATED` / `AI_UPGRADED` | Required | Correlation ID, generator/tool, generation time, prompt key/version/hash |
| `DETERMINISTIC_GENERATED` | Not applicable and must remain null | Generator/tool name and version, generation time |
| `IMPORTED` | Not applicable unless AI transformed the import | Importer/tool version, source checksum/reference evidence, importing actor where known |
| `HUMAN_AUTHORED` | Not applicable unless AI co-creation is proven | Author and revision time |
| `FORKED` | Depends on whether the fork itself was transformed by AI | Source revision and author required |
| `LEGACY_UNKNOWN` | Unknown, not not-applicable | Completeness must be `UNVERIFIED` |

A deterministic generator with no prompt is not incomplete. An AI-generated revision with a missing prompt version is incomplete.

The root projection describes the current revision and its current governance state. Historical uncertainty remains visible through revision origin, null fields, `backfillRunId`, and the immutable historical events.

## 4. Immutable revision snapshot contract

### Repository facts driving the contract

The validated AI payload schema currently contains title, grade, subject, lesson format, objectives, three body variants, activities, labs, `moeAlignments`, delivery profile, summary, problem sets, and limited metadata. See [`lib/schemas/curriculumPayload.ts`](../lib/schemas/curriculumPayload.ts#L102).

The student lesson page currently renders:

- Payload title
- Objectives
- Standard, block, body, and legacy content fallbacks
- Activities
- Slide deck specifications
- Audio script specifications

See [`app/student/lesson/[contentId]/page.tsx`](../app/student/lesson/%5BcontentId%5D/page.tsx#L184).

Other current shapes add:

- Teacher-authored assessment questions and estimated minutes
- Imported assessment and teacher notes
- Deterministic assessment, remediation, extension, guardian support, and teacher notes
- Labs and textbook chapters
- Full-pack term plans, units, lessons, rubrics, and mastery checks
- Hero and inline instructional imagery

The snapshot must therefore be an explicit, allowlisted projection. It must not serialize an unbounded Prisma row or copy all payload keys blindly.

### Proposed TypeScript contract

```ts
export type CurriculumSnapshotJson =
  | null
  | boolean
  | number
  | string
  | CurriculumSnapshotJson[]
  | { [key: string]: CurriculumSnapshotJson };

export interface CurriculumLabSnapshotV1 {
  id: string | null;
  title: string;
  type: string;
  durationMinutes: number;
  subject: string;
  gradeLevel: number;
  labObjective: string;
  materialsNeeded: string[];
  safetyNotes: string | null;
  procedure: Array<{
    stepNumber: number;
    instruction: string;
    teacherNote: string | null;
    durationMinutes: number;
  }>;
  observationForm: Array<{
    field: string;
    prompt: string;
    inputType: "text" | "number" | "choice";
    choices: string[] | null;
  }>;
  analysisQuestions: Array<{
    question: string;
    expectedAnswer: string;
    scoringRubric: string;
  }>;
  connectionToLesson: string;
  offlineCapable: boolean;
  virtualAlternative: string | null;
}

export interface CurriculumContentSnapshotV1 {
  identity: {
    title: string;
    description: string | null;
    grade: number;
    subject: string;
    contentType: string;
  };

  placement: {
    unitId: string | null;
    orderInUnit: number | null;
    lessonType: string | null;
  };

  delivery: {
    lessonFormat: "standard" | "block" | "either" | null;
    estimatedMinutes: number | null;
    deliveryProfile: CurriculumSnapshotJson | null;
    body: string | null;
    bodyStandard: string | null;
    bodyBlock: string | null;
    legacyContent: string | null;
    lessonContent: string | null;
  };

  instruction: {
    objectives: string[];
    authoringObjectives: CurriculumSnapshotJson | null;
    activities: CurriculumSnapshotJson[];
    teacherExplanation: CurriculumSnapshotJson | null;
    workedExamples: CurriculumSnapshotJson | null;
    guidedPractice: CurriculumSnapshotJson | null;
    independentPractice: CurriculumSnapshotJson | null;
    realWorldApplication: CurriculumSnapshotJson | null;
    teacherNotes: CurriculumSnapshotJson | null;
    remediation: CurriculumSnapshotJson | null;
    extension: CurriculumSnapshotJson | null;
    guardianSupport: CurriculumSnapshotJson | null;
    materialsNotes: CurriculumSnapshotJson | null;
    takeawaySummary: string | null;
  };

  assessment: {
    assessment: CurriculumSnapshotJson | null;
    assessmentQuestions: CurriculumSnapshotJson[];
    quiz: CurriculumSnapshotJson | null;
    problemSets: CurriculumSnapshotJson[];
    rubric: CurriculumSnapshotJson | null;
    masteryChecks: CurriculumSnapshotJson | null;
  };

  resources: {
    labs: CurriculumLabSnapshotV1[];
    textbook: CurriculumSnapshotJson | null;
    resources: CurriculumSnapshotJson | null;
    slideDeckSpecs: CurriculumSnapshotJson[];
    audioScriptSpecs: CurriculumSnapshotJson[];
    heroImage: {
      url: string;
      metadata: CurriculumSnapshotJson | null;
    } | null;
    inlineIllustrations: CurriculumSnapshotJson[];
  };

  curriculumPlan: {
    term: CurriculumSnapshotJson | null;
    unitTitle: string | null;
    termPlan: CurriculumSnapshotJson | null;
    weeks: CurriculumSnapshotJson[];
    units: CurriculumSnapshotJson[];
    lessons: CurriculumSnapshotJson[];
  };

  standards: {
    // Exact snapshot of CurriculumContent.moeAlignments.
    // Consumers continue using readMoeAlignmentEntries/readMoeAlignmentCodes.
    moeAlignments: CurriculumSnapshotJson | null;
    waecSyllabusTopics: string[];
  };
}
```

### Snapshot precedence and normalization

- `identity.title`: learner-visible `payload.title`, falling back to scalar `title`.
- `identity.grade`, `subject`, and `contentType`: scalar fields.
- `instruction.objectives`: `payload.objectives`, falling back to scalar `learningObjectives`.
- `authoringObjectives`: exact scalar `learningObjectives` when it differs or is material to teacher authoring.
- Body aliases are all retained because current consumers use different fallback orders.
- `deliveryProfile`: scalar `deliveryProfile` when present, otherwise payload value.
- `standards.moeAlignments`: exact scalar value only. Payload alignment mirrors are excluded.
- `waecSyllabusTopics`: deduplicated and lexically sorted because the scalar is a set-like classification.
- Missing optional fields become explicit `null` or empty arrays. `undefined` is never stored.
- Array order remains unchanged except set-like WAEC topic IDs.
- Unknown payload fields are not silently copied. A new instructional field must update the contract and snapshot-schema version or be explicitly classified as non-material.

### Included because material

- Learner/teacher visible bodies and instructional variants
- Objectives and activities
- Assessments, questions, rubrics, and mastery checks
- Labs and embedded textbook content
- Remediation, extension, guardian support, and teacher notes
- Delivery format/profile and instructional duration
- Unit placement and lesson type
- Instructional slides, scripts, hero image, and inline illustrations
- Full-pack term/unit/lesson content
- Exact current scalar alignment state and WAEC tags

### Explicitly excluded

- `status`, approval status, approved/rejected users or timestamps
- Risk fields and risk flags
- `createdAt`, `updatedAt`, `publishedAt`, `editedAt`
- Generation jobs, regeneration run IDs, checkpoint state, queue state
- Generator/model/prompt metadata, which is normalized on the revision
- `versionId` and `CurriculumVersion` release membership
- Current database hash
- Embeddings and embedding timestamps
- Thumbnail generation status/errors and image-generation costs
- Usage/view/completion counters
- Tenant/access fields such as `schoolId` and `visibility`
- `isHero` merchandising state
- Audit, trace, IP, and request infrastructure metadata
- Audio/video job status and tenant-specific supplemental video rows
- Duplicated payload alignment and governance mirrors

### Deterministic `contentHash`

1. Build and validate `CurriculumContentSnapshotV1`.
2. Emit no `undefined` values.
3. Canonicalize `{ snapshotSchemaVersion, contentSnapshot }` using an RFC 8785-compatible JSON canonicalization implementation:
   - lexically sorted object keys
   - preserved array order
   - canonical JSON primitives
   - UTF-8 encoding
4. Compute SHA-256.
5. Store lowercase 64-character hexadecimal output.

```ts
contentHash = sha256(
  canonicalize({
    snapshotSchemaVersion: 1,
    contentSnapshot,
  })
).toString("hex");
```

Snapshot fixtures from every migrated writer must prove that learner-visible content is captured and governance/operational keys are excluded.

## 5. Final `CurriculumContentRevision` semantics

Required for every revision:

- Provenance root
- Per-root sequence
- Revision kind
- Origin kind
- Snapshot schema version
- Validated snapshot
- Deterministic content hash
- Creation time

Conditional application invariants:

| Origin/revision | Required fields | Fields that remain null when not applicable |
|---|---|---|
| AI generated/upgraded/regenerated/enriched | Generator name/version, provider, model, generated time, correlation ID, primary prompt triple | None of the AI fields may be fabricated |
| Deterministic generated/enriched | Generator name/version and generated time | Provider, model, correlation, prompt triple |
| Imported | Importer name/version, importing author when known, import-origin evidence for verified state | AI fields unless an AI transformation occurred |
| Human create/edit | Author | AI/generation fields unless AI co-creation is proven |
| Fork | Source revision and author | AI fields unless the fork was transformed by AI |
| Backfill snapshot | `backfillRunId` and deterministic idempotency key | Any field not directly proven |
| Legacy unknown | Snapshot only | All unproved lineage fields |

The database keeps conditional fields nullable. The shared writer validates the origin-specific rules. Fake values such as `provider = "none"` or `promptVersion = "not-applicable"` are prohibited.

## 6. Prompt lineage and prompt immutability

### Current state

The current prompt registry cannot retrieve a guaranteed historical prompt after code changes:

- It is an in-memory `Map` keyed only by prompt key.
- `registry.set(definition.key, prompt)` overwrites a prior registration.
- Existing key/version/template combinations can be modified in code.
- Historical prompt bodies are not persisted or retained as immutable application artifacts.
- The current hash is SHA-256 over `template.trim()`.

See [`lib/ai/promptRegistry.ts`](../lib/ai/promptRegistry.ts#L26) and [`lib/ai/promptRegistry.ts`](../lib/ai/promptRegistry.ts#L73).

Therefore the current registry is not sufficient for reproducible historical prompt provenance.

### Final correlation flow

1. Generate `generationCorrelationId` before the first AI call.
2. Pass it through every AI call in the operation.
3. Store it on every normalized `AIInteraction`.
4. Pass `contentId` whenever it is already known.
5. Return and resubmit it across teacher preview to save.
6. Store it on the final immutable revision.
7. Store primary prompt key/version/hash directly on that revision.
8. Use correlated `AIInteraction` rows for the complete multi-call chain.

The correlation ID is not unique on `AIInteraction` because one generation operation can have multiple AI calls. It is indexed with `createdAt`.

### Smallest robust prompt archive

Use an append-only code archive rather than adding a fifth P2-A database model.

Recommended structure:

```text
lib/ai/prompts/archive/<prompt-key>/<semantic-version>.ts
lib/ai/prompts/prompt-manifest.lock.json
lib/ai/prompts/currentVersions.ts
```

Each archived definition contains:

- Prompt key
- Prompt version
- Exact ordered role/message templates
- Placeholder declarations
- Creation/approval metadata already supported by the registry
- Expected SHA-256 hash over a canonical representation of all message templates

Registry changes:

- Store by composite `(promptKey, promptVersion)`, never key alone.
- Keep current-version aliases separately.
- Add `getPrompt(key, version)` and `getPromptByHash(key, version, hash)`.
- Reject duplicate `(key, version)` registration when body or hash differs.
- Require governed curriculum AI calls to use archived prompt definitions.
- Move current ad hoc curriculum system/user prompts and direct SDK prompts into archived definitions.
- Preserve a compatibility adapter for non-migrated, non-governed AI features during transition.

CI immutability guard:

- Recompute each archive hash and compare it to the lock manifest.
- Assert uniqueness of `(key, version)` and `(key, version, hash)`.
- Compare the PR manifest with the merge-base manifest.
- Reject deletion or changed hash/path for an existing key/version.
- Permit only new versions and changes to current-version aliases.
- Ensure deployed builds include every archived definition referenced by known revision fixtures.

This design makes the exact historical template retrievable from the deployed/versioned code archive and verifiable by the hash stored on the revision and AI interactions. Updating a prompt requires a new version file.

It reproduces the exact prompt definition and lineage, not stochastic model output. Structured generation inputs must remain recoverable from the immutable source revision and non-sensitive correlated interaction metadata.

If a governed AI call cannot resolve an archived key/version/hash or fails durable interaction capture, the resulting revision is at most `PARTIAL` and cannot be auto-approved as verified.

## 7. Approval basis versus review authority

These are independent concepts.

### `approvalBasis`

How approval occurred:

- `HUMAN_REVIEW`
- `AUTOMATED_RISK_POLICY`
- `ROLE_POLICY`
- `SCHOOL_POLICY`
- `IMPORT_POLICY`
- `LEGACY_UNKNOWN`

### `reviewAuthority`

Whose authority made the decision valid:

- `MOE`
- `SCHOOL`
- `PLATFORM`
- `SYSTEM`
- `UNKNOWN`

### Examples

| Scenario | Actor | Approval basis | Review authority |
|---|---|---|---|
| MOE official manually approves | User | `HUMAN_REVIEW` | `MOE` |
| School policy auto-approves teacher content | System/policy evaluator | `SCHOOL_POLICY` | `SCHOOL` |
| Platform risk policy auto-approves | System/risk evaluator | `AUTOMATED_RISK_POLICY` | `PLATFORM` |
| Trusted imported material is pre-approved | Import system, importing user retained separately | `IMPORT_POLICY` | Authority defined by trusted source, otherwise `UNKNOWN` |
| Historical approved row with no proof | Unknown | `LEGACY_UNKNOWN` | `UNKNOWN` |

An administrator initiating generation is not automatically a human reviewer. If publication happened because the caller's role triggered a policy, the basis is `ROLE_POLICY`, not `HUMAN_REVIEW`.

`approvalBasis` is populated only for `APPROVED`, `REAPPROVED`, and a reinstatement that restores approval. It remains null for risk-only, submitted, rejected, returned, revoked, and superseded events. `reviewAuthority` may be present on rejection, revocation, reinstatement, or supersession because those are authoritative decisions even when they are not approvals.

## 8. P2-B reviewer qualification extension point

P2-A stores only:

- `reviewerQualificationRef: String?`
- `reviewerQualificationSnapshot: Json?`
- `reviewerRoleSnapshot: String?`

P2-A does not define credential types, issuers, scope, expiry, renewal, revocation, equivalence, or qualification policy.

For P2-A human decisions:

- Reviewer user and role are recorded.
- Qualification reference/snapshot remain null unless an already-authoritative external value is supplied.
- Null qualification does not imply qualification.
- Historical rows never receive fabricated credentials.

P2-B will own the authoritative reviewer qualification roster and validation rules. It can later populate the reference and immutable decision-time snapshot without redesigning governance events.

## 9. Final governance-event model

### Event types

- `SUBMITTED`
- `RISK_ASSESSED`
- `APPROVED`
- `REJECTED`
- `RETURNED_FOR_REVIEW`
- `REAPPROVED`
- `REVOKED`
- `REINSTATED`
- `SUPERSEDED`

Every event targets a revision. This is stricter and simpler than allowing content-level events with no content version.

Lifecycle projection rules:

| Event | `lifecycleResult` | Root projection change |
|---|---|---|
| `SUBMITTED` | `PENDING_REVIEW` | Set pending review |
| `RISK_ASSESSED` | null | No lifecycle change |
| `APPROVED` | `APPROVED` | Set approved |
| `REJECTED` | `REJECTED` | Set rejected |
| `RETURNED_FOR_REVIEW` | `PENDING_REVIEW` | Set pending review |
| `REAPPROVED` | `APPROVED` | Set approved |
| `REVOKED` | `REVOKED` | Set revoked |
| `REINSTATED` | `APPROVED` | Set approved |
| `SUPERSEDED` | `SUPERSEDED` | Set superseded |

`RISK_ASSESSED` can occur before either `APPROVED` or `RETURNED_FOR_REVIEW`. This is one reason a generic current-event pointer is removed.

### Actor rules

- `actorType=USER` requires `actorUserId`.
- `actorType=SYSTEM` requires a stable `actorLabel` such as a policy/risk engine identifier.
- `actorType=LEGACY_UNKNOWN` is allowed only for backfilled uncertain history.

### Decision rules

- Approval/reapproval/restoring reinstatement requires approval basis and authority.
- Rejection, return-for-review, revocation, and supersession require a reason at the service-validation layer.
- Revocation requires all three consequence-policy fields.
- Replacement policies require `replacementRevisionId`.
- `replacementRevisionId` is sufficient because replacement content is derived through replacement revision -> provenance -> `CurriculumContent`.
- New sensitive transitions require `auditLogId`.
- Backfilled events may have no audit link, but completeness must reflect that uncertainty.

### Relationship with `AuditLog`

`CurriculumGovernanceEvent` is the curriculum domain record. It answers what happened to which revision, by what mechanism and authority, with which lifecycle and consequence.

`AuditLog` remains the cross-system security and operator record. It retains action name, actor, tenant, trace, IP, resource, request context, and operational investigation details.

For new approvals, rejections, returns, reapprovals, revocations, reinstatements, supersessions, and risk decisions that affect state:

- Create both records in the same database transaction.
- The governance event stores a unique `auditLogId`.
- Failure to create the required audit row aborts the transition.

The current `logAuditRequired` returns `void`. Implementation should add a required-audit helper that returns the created ID or modify the existing helper compatibly. See [`lib/audit.ts`](../lib/audit.ts#L23).

## 10. Evidence model with evidence purpose

### Evidence type

What the evidence is:

- `URL`
- `DOCUMENT`
- `CURRICULUM_STANDARD`
- `TEXTBOOK`
- `REVIEWER_NOTE`
- `EXTERNAL_REFERENCE`

### Evidence purpose

Why the evidence is attached:

- `FACTUAL_SUPPORT`
- `CURRICULUM_AUTHORITY`
- `SOURCE_MATERIAL`
- `IMPORT_ORIGIN`
- `REVIEW_SUPPORT`

Type and purpose are separate because the same medium can serve different governance functions. A URL can be factual support or an official curriculum authority. A document can be source material, import origin, or review support. A reviewer note describes its type, while `REVIEW_SUPPORT` describes its purpose.

P2-A stores reference metadata only:

- Title
- URI or opaque future document reference
- Citation
- Publisher
- Page/section locator
- Optional SHA-256 source hash
- License
- Adding user
- Purpose/type/status
- Supersession relation

P2-A does not store document bytes or define a document-storage lifecycle.

### Append-only status semantics

Evidence rows are never updated.

- A new active correction points `supersedesEvidenceId` to the older evidence.
- A withdrawal marker uses `status=WITHDRAWN` and points to the withdrawn evidence.
- The effective older status is derived from its successor, not updated in place.
- A single unique supersession pointer keeps each chain linear.

## 11. Revocation consequence model

Rejection and revocation remain separate:

- Rejection: a candidate revision did not pass governance.
- Revocation: an approved/available revision is withdrawn.

A revocation event records:

- Exact target revision
- Actor and authority
- Occurrence time
- Required reason
- Optional replacement revision
- `lifecycleResult=REVOKED`
- Audit link
- Three explicit consequence dimensions

### Future assignments

- `BLOCK_NEW`
- `REPLACE_WITH_SUCCESSOR`

### Existing assignments

- `KEEP_EXISTING`
- `WITHDRAW_EXISTING`
- `REPLACE_WITH_SUCCESSOR`

### Offline cached copies

- `NO_INVALIDATION`
- `INVALIDATE_ON_NEXT_REFRESH`
- `URGENT_INVALIDATE_ON_NEXT_REFRESH`

These three fields allow:

- Future-assignment-only withdrawal
- Full withdrawal from existing assignments
- Replacement with a successor
- Normal cache invalidation
- Urgent invalidation using the shortest supported refresh path

They do not create a workflow engine.

The existing signed availability manifest remains the cache-delivery mechanism. A revoked root causes the content endpoint to issue a signed `revoked: true` manifest. Existing cache code invalidates on the next availability refresh. `URGENT_INVALIDATE_ON_NEXT_REFRESH` does not claim impossible immediate deletion from an offline device; it means immediate server-side revocation plus the shortest supported refresh/escalation policy.

Governance revocation is the event and lifecycle decision. Offline invalidation is one consequence of that decision.

## 12. Controlled curriculum mutation boundary

### Service family

Use a small service family rather than one giant class:

```text
lib/curriculum/provenance/snapshot.ts
lib/curriculum/provenance/hash.ts
lib/curriculum/provenance/validation.ts
lib/curriculum/mutations/contentWriter.ts
lib/curriculum/mutations/governanceWriter.ts
lib/curriculum/mutations/evidenceWriter.ts
lib/curriculum/mutations/revocationWriter.ts
lib/curriculum/mutations/repository.ts
```

Only `repository.ts` may directly call mutating `prisma/tx.curriculumContent` methods in runtime code.

### Content writer responsibilities

In one transaction:

1. Lock/read the provenance root and current revision as needed.
2. Validate mutation idempotency.
3. Update/create current `CurriculumContent`.
4. Build and validate the explicit snapshot.
5. Create the immutable revision.
6. Update `currentRevisionId` and completeness.
7. Write required `AuditLog` for material operator/system mutations.
8. Write compatibility payload mirrors only where transition requires them.

### Governance writer responsibilities

In one transaction:

1. Validate exact target revision and event-specific fields.
2. Create required `AuditLog` and obtain its ID.
3. Append governance event.
4. Update root lifecycle projection.
5. Update compatibility `CurriculumContent.status` and payload mirrors.
6. Never create a content revision unless content changed.

### AI requirements

- Correlation exists before the call.
- All calls use archived prompt definitions.
- All interaction rows carry the correlation.
- Governed AI interaction logging is awaited/durable.
- The writer verifies applicable prompt/correlation data before marking provenance verified.
- Failure may create a pending `PARTIAL` revision only if policy allows; it cannot silently approve it.

### Static architecture enforcement

Add a required CI test using the TypeScript compiler AST or `ts-morph`:

- Scan `app`, `lib`, `worker`, and production-capable scripts.
- Detect `.curriculumContent.create`, `update`, `updateMany`, `upsert`, `delete`, and `deleteMany` on `prisma`, transaction clients, and aliased clients.
- Detect raw SQL mentioning `CurriculumContent` in runtime source.
- Allow mutations only in the shared repository adapter and explicitly approved migration/test adapters.
- Keep a small allowlist containing owner, reason, environment restriction, and expiry/removal phase.
- Fail if a new direct writer appears or an allowlist entry expires.
- Require the test in GitHub CI.

P2-A is not complete while material or governance writers can bypass the boundary.

## 13. Full writer migration matrix

| Existing writer/path | Final disposition | Required shared behavior |
|---|---|---|
| Admin curriculum AI generation | Migrate | Create/update revision, correlation/prompt metadata, explicit approval event if policy approves |
| Admin deterministic term/unit generation | Migrate | Deterministic revision; explicit policy approval if applicable |
| Admin full-pack generation | Migrate | Full-pack snapshot and explicit policy decision |
| Teacher generation preview | Wrap | Create/return correlation, archived prompts; no content write yet |
| Teacher save/create/update | Migrate | Preserve correlation, correctly classify human/AI origin, revision and compatibility mirror |
| `curriculum-factory.ts` | Wrap generator output | Return complete generation metadata; persistence remains in shared writer |
| `generateLessonV2.ts` | Wrap generator output | Archived prompts, one correlation across all passes, return lineage metadata |
| Unit assembler lesson creation | Migrate | AI/deterministic revisions; no immediate unexplained approval |
| Unit assembler placement updates | Migrate | `METADATA_CHANGE` revision because instructional placement is material |
| Unit assembler rollback deletion | Remove direct delete | Make assembly transactional so failed uncommitted artifacts roll back before provenance becomes durable |
| Importer | Migrate | Import revision, importer version, import-origin evidence, pending governance |
| Elite upgrade | Migrate | New AI-upgrade revision, source revision, correlation and prompt lineage |
| National factory | Migrate | Deterministic source/version/batch lineage and revision |
| Coverage generator | Migrate | Deterministic revision |
| Expansion sync | Migrate | Revision; publication through governance writer only |
| Missing-content generation | Migrate | Retain planned ID linkage and add correlation/revision |
| Hero generation | Migrate | Pass precomputed content ID and correlation; create revision |
| Desert-cell creation | Migrate | Explicit placeholder/draft revision; no false generator model |
| Regeneration queue | Migrate | AI regeneration revision; run/job ID as source metadata; approval separate |
| Regeneration admin approve/reject/return | Migrate | Governance events against exact regenerated revision |
| Direct regeneration processor | Block/remove | Replace with queue/shared writer path |
| Regenerate-approved script | Block/remove | Requeue through governed regeneration; never overwrite approved bodies |
| Regenerate-attached-thin script | Block/remove | Requeue through governed regeneration |
| AI lab injection | Migrate | Archived prompt/correlation and `AI_ENRICHMENT` revision |
| AI textbook injection | Migrate | Archived prompt/correlation and `AI_ENRICHMENT` revision |
| Standalone textbook worker | Migrate | Governed content creation/revision; publication separate |
| Deterministic enrichment | Migrate | `DETERMINISTIC_ENRICHMENT` revision |
| WAEC deterministic/LLM tagger | Migrate | `ALIGNMENT_CHANGE` revision; LLM call gets archived prompt/correlation |
| MOE alignment engine | Wrap through writer | Continue scalar `moeAlignments` as canonical and create an `ALIGNMENT_CHANGE` revision |
| Human curriculum approval | Migrate | `APPROVED` event, explicit basis/authority, required audit |
| Human curriculum rejection | Migrate | `REJECTED` event with durable reason and required audit |
| Risk triage flag | Migrate | `RISK_ASSESSED` plus `RETURNED_FOR_REVIEW` where state changes, required audit |
| Risk auto-approval | Migrate | Risk event plus approval event with `AUTOMATED_RISK_POLICY` |
| Teacher moderation | Migrate | Exact-revision rejection/approval/return event with authoritative actor |
| Emergency unpublish | Migrate | Explicit revocation or return-for-review decision and consequences; no inference |
| MOE release publishing | Migrate/wrap | Require existing valid approval or create an explicit authorized decision; no blind `updateMany` |
| Teacher body edit | Migrate | Full immutable revision; retain `LessonVersion` only for UX undo |
| Teacher fork | Migrate | New root/revision, source revision, strip inherited governance metadata |
| Content-media regenerate | Wrap | Revision if learner-visible hero/inline instructional media changes |
| Content-media upload | Wrap | Revision for learner-visible instructional media; audit uploader |
| Bulk content-media regenerate | Wrap | Per-content idempotent revisions, bounded batches |
| Lesson-media generation script | Wrap | Same media rule through writer |
| Course thumbnail queue/worker | Explicitly grandfather | Only operational thumbnail fields; field-level adapter allowlist, no payload/status/content changes |
| Progression enforcement | Migrate | Revision for material prerequisite/sequence content |
| Prerequisite repair | Migrate | Material metadata revision |
| Hero unit mapping | Migrate | Placement revision |
| Lesson title population | Migrate | Material metadata revision |
| Hero/WAEC tagging | Migrate where instructional | Revision; merchandising-only `isHero` may use constrained operational adapter |
| Factory gap-closure bulk updater | Block after controlled migration | Rewrite as governed batch or retire |
| Subject-name/PE reclassification scripts | Block after reviewed data migration | No continuing direct runtime writer |
| Clear-hero and thin-content purge | Block/remove | Use revocation/supersession; hard delete only for never-governed failed transactions |
| Wave cleanup/repro scripts | Test/dev only | Explicit environment guard; unavailable in production |
| Live asset verification writer | Test-only | Use isolated test database/fixture adapter |
| Demo seed | Explicitly grandfather for non-production | Environment guard and architecture-test allowlist; never production runtime |

Temporary grandfathering is not a permanent P2-A exception. By completion, only constrained operational-field adapters and environment-guarded test/seed code may remain outside the material writer, and the architecture test must prove the boundary.

## 14. Final proposed Prisma schema

This is design only and has not been applied.

```prisma
enum CurriculumProvenanceCompleteness {
  VERIFIED
  PARTIAL
  UNVERIFIED
}

enum CurriculumLifecycleState {
  DRAFT
  PENDING_REVIEW
  APPROVED
  REJECTED
  REVOKED
  SUPERSEDED
}

enum CurriculumRevisionKind {
  ORIGINAL_GENERATION
  IMPORT
  HUMAN_CREATE
  HUMAN_EDIT
  FORK
  AI_REGENERATION
  AI_UPGRADE
  AI_ENRICHMENT
  DETERMINISTIC_ENRICHMENT
  ALIGNMENT_CHANGE
  METADATA_CHANGE
  BACKFILL_SNAPSHOT
}

enum CurriculumOriginKind {
  AI_GENERATED
  DETERMINISTIC_GENERATED
  IMPORTED
  HUMAN_AUTHORED
  FORKED
  AI_UPGRADED
  LEGACY_UNKNOWN
}

enum CurriculumGovernanceEventType {
  SUBMITTED
  RISK_ASSESSED
  APPROVED
  REJECTED
  RETURNED_FOR_REVIEW
  REAPPROVED
  REVOKED
  REINSTATED
  SUPERSEDED
}

enum CurriculumGovernanceActorType {
  USER
  SYSTEM
  LEGACY_UNKNOWN
}

enum CurriculumApprovalBasis {
  HUMAN_REVIEW
  AUTOMATED_RISK_POLICY
  ROLE_POLICY
  SCHOOL_POLICY
  IMPORT_POLICY
  LEGACY_UNKNOWN
}

enum CurriculumReviewAuthority {
  MOE
  SCHOOL
  PLATFORM
  SYSTEM
  UNKNOWN
}

enum CurriculumFutureAssignmentPolicy {
  BLOCK_NEW
  REPLACE_WITH_SUCCESSOR
}

enum CurriculumExistingAssignmentPolicy {
  KEEP_EXISTING
  WITHDRAW_EXISTING
  REPLACE_WITH_SUCCESSOR
}

enum CurriculumOfflineCachePolicy {
  NO_INVALIDATION
  INVALIDATE_ON_NEXT_REFRESH
  URGENT_INVALIDATE_ON_NEXT_REFRESH
}

enum CurriculumEvidenceType {
  URL
  DOCUMENT
  CURRICULUM_STANDARD
  TEXTBOOK
  REVIEWER_NOTE
  EXTERNAL_REFERENCE
}

enum CurriculumEvidencePurpose {
  FACTUAL_SUPPORT
  CURRICULUM_AUTHORITY
  SOURCE_MATERIAL
  IMPORT_ORIGIN
  REVIEW_SUPPORT
}

enum CurriculumEvidenceStatus {
  ACTIVE
  WITHDRAWN
}

model CurriculumProvenance {
  id                       String                           @id @default(cuid())
  curriculumContentId      String                           @unique
  provenanceCompleteness   CurriculumProvenanceCompleteness @default(UNVERIFIED)
  lifecycleState           CurriculumLifecycleState         @default(DRAFT)
  currentRevisionId        String?                          @unique
  createdAt                DateTime                         @default(now())
  updatedAt                DateTime                         @updatedAt

  curriculumContent CurriculumContent          @relation("CurriculumContentProvenance", fields: [curriculumContentId], references: [id], onDelete: Restrict)
  currentRevision   CurriculumContentRevision?  @relation("CurriculumCurrentRevision", fields: [currentRevisionId], references: [id], onDelete: Restrict)
  revisions         CurriculumContentRevision[] @relation("CurriculumProvenanceRevisions")

  @@index([lifecycleState])
  @@index([provenanceCompleteness])
  @@index([updatedAt])
}

model CurriculumContentRevision {
  id                       String                 @id @default(cuid())
  provenanceId             String
  sequence                 Int
  revisionKind             CurriculumRevisionKind
  originKind               CurriculumOriginKind
  snapshotSchemaVersion    Int
  contentSnapshot          Json
  contentHash              String                 @db.VarChar(64)
  generatorName            String?
  generatorVersion         String?
  aiProvider               String?
  aiModel                  String?
  generatedAt              DateTime?
  generationCorrelationId  String?
  primaryPromptKey         String?
  primaryPromptVersion     String?
  primaryPromptHash        String?                @db.VarChar(64)
  authorUserId             String?
  sourceRevisionId         String?
  idempotencyKey           String?                @unique
  backfillRunId            String?
  createdAt                DateTime               @default(now())

  provenance          CurriculumProvenance        @relation("CurriculumProvenanceRevisions", fields: [provenanceId], references: [id], onDelete: Restrict)
  currentForProvenance CurriculumProvenance?       @relation("CurriculumCurrentRevision")
  author              User?                       @relation("CurriculumRevisionAuthor", fields: [authorUserId], references: [id], onDelete: Restrict)
  sourceRevision      CurriculumContentRevision?  @relation("CurriculumRevisionSource", fields: [sourceRevisionId], references: [id], onDelete: Restrict)
  derivedRevisions    CurriculumContentRevision[] @relation("CurriculumRevisionSource")
  governanceEvents    CurriculumGovernanceEvent[] @relation("CurriculumGovernanceTargetRevision")
  replacementForEvents CurriculumGovernanceEvent[] @relation("CurriculumGovernanceReplacementRevision")
  evidence            CurriculumEvidence[]

  @@unique([provenanceId, sequence])
  @@unique([id, provenanceId])
  @@index([provenanceId, createdAt])
  @@index([generationCorrelationId])
  @@index([contentHash])
  @@index([sourceRevisionId])
  @@index([backfillRunId])
}

model CurriculumGovernanceEvent {
  id                            String                       @id @default(cuid())
  provenanceId                  String
  sequence                      Int
  revisionId                    String
  eventType                     CurriculumGovernanceEventType
  actorType                     CurriculumGovernanceActorType
  actorUserId                   String?
  actorLabel                    String?
  approvalBasis                 CurriculumApprovalBasis?
  reviewAuthority               CurriculumReviewAuthority?
  reviewerRoleSnapshot          String?
  reviewerQualificationRef      String?
  reviewerQualificationSnapshot Json?
  riskScore                     Int?
  riskReasons                   String[]                     @default([])
  reason                        String?                      @db.Text
  lifecycleResult               CurriculumLifecycleState?
  replacementRevisionId         String?
  futureAssignmentPolicy        CurriculumFutureAssignmentPolicy?
  existingAssignmentPolicy      CurriculumExistingAssignmentPolicy?
  offlineCachePolicy            CurriculumOfflineCachePolicy?
  occurredAt                    DateTime
  auditLogId                    String?                      @unique
  idempotencyKey                String?                      @unique
  backfillRunId                 String?
  createdAt                     DateTime                     @default(now())

  revision           CurriculumContentRevision  @relation("CurriculumGovernanceTargetRevision", fields: [revisionId, provenanceId], references: [id, provenanceId], onDelete: Restrict)
  replacementRevision CurriculumContentRevision? @relation("CurriculumGovernanceReplacementRevision", fields: [replacementRevisionId], references: [id], onDelete: Restrict)
  actor              User?                      @relation("CurriculumGovernanceActor", fields: [actorUserId], references: [id], onDelete: Restrict)
  auditLog           AuditLog?                  @relation("CurriculumGovernanceAudit", fields: [auditLogId], references: [id], onDelete: Restrict)

  @@unique([provenanceId, sequence])
  @@index([provenanceId, occurredAt])
  @@index([revisionId, eventType, occurredAt])
  @@index([eventType, occurredAt])
  @@index([actorUserId, occurredAt])
  @@index([replacementRevisionId])
  @@index([backfillRunId])
}

model CurriculumEvidence {
  id                    String                    @id @default(cuid())
  revisionId            String
  evidenceType          CurriculumEvidenceType
  evidencePurpose       CurriculumEvidencePurpose
  title                 String
  uri                   String?                   @db.Text
  documentRef           String?
  citation              String?                   @db.Text
  publisher             String?
  locator               String?
  contentHash           String?                   @db.VarChar(64)
  license               String?
  addedByUserId         String?
  status                CurriculumEvidenceStatus @default(ACTIVE)
  supersedesEvidenceId  String?                   @unique
  idempotencyKey        String?                   @unique
  backfillRunId         String?
  createdAt             DateTime                  @default(now())

  revision      CurriculumContentRevision @relation(fields: [revisionId], references: [id], onDelete: Restrict)
  addedBy       User?                     @relation("CurriculumEvidenceAddedBy", fields: [addedByUserId], references: [id], onDelete: Restrict)
  supersedes    CurriculumEvidence?       @relation("CurriculumEvidenceSupersession", fields: [supersedesEvidenceId], references: [id], onDelete: Restrict)
  supersededBy  CurriculumEvidence?       @relation("CurriculumEvidenceSupersession")

  @@index([revisionId, evidencePurpose, status])
  @@index([evidenceType, evidencePurpose])
  @@index([addedByUserId, createdAt])
  @@index([backfillRunId])
}
```

Required existing-model additions:

```prisma
model AIInteraction {
  // Existing fields remain unchanged.
  generationCorrelationId String?

  @@index([generationCorrelationId, createdAt])
}

model CurriculumContent {
  // Prisma-only back-relation. No new column on CurriculumContent.
  provenance CurriculumProvenance? @relation("CurriculumContentProvenance")
}

model User {
  // Prisma-only back-relations. FK columns live in new tables.
  curriculumRevisionsAuthored CurriculumContentRevision[]  @relation("CurriculumRevisionAuthor")
  curriculumGovernanceEvents CurriculumGovernanceEvent[]   @relation("CurriculumGovernanceActor")
  curriculumEvidenceAdded    CurriculumEvidence[]          @relation("CurriculumEvidenceAddedBy")
}

model AuditLog {
  // Prisma-only back-relation. FK column lives on CurriculumGovernanceEvent.
  curriculumGovernanceEvent CurriculumGovernanceEvent? @relation("CurriculumGovernanceAudit")
}
```

### Prisma validation caveat

The composite event relation intentionally uses `(revisionId, provenanceId)` -> `(id, provenanceId)` so an event cannot target a revision from another provenance root. The implementation sprint must run `prisma validate`/`prisma generate` on the exact schema and adjust relation declarations only if Prisma requires syntactic changes that preserve the same database invariant.

The root `currentRevisionId` relation cannot express “the selected revision belongs to this same root” as simply as the event composite relation. The shared writer must enforce it transactionally, and migration verification must include a cross-root anomaly query. A DB constraint trigger may be added if Prisma cannot express the composite current-pointer FK cleanly.

## 15. Physical schema touches requiring approval

| Touch | Physical database change? | Production impact |
|---|---:|---|
| New enums | Yes | Additive PostgreSQL enum types |
| `CurriculumProvenance` | Yes | New table, indexes, FK to live `CurriculumContent` |
| `CurriculumContentRevision` | Yes | New table, indexes, FKs to provenance, user, self |
| `CurriculumGovernanceEvent` | Yes | New table, indexes, FKs to revision, replacement revision, user, audit |
| `CurriculumEvidence` | Yes | New table, indexes, FKs to revision, user, self |
| `AIInteraction.generationCorrelationId` | Yes | Nullable column on a live table |
| AI correlation index | Yes | New live-table index; concurrent creation recommended |
| Revision/event/evidence immutability triggers | Yes | New table triggers blocking update/delete |
| Provenance root delete guard | Yes | Blocks deletion while allowing current projection updates |
| `CurriculumContent.provenance` | No | Prisma-only back-relation; no `CurriculumContent` column or rewrite |
| User back-relations | No | Prisma-only; FK columns are on new tables |
| AuditLog back-relation | No | Prisma-only; FK column is on new event table |
| Alignment schema | No | Explicitly deferred |

Foreign keys created on new empty tables can briefly lock referenced live tables while constraints are installed, but they do not rewrite those referenced tables. `onDelete: Restrict` intentionally blocks hard deletion of governed content, revisions, actors, audit records, and evidence lineage.

Whether user-record hard deletion must remain possible is a founder/privacy-policy decision. If required, actor identity needs an immutable snapshot strategy before changing `Restrict` to `SetNull`.

## 16. Migration topology

### Migration A: enums and four new tables

Includes:

- All new enums
- Four new tables
- FKs and indexes on new tables
- Required existing-model back-relations in Prisma schema

Characteristics:

- Additive
- No row backfill
- No physical `CurriculumContent` column
- Brief metadata/constraint locks on referenced tables
- Deploy schema/client before any code writes the new models

Verification:

- Prisma generation/validation
- Tables, enums, FKs, unique constraints, and indexes present
- Old application version still operates while ignoring new tables
- Empty-table insert/constraint integration tests in staging

### Migration B1: AI correlation column

```sql
ALTER TABLE "AIInteraction"
ADD COLUMN "generationCorrelationId" TEXT;
```

Characteristics:

- Nullable with no default
- PostgreSQL metadata-only operation in normal conditions
- Requires a brief `ACCESS EXCLUSIVE` lock to alter table metadata
- Deploy during a measured low-traffic window with lock timeout
- Old application remains compatible

### Migration B2: concurrent AI correlation index

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "AIInteraction_generationCorrelationId_createdAt_idx"
ON "AIInteraction"("generationCorrelationId", "createdAt");
```

This should be a dedicated custom migration containing only the concurrent index statement and no explicit `BEGIN`/`COMMIT`.

Prisma tooling considerations:

- Prisma schema declares the index.
- Generated migration SQL must be reviewed and changed from ordinary `CREATE INDEX` to `CREATE INDEX CONCURRENTLY` before approval.
- Confirm in staging that the deployment wrapper does not wrap this migration in a transaction.
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
- If the production migration runner forces a transaction, execute the index through an approved operator runbook, verify it in `pg_indexes`, and reconcile Prisma migration state deliberately. Do not mark it applied before the index exists.
- A failed concurrent build can leave an invalid index. Verification must query index validity and drop/retry the invalid index concurrently under approval.

### Migration C: immutability and root delete guards

Add DB triggers patterned after the existing `AuditLog` immutability migration:

- Reject `UPDATE` and `DELETE` on `CurriculumContentRevision`
- Reject `UPDATE` and `DELETE` on `CurriculumGovernanceEvent`
- Reject `UPDATE` and `DELETE` on `CurriculumEvidence`
- Reject `DELETE` on `CurriculumProvenance`
- Permit `CurriculumProvenance` updates only for current projection fields

Install and verify triggers before any production provenance writer is enabled.

### Lock and rollback strategy

Before canonical cutover:

- Disable new writer feature flags.
- Roll readers/writers back to legacy behavior.
- Drop concurrent index concurrently if necessary.
- Drop new column/table/types only through separate approval after confirming no new data is canonical.

After immutable history becomes canonical:

- Do not delete or mutate historical records.
- Roll application readers/writers back while retaining history.
- Correct data with append-only replacement/correction events or revisions.
- Update current projections through audited transactions.
- Schema removal is no longer an ordinary rollback.

## 17. Conservative backfill rules

### Execution

- Dry-run first
- Stable cursor pagination by `CurriculumContent.id`
- Start with 50-row batches; increase toward 100 only after measurement
- Per-row transaction
- Deterministic idempotency key
- Required `backfillRunId`
- Resume with run ID and last successful cursor
- No giant transaction
- No inference from `updatedAt`
- No timestamp-proximity AI joins
- Conflicts become anomalies
- Never fabricate reviewer, prompt, model, evidence, authority, or approval basis

### Classification examples

#### `VERIFIED`

- A deterministic national-factory pending-review row with explicit source, generator version, batch/session, generation time, and non-conflicting snapshot. AI fields are null because they are not applicable.
- A future P2-A AI revision with archived prompt triple, correlation-linked interactions, provider/model, generator version, and exact snapshot.
- A future human edit with authoritative author and exact source revision.

#### `PARTIAL`

- Missing-content generation with prompt key/version/hash and content-ID-linked interaction, but multiple historical runs cannot be separated into one exact generation chain.
- Elite upgrade with payload prompt chain and source snapshot, but no deterministic final-draft interaction link.
- Import with filename/raw hash and importer identity but no retained source document/reference evidence.
- Unit-assembler content with explicit `unit_assembly` source but no prompt/provider/reviewer capture.
- Human approval with clear reviewer/audit but uncertain original generation source.

#### `UNVERIFIED`

- Approved content with no approver, no approval audit, and no provable basis.
- Teacher content labeled `ai_teacher_cocreation` where no preview/save correlation proves whether AI or a human authored the submitted body.
- A fork that copied source approval/model metadata into the new payload.
- Conflicting prompt hashes, reviewer identities, or source types.
- A row whose origin can only be guessed from title, status, timestamp, or body style.

### Conflict rule

If two sources disagree, do not silently choose one. Record the anomaly, preserve the source evidence in the dry-run report, and classify the root/revision as `PARTIAL` or `UNVERIFIED` based on whether the conflict prevents reliable identification.

### Stop thresholds

Stop before or during write backfill on:

- Any duplicate provenance root
- Any FK, sequence, or idempotency violation
- Any conflicting reviewer identity or prompt hash
- Any accidental inferred AI join
- Technical failures over 1 percent
- Completeness distribution drifting more than 5 percentage points from the approved dry-run
- Any approved content unexpectedly becoming revoked/rejected

### Rollback

Before canonical cutover, an approved rollback may remove backfill records/new tables if no consumer depends on them. After cutover, do not delete immutable records. Append corrections and adjust projections through audited operations.

## 18. Additive read/write transition

### Phase 1: additive schema

Order:

1. Four models and enums
2. AI correlation column/index
3. Immutability triggers
4. Snapshot/hash/prompt-archive libraries

No canonical reader switches. Existing reads/writes continue.

### Phase 2: canonical shared writer plus compatibility mirrors

Order writers by risk:

1. New teacher draft/create and deterministic generation
2. Imports and national factory
3. AI generation with correlation
4. Regeneration/enrichment/labs/textbooks
5. Human approval/rejection/review
6. Risk policy and automatic approval
7. Revocation/reinstatement/supersession
8. Alignment updates, still using scalar `moeAlignments`
9. Remaining maintenance/media writers

The shared writer becomes canonical for new changes. Payload/scalar compatibility fields continue for old readers.

### Phase 3: reader migration

Move:

- Admin curriculum review details
- Approval/risk history views
- MOE governance views
- Curriculum availability/revocation endpoint
- Offline manifest signing
- Evidence views
- Provenance reporting

Alignment readers remain on `CurriculumContent.moeAlignments`. Historical views read the alignment snapshot from the content revision through the same reader.

### Phase 4: provenance canonical

- Governance queries use events and lifecycle projection.
- Current content uses `currentRevisionId` for exact governed body.
- Direct material writers are blocked by the required architecture test.
- Payload governance metadata is explicitly a compatibility mirror only.

### Phase 5: optional cleanup

Only after repository search, telemetry, and tests prove no use:

- Stop writing duplicated payload governance fields.
- Retain old payload contents unless separately approved for cleanup.
- Keep `LessonVersion` for teacher undo.
- Keep `CurriculumVersion` for release grouping.
- Do not normalize standards in this phase.

## 19. Exact implementation sequence for the next approved sprint

No task below is authorized by this document.

| Step | Scope and likely files | Required tests | Escalation / stop condition |
|---:|---|---|---|
| 1 | Finalize reviewed enum/model names and schema SQL in `prisma/schema.prisma` and new migrations | `prisma validate`, schema diff review | Stop for production-live schema approval before edit/migrate |
| 2 | Apply Migration A in isolated/staging DB and inspect constraints/indexes | Migration integration, old-app compatibility | Stop on unexpected table rewrite/lock or relation mismatch |
| 3 | Apply AI column then concurrent index in staging | Index validity and query-plan check | Stop if deployment wrapper starts a transaction or invalid index remains |
| 4 | Add immutable-table/root-delete triggers | DB update/delete rejection tests | Stop if root projection cannot update or history can mutate |
| 5 | Implement snapshot V1 builder, strict validator, canonicalizer, and hash | Fixtures for every payload family, hash determinism, excluded-field tests | Stop if a learner-visible field cannot be represented |
| 6 | Implement versioned prompt archive and append-only CI guard | Duplicate key/version, changed historical hash, retrieval by key/version/hash | Stop if any governed curriculum prompt remains ad hoc |
| 7 | Implement shared content/governance/evidence repositories and required audit-ID helper | Transaction rollback, sequence, idempotency, cross-root constraints | Stop if content can commit without required revision/audit |
| 8 | Plumb correlation through routed completion, normalized logger, and teacher preview/save | Multi-call chain, telemetry failure, preview/save round-trip | Stop if an AI revision cannot be joined deterministically |
| 9 | Migrate low-risk creation paths: teacher drafts, imports, deterministic factories | Origin-specific integration tests | Stop on compatibility payload/read regression |
| 10 | Migrate AI creation paths: admin, V2, unit assembler, elite, missing, hero | Prompt/provider/model/correlation and revision tests | Stop on partial capture being auto-approved |
| 11 | Migrate regeneration, enrichment, labs, textbooks, media, and alignment writes | Prior-body reconstruction, alignment snapshot, no status carryover | Stop if approved content is overwritten without a new decision |
| 12 | Migrate approval, rejection, risk, moderation, MOE publishing, and revocation | Exact target revision, basis/authority, consequence, audit transaction | Stop on ambiguous MOE publish semantics or missing reason/authority |
| 13 | Implement evidence attachment/reference APIs and writer | Purpose/type, supersession/withdrawal, exact revision | Stop if evidence can be changed in place |
| 14 | Add full direct-writer architecture guard; remove/block unsafe scripts | AST/static test plus CI wiring | P2-A cannot complete while unauthorized writers remain |
| 15 | Build dry-run backfill and coverage/anomaly report | Idempotent rerun, resume, conflict fixtures, batch failure | Stop for explicit dry-run review before any write backfill |
| 16 | Run approved staged backfill and verification queries | Counts, root/revision pointers, completeness distribution | Stop on thresholds or status/lifecycle mismatch |
| 17 | Migrate readers and availability/revocation behavior | Old/new parity, tenant isolation, offline manifest/cache | Stop on delivery, RBAC, tenant, or offline regression |
| 18 | Enable canonical mode and completion enforcement | Full integration, security, cost, architecture, DB immutability | Final completion gate and production evidence review |

Every implementation gate must run:

- `npx prisma generate`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`

Any code/test/build failure stops the sprint. Schema deployment, backfill write, reader cutover, and canonical-mode activation are separate escalation points.

## 20. P2-A completion gate

P2-A is complete only when all of the following are true:

1. Every new governed material curriculum change creates an immutable revision.
2. Every approval, rejection, reapproval, revocation, reinstatement, and supersession targets an exact immutable revision.
3. AI-generated revisions use deterministic generation correlation across every model call.
4. Primary prompt key/version/hash is stored on the revision.
5. Exact historical prompt definitions are retrievable and hash-verifiable.
6. Existing prompt key/version pairs cannot be silently changed or reused with a different hash.
7. Evidence can be attached to and superseded for exact revisions without mutation.
8. Approval basis and review authority are explicit and independent.
9. Reviewer qualification fields remain honest nullable P2-B extension points.
10. Revocation consequences for future assignment, existing assignment, and offline cache are explicit.
11. Existing signed availability manifests enforce the selected offline consequence on refresh.
12. Current scalar alignment remains canonical and is snapshotted in revisions without a second alignment system.
13. Historical uncertainty is represented as verified, partial, or unverified without fabrication.
14. Backfill is dry-run-first, resumable, batched, idempotent, and anomaly-reporting.
15. Every material/governance writer uses the controlled mutation boundary.
16. CI blocks new unauthorized direct `CurriculumContent` mutations.
17. DB triggers prevent update/delete of immutable revision, event, and evidence history.
18. Current product behavior and compatibility reads remain functional throughout transition.
19. Tenant isolation, RBAC, audit logging, and cost controls are not weakened.
20. The four required validation commands pass.
21. Independent gate verification confirms at least one AI revision, human approval, automatic approval, import, edit, revocation, evidence chain, legacy anomaly, and backfill rerun end to end.

## 21. Founder/advisor decisions still required

1. **User deletion behavior:** Keep `onDelete: Restrict` for governance actors/authors, or define an identity-retention/de-identification policy before permitting `SetNull`.
2. **Evidence requirement:** Decide which content types/subjects require evidence before `VERIFIED` or approval. P2-A provides the model but should not invent national evidence policy.
3. **MOE publish semantics:** Confirm whether MOE release publication is itself an approval, requires prior approval, or only changes release availability.
4. **Imported preapproval:** Define which import sources may use `IMPORT_POLICY` and which authority they represent.
5. **Default revocation consequences:** Select safe defaults, especially whether existing assignments are kept or withdrawn.
6. **Urgent offline policy:** Define the shortest supported availability-refresh interval and operator escalation.
7. **Media scope:** Confirm whether hero/inline images are always material curriculum revisions and whether separate audio/video assets require later artifact governance.
8. **Partial AI capture:** Decide whether a `PARTIAL` AI revision may be saved only as pending review or must fail entirely. It must never auto-approve.
9. **Hard deletion:** Confirm that governed content is never hard-deleted and that cleanup uses rejection, revocation, or supersession.
10. **Prompt archive approval:** Confirm versioned code archive plus append-only CI manifest rather than adding a prompt-definition database table.
11. **Snapshot V1 scope:** Confirm full-pack and embedded textbook/lab fields are governed under the same revision contract.
12. **Backfill acceptance:** Approve completeness thresholds only after the dry-run report re-verifies current live distributions.

## Final status

**IMPLEMENTATION STATUS: NOT STARTED  FINAL SCHEMA APPROVAL REQUIRED**
