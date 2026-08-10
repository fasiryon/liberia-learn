# P2-A: Immutable Lesson Provenance and Lifecycle — Design Proposal

Status: PROPOSAL, NOT REVIEWED, NOT IMPLEMENTED.

This document is P2-A's Deliverable 0 follow-on. No schema change has been
made or should be made until this proposal is reviewed and an explicit
decision is recorded. `CurriculumContent` is production-live; this repeats
the standing escalation contract on purpose, because it is the load-bearing
constraint on every decision below.

## 1. Why a new document, not just new columns

Deliverable 0 (prior session) found that provenance-shaped data already
exists, scattered across three uncoordinated places:

1. `CurriculumContent.payload` (JSON) — `approvedByUserId`, `approvedAt`,
   `approvalStatus`, `riskScore`, `riskReasons`, `riskFlagged`, `flaggedAt`,
   `metadata.model`, `metadata.generatedAt`, `moeAlignments`.
2. `CurriculumContent` scalar columns — `moeAlignments` (duplicated from
   payload), `version`, `versionId → CurriculumVersion`, `rejectionReason`,
   `editedById`/`editedAt`/`editReviewStatus`.
3. Event-shaped tables that aren't linked back to the lesson at write time —
   `AuditLog` (immutable, DB-trigger-enforced, but a generic system-wide log
   with unstructured `details` JSON) and `AIInteraction` (has `promptVersion`/
   `promptKey`/`promptHash`/`contentId`/`lessonId` columns, but the curriculum
   generation pipeline never populates `contentId`/`lessonId` because the
   `CurriculumContent` row doesn't exist yet when the generation call fires).

None of these gaps are solved by adding more fields to any one of the three.
The problem is queryability, linkage, immutability, and revocation — not a
missing column. This proposal addresses all four directly.

## 2. Approved direction (from review, not open for re-litigation)

- A dedicated table family around `CurriculumContent`, not new fields bolted
  onto `CurriculumContent` itself. Reasoning already accepted: provenance is
  a growing concern (P2-B reviewer qualification, evidence, revocation,
  immutable history), and repeatedly altering a production-live, high-traffic
  table to absorb that growth is worse than paying for a join now.
- `payload` stays for generation metadata and back-compat. It is not the
  canonical provenance system going forward.
- Historical uncertainty must be represented honestly. Backfill must never
  fabricate a plausible-looking value to close a gap. An explicit
  `legacy_unverified` beats a guess, no exceptions.

What remains genuinely open, and is decided or scoped below: exact table
count within the family, exact field list, migration sequencing, and the
canonical-vs-fallback read rule.

## 3. Proposed table family

```
CurriculumContent (existing, unchanged by this proposal)
    |
    +--(1:1)--> CurriculumProvenance        canonical current-state snapshot
    |
    +--(1:many)--> CurriculumProvenanceEvent   immutable append-only history
    |
    +--(1:many)--> CurriculumEvidence          first-class evidence links
```

Three tables, not four. The user's own sketch included a fourth,
`CurriculumRevocation[]`. Section 3.4 compares that against folding
revocation into `CurriculumProvenance` (current state) plus
`CurriculumProvenanceEvent` (history of every revoke/reinstate), and
recommends the three-table version as the minimum viable design — but this
is exactly the kind of shape decision this document is supposed to put in
front of you rather than lock silently.

### 3.1 `CurriculumProvenance` — 1:1 canonical current state

One row per `CurriculumContent`, created either at generation time (new
content, going forward) or by backfill (existing content). Its *existence*
for a given lesson is itself the migration marker — see Section 6.

Illustrative shape (not final):

```prisma
model CurriculumProvenance {
  id                String    @id @default(cuid())
  contentId         String    @unique
  content           CurriculumContent @relation(fields: [contentId], references: [contentId])

  // Generation / source
  sourceType        CurriculumSourceType   // GENERATED | IMPORTED | TEACHER_AUTHORED | UNKNOWN
  generator         String?                // e.g. "generateLessonV2", "bulk-approve-published"
  model             String?                // normalized, e.g. "gpt-4o+gpt-4o-mini"
  promptKey         String?
  promptVersion     String?
  promptHash        String?

  // Approval
  approvalBasis     CurriculumApprovalBasis  // MACHINE_GATE | HUMAN_REVIEW | MOE_REVIEW | LEGACY_UNVERIFIED
  reviewerUserId    String?
  reviewedAt        DateTime?
  riskScore         Int?
  riskReasons       String[]                 @default([])

  // Revocation (current state only; history lives in CurriculumProvenanceEvent)
  revocationState   CurriculumRevocationState @default(NONE)  // NONE | REVOKED | REINSTATED
  revokedAt         DateTime?
  revokedByUserId   String?
  revocationReason  String?

  // Legacy honesty
  legacyState       CurriculumLegacyState?    // RECONSTRUCTABLE | PARTIAL | UNKNOWN, null once genuinely current

  contentVersion    Int       @default(1)     // increments on each provenance-relevant change, distinct from LessonVersion
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  events            CurriculumProvenanceEvent[]
  evidence          CurriculumEvidence[]

  @@index([approvalBasis])
  @@index([revocationState])
  @@index([legacyState])
}
```

### 3.2 `CurriculumProvenanceEvent` — immutable append-only history

This is the actual answer to "immutable version history," and it is
deliberately not `LessonVersion` (which prunes to 20 rows per lesson via
`deleteMany` and only fires on teacher body edits). It reuses the exact
DB-trigger immutability pattern already live and independently re-verified
for `AuditLog` under NR-9 (`prevent_audit_update`/`prevent_audit_delete`
triggers, `RAISE EXCEPTION` on UPDATE/DELETE) — proven infrastructure, not a
new mechanism.

```prisma
model CurriculumProvenanceEvent {
  id             String   @id @default(cuid())
  provenanceId   String
  provenance     CurriculumProvenance @relation(fields: [provenanceId], references: [id])
  contentId      String   // denormalized for direct query without a join
  eventType      CurriculumProvenanceEventType
  // GENERATED | RISK_FLAGGED | RISK_AUTO_APPROVED | HUMAN_APPROVED | HUMAN_REJECTED
  // REVOKED | REINSTATED | BACKFILLED | LEGACY_MARKED_UNVERIFIED
  actorUserId    String?
  actorLabel     String?  // for script-driven actors, e.g. "system:bulk-approve-published"
  riskScore      Int?
  riskReasons    String[] @default([])
  detail         Json?    // event-specific structured detail, not a dumping ground for current state
  createdAt      DateTime @default(now())

  @@index([contentId, createdAt])
  @@index([provenanceId, createdAt])
  @@index([eventType, createdAt])
}
```

Migration adds two triggers modeled directly on
`20260522_000001_audit_immutability/migration.sql`: `curriculum_provenance_event_no_update`,
`curriculum_provenance_event_no_delete`.

### 3.3 `CurriculumEvidence` — first-class evidence links

Replaces "buried JSON" with a queryable, joinable collection, matching the
user's requirement directly.

```prisma
model CurriculumEvidence {
  id             String   @id @default(cuid())
  provenanceId   String
  provenance     CurriculumProvenance @relation(fields: [provenanceId], references: [id])
  contentId      String   // denormalized, same rationale as the event table
  evidenceType   CurriculumEvidenceType  // STANDARD_DOCUMENT | SOURCE_TEXT | WAEC_PAPER | EXPERT_REVIEW | OTHER
  url            String?
  description    String?
  addedByUserId  String?
  createdAt      DateTime @default(now())

  @@index([contentId])
}
```

Not marked immutable at the DB layer — evidence links can legitimately be
corrected (a broken URL, a wrong citation) without that correction itself
needing to be a provenance-changing event. If you want evidence corrections
audited too, that's a one-line change to add the same trigger pair; flagging
as an open call rather than assuming it.

### 3.4 Revocation: fold into `CurriculumProvenance` + events, or a separate table?

**Recommended (minimum viable): fold into `CurriculumProvenance` (current
state: `revocationState`/`revokedAt`/`revokedByUserId`/`revocationReason`)
plus one more `CurriculumProvenanceEvent.eventType` value per
revoke/reinstate action.** This gets "real revocation state and revocation
metadata" and "history of every revocation" without a fourth table, and
matches how the rest of this design already separates current-state
(`CurriculumProvenance`) from history (`CurriculumProvenanceEvent`).

**Alternative: a separate `CurriculumRevocation` table**, justified only if
a revocation event needs multiple *structured* fields beyond what the
generic event table's `detail: Json?` can reasonably hold — for example, if
revocation needs to track which offline packs were affected, a
notification-sent flag, or a distinct approval step for reinstatement. P5-A
(signed offline packs and revocation manifests) is a related but distinct
system: a curriculum-approval revocation here is a different concept from a
P5-A offline-manifest revocation, though logically a curriculum revocation
should be able to *trigger* a P5-A manifest revocation. That integration
point is real but out of scope for this proposal — flagging it so P5-A
doesn't get designed twice, not proposing to solve it here.

This is presented as a comparison, not a locked decision — pick either at
review time; the rest of the design does not depend on which one wins.

## 4. `approvalBasis`: explicit enum, not `AuditLog` inference

```prisma
enum CurriculumApprovalBasis {
  MACHINE_GATE        // script-driven quality gate only, no human ever reviewed it
  RISK_TRIAGE_AUTO     // passed risk-triage scoring and was auto-approved under budget
  HUMAN_REVIEW         // a human (ADMIN or equivalent) approved via the approve route
  MOE_REVIEW           // a human with an MOE role approved
  LEGACY_UNVERIFIED    // pre-dates this system; basis cannot be honestly reconstructed
}
```

This directly replaces the inference NR-11 had to do by hand (checking
whether `payload.approvedByUserId` is null, then cross-referencing which
`AuditLog.action` fired) with a stored, queryable field. `MOE_REVIEW` vs.
`HUMAN_REVIEW` is a real distinction worth keeping separate now, even though
today's approve route doesn't yet branch on reviewer role — P2-B's reviewer
roster will need it, and retrofitting an enum value later is worse than
having an unused-for-now value today.

## 5. Fixing the prompt-linkage timing bug

Today, `generateLessonV2.ts`'s `routedCompletion()` calls set
`aiUsage.promptKey` but never `aiUsage.contentId`/`aiUsage.lessonId`,
because the `CurriculumContent` row doesn't exist yet when the generation
call fires — so even where `AIInteraction` logs `promptVersion`/`promptHash`,
it's never joinable back to the lesson it produced.

Proposed fix, in generation-order terms, not code: generate a `contentId`
*before* the first `routedCompletion()` call (the ID generation is already
independent of content — `contentId` is a `cuid()`-shaped unique string, not
derived from the row), pass it through `aiUsage.contentId` on every pass
(body generation, metadata extraction, expansion), and use that same
pre-generated ID when the `CurriculumContent` row is finally created. This
makes `AIInteraction` rows joinable to their lesson from the moment they're
written, and lets `CurriculumProvenance.promptKey`/`promptVersion`/
`promptHash` be populated directly from the pipeline's own `aiUsage` object
at creation time — no separate lookup required. Same fix applies to every
other generation path found in Deliverable 0 (`curriculum-factory.ts`,
`unitAssembler.ts`, `eliteUpgrade.ts`) — each needs the equivalent
early-ID-generation change; this proposal does not assume they're
implemented identically without checking each at implementation time.

## 6. Backfill: three honest buckets, no fabrication

Legacy rows (everything created before `CurriculumProvenance` exists for
them) sort into exactly three states, computed from what's actually on the
row today — not guessed:

| Bucket | Criterion (from existing data) | `legacyState` | `approvalBasis` |
|---|---|---|---|
| Reconstructable | `payload.approvedByUserId` is a real user ID AND `payload.approvedAt` is present | `null` (fully migrated, not legacy-flagged) | `HUMAN_REVIEW` or `MOE_REVIEW` (derived from that user's role at approval time if determinable, else `HUMAN_REVIEW`) |
| Partially reconstructable | `payload.riskScore`/`payload.riskReasons` present (risk-triage ran) but no human `approvedByUserId` | `PARTIAL` | `RISK_TRIAGE_AUTO` or `MACHINE_GATE` depending on which script wrote it (recoverable from `AuditLog.action`) |
| Genuinely unknown | Neither of the above — the ~712/1,089 rows NR-11 already found with no approver identity and no risk data | `UNKNOWN` | `LEGACY_UNVERIFIED` |

Per NR-11's live-verified counts (2026-08-02/03): of 1,089 `APPROVED`/
`published` rows, 7 have a real human `approvedByUserId` (reconstructable),
some subset carries risk-triage data from the post-PR-#79 window
(partially reconstructable), and the remainder — the bulk of the 712 with
no approver identity — falls into `LEGACY_UNVERIFIED`/`UNKNOWN`. The exact
split must be re-queried live at implementation time, not assumed from this
note; live counts drift, as this project has been burned by before.

No bucket assignment invents a reviewer, a risk score, or a review date that
isn't already present on the row. `LEGACY_UNVERIFIED` is a first-class,
permanent, honest answer — not a placeholder to be quietly upgraded later
without new evidence.

## 7. Migration strategy: no single risky rewrite

`CurriculumContent` has roughly 1,100 rows total (per NR-0/NR-11 live
counts) — small enough that a single transaction is *technically* feasible,
but a single big-bang backfill is still the wrong choice, because:

- It couples an irreversible, all-at-once write to a production-live table
  with a brand-new, unreviewed classification script's first real run.
- It gives no opportunity to spot-check the three-bucket split against a
  sample before committing to the full set.

Proposed phases:

1. **Schema migration** (additive only): create `CurriculumProvenance`,
   `CurriculumProvenanceEvent`, `CurriculumEvidence`, the four enums, and the
   two immutability triggers. Zero existing tables altered. This is the one
   step that needs the standing schema-change review before it runs.
2. **Forward-write cutover**: every code path that creates or approves
   `CurriculumContent` (generation pipelines, `approve`/`reject` routes,
   `triageAndApprove`) additionally writes a `CurriculumProvenance` row (and
   a corresponding first `CurriculumProvenanceEvent`) at the same time,
   inside the same transaction where one already exists (the approve route
   already wraps its update + `logAuditRequired` in `prisma.$transaction`;
   the new write joins that transaction, not a new one). New content never
   enters the "unmigrated" state described in Section 8 — only historical
   rows do.
3. **Backfill script, batched and idempotent**: modeled on the project's own
   established pattern (`scripts/seed-load-test-pool.ts`'s idempotency,
   `bulk-approve-published.ts`'s dry-run-first convention). Runs in small
   batches (matching the pooled-`DATABASE_URL` sequential-write carry-forward
   rule), is safe to re-run, and produces a report (counts per bucket) before
   any write, with an explicit dry-run mode as the default invocation.
4. **Spot-check before full run**: run the backfill script against a small,
   named sample first (e.g. the 7 known-reconstructable rows plus a handful
   from each other bucket) and manually verify the classification against
   the live `payload`/`AuditLog` data before running it against all ~1,100
   rows.
5. **Full backfill**, batched, with the same re-run safety.

At no point does this require rewriting every lesson's `payload` or
`CurriculumContent` row itself — the backfill only ever inserts new
`CurriculumProvenance`/`CurriculumProvenanceEvent` rows. `CurriculumContent`
is not touched by migration or backfill under this design.

## 8. Read-path rule during transition: explicit marker, not silent fallback

**Specific answer: the app requires an explicit per-row migration marker. It
does not do canonical-first-with-JSON-fallback.**

Concretely: the *existence* of a `CurriculumProvenance` row for a given
`contentId` is the marker — no separate boolean column is needed for this.
Until a lesson has a `CurriculumProvenance` row, any surface asking "what's
this lesson's provenance/risk/approval basis" must report an explicit,
distinct "not yet migrated" state — never silently reading `payload` and
presenting it as if it came from the canonical system. Once the row exists
(even with `legacyState: UNKNOWN`), every read of provenance-relevant fields
comes exclusively from `CurriculumProvenance`/`CurriculumProvenanceEvent`/
`CurriculumEvidence`; `payload`'s provenance-shaped fields are never
consulted again for that row.

Reasoning: a silent fallback collapses exactly the distinction this design
exists to preserve. If "no revocation record" can mean either "confirmed:
never revoked" or "not migrated yet, don't actually know," the fallback has
manufactured false certainty — the one thing explicitly ruled out. An
explicit marker makes "not yet classified" a visibly different state from
"classified as unknown," which are not the same claim.

Practical consequence: any UI or API surface built on top of
`CurriculumProvenance` before backfill completes must handle a genuine third
state (not-yet-migrated) alongside the enum values, not just null-coalesce
into a default.

`payload`'s raw fields remain readable directly only by code that
predates this migration and is explicitly scheduled for removal (Section 9)
— they are not a permanent secondary read path.

## 9. Field ownership: canonical vs. legacy mirror

| Field | Canonical home (post-migration) | Legacy mirror | Mirror status |
|---|---|---|---|
| Approver identity | `CurriculumProvenance.reviewerUserId` | `payload.approvedByUserId` | Stop writing once approve route writes `CurriculumProvenance` directly (Phase 2) |
| Review date | `CurriculumProvenance.reviewedAt` | `payload.approvedAt` | Same as above |
| Risk score/reasons | `CurriculumProvenance.riskScore`/`riskReasons` | `payload.riskScore`/`payload.riskReasons` | Stop once `triageAndApprove` writes `CurriculumProvenance` directly |
| Model/generator | `CurriculumProvenance.model`/`generator` | `payload.metadata.model` | `payload.metadata.model` keeps being written indefinitely — it's read by existing tooling and costs nothing to keep; it simply stops being anyone's source of truth |
| MOE alignment/standards | Unchanged — stays on `CurriculumContent.moeAlignments` | `payload.moeAlignments` | Out of scope for this migration; already duplicated today, not part of the provenance gap this proposal addresses |
| Prompt key/version/hash | `CurriculumProvenance.promptKey`/`promptVersion`/`promptHash` | none today (currently unlinked in `AIInteraction`) | N/A — this is new linkage, not a migration away from an existing mirror |
| Approval basis | `CurriculumProvenance.approvalBasis` | inferred today via `AuditLog.action` | `AuditLog` keeps recording the same actions (no change to audit logging); it stops being the *only* place the basis can be determined |

Rule of thumb applied throughout: fields that existing, unrelated tooling
already reads from `payload` keep being written there for as long as that
tooling exists (documented, not silently deprecated); fields that only
existed as an inference or a workaround stop being written to their old home
once the canonical write path is live.

## 10. What this proposal deliberately does not do

- Does not touch `CurriculumContent.moeAlignments`/`version`/`versionId` —
  source-standards tracking and release-batch versioning are already
  reasonably served by existing columns; duplicating them into the new
  family would be exactly the "unnecessary duplication" this proposal is
  supposed to avoid.
- Does not build P2-B's reviewer roster or credential scope.
  `CurriculumProvenance.reviewerUserId` is a bare FK to `User`; qualification
  lives wherever P2-B puts it, not here.
- Does not touch `LessonVersion` or its 20-row pruning. That remains the
  teacher body-edit buffer it already is; `CurriculumProvenanceEvent` is a
  different concept (approval/risk/revocation lifecycle, not body-diff
  history) and this proposal does not attempt to unify them. If a future
  session wants to merge these concepts, that's a separate, explicit
  decision.
- Does not decide whether teacher-authored content (`teacherCreated: true`,
  `editReviewStatus`) goes through this same provenance model or a separate
  one. Today's `editedById`/`editedAt`/`editReviewStatus` fields are a
  different review flow (teacher-to-teacher content sharing, `visibility:
  class_only`) from MOE curriculum approval. Whether P2-A's provenance model
  should also cover that flow, or explicitly exclude it, is an open question
  for review — flagging it rather than silently scoping it either way.
- Does not implement the P5-A offline-manifest-revocation integration noted
  in Section 3.4.

## 11. Escalation

Per the standing contract and P2-A's own note: this schema change touches
work adjacent to `CurriculumContent` (new tables plus a foreign key into it)
and must stop for review before implementation. This document is that stop.
Nothing in it has been applied. Sections 3.4 (revocation table shape), 9 (a
few mirror-retirement timings), and the teacher-authored-content scope
question in Section 10 are the specific points that need an explicit call,
not just a read-through.
