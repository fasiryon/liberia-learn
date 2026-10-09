# Curriculum V2 — structured learning experience generation (Phase B)

Status: authoritative. Implements the contract in `CURRICULUM_V2_HANDOFF.md` and the
mandatory Codex baseline gates (P1-1 … P1-8). Base: `origin/main` `14b7c946`.

Curriculum V2 generates instructional *experiences*. It never grants approval:
nothing it produces is approved, published, released, MOE-approved, scored,
mastery-bearing or allowed to choose a next lesson. Existing MOE, founder,
review and release authority are unchanged.

## 1. Audit (what Phase B reuses or changes)

| System | Where | Decision |
| --- | --- | --- |
| Structured MOE objectives | `curriculum/structured/moe-structured-v1.json`, `structuredCurriculumAuthority.ts` | REUSE as the objective authority (exact ids, provenance, confidence) |
| G4 template cell | `lib/learning-authority/cells/grade4Math.ts` | REUSE for unit placement, interaction need, concept links, recorded product gaps |
| Ontology releases | `governedGrade4Math.ts`, `publishedReleases.ts`, `releases/grade4Math2026_2.ts` | REUSE; only a PUBLISHED/APPROVED release can be pinned (2026.1 today; 2026.2 stays a candidate) |
| G4 draft lessons | `lib/curriculum/authority/grade4Math/*` | MIGRATE one at a time through a bounded adapter; no mass conversion |
| Long-form generators | `generateLessonV2.ts`, `curriculum-factory.ts`, `lesson.deep*` prompts | DEFER/REPLACE for new lessons: they emit long bodies that need `parseToSlides`; left running for legacy content |
| Prompt registry | `lib/ai/promptRegistry.ts`, prompt archive + lock | EXTEND with `curriculum.v2.lesson@1.0.0` (archived, hash-locked) |
| Provenance snapshot | `lib/curriculum/provenance/snapshot.ts` | EXTEND: schema v2 for native scene payloads (P1-5) |
| Governance writer | `lib/curriculum/mutations/governanceWriter.ts` | EXTEND: native exact-revision human review gate (P1-7) |
| Student projection | `lib/curriculum/studentLessonProjection.ts` | REPLACE subtractive stripping with allow-lists (P1-2); native branch |
| Curriculum list API | `app/api/curriculum/route.ts` | FIX learner payload exposure and tenant scope (P1-1) |
| Review packages | `curriculum/review/g4-math/*`, `scripts/build-g4-math-review-package.ts` | EXTEND pattern: `curriculum/review/g4-math-v2/` (generated, staleness-tested) |
| Lesson Player V2, scenes, links, labs, evidence envelope | `lib/learner-experience/*` (Phase A) | REUSE as the runtime target; small extensions only (draft status, release identity, admission context) |
| Toolkit registry | `lib/toolkit/toolRegistry.ts` | REUSE as the only tool authority (P2-8/9) |
| SLM / DecisionModel / Orchestrator | `lib/learning-state`, `lib/learning-authority/learningOrchestrator.ts` | UNCHANGED |

## 2. Pipeline

```
governed source (structured MOE objective)
  → authoring context        lib/curriculum/v2/authoringContext.ts   (server, pinned, hashed)
  → generation brief         pipeline.ts buildGenerationBrief         (only governed facts)
  → candidate generation     LLM via routedCompletion + registered prompt, or an author   ← AI STOPS HERE
  → strict parse             parse.ts                                  (security boundary)
  → deterministic validation validate.ts + labs.ts + deliverability.ts
  → assembly                 assemble.ts                               (server builds all authority)
  → review package           reviewPackage.ts                          (curriculum/review/g4-math-v2)
  → HUMAN REVIEW of the exact revision (governed, outside generation)
  → governed approval → release → Lesson Player V2 (compat.ts)
```

The pipeline returns `REJECTED`, `REVIEW_BLOCKED` or `READY_FOR_HUMAN_REVIEW`.
It does not persist, approve or publish: `lib/curriculum/v2/**` imports no
database, mutation or governance-writer module (asserted by tests).

## 3. Contract

`lib/curriculum/v2/contract.ts`.

**CandidateLessonV2** (`candidate-lesson-v2/1.0.0`) is what a generator may
propose: title, minutes, age band, optional strategy, prerequisite assumptions,
misconceptions, scenes, assessment requests and lab proposals. Each scene has
the following fields:

- id, type (Phase A vocabulary), purpose, objective ids, learner action
- content, with optional age variants and key points
- interaction:
  - renderable: NONE, DIAGRAM_REVEAL, SINGLE_CHOICE, FREE_RESPONSE, LAB_LAUNCH, ASSESSMENT_HANDOFF
  - declared but not yet renderable: MULTI_SELECT, NUMERIC, MATCHING, ORDERING, DIAGRAM_LABELING, DRAG_DROP, SIMULATION_OBSERVATION
- fallback: TEXT_WALKTHROUGH or PAPER_ACTIVITY render as text; FREE_RESPONSE renders as a real written-response input that still collects evidence; plus `objectivePreserved`
- media intent: kind, `MEDIA_REQUIRED` / `MEDIA_OPTIONAL` / `TEXT_FALLBACK`, alt text, transcript. Never a URL.
- tools requested and prohibited
- expected observation (reviewer-only), hints, feedback, misconception refs
- evidence: kind, type, and an explicit response → objective mapping
- accessibility: text alternative, keyboard path, reduced-motion equivalence, non-pointer alternative
- offline: `FULL_OFFLINE` / `CACHED_ASSET_REQUIRED` / `ONLINE_ENHANCED` / `FALLBACK_REQUIRED`
- completion rule
- Phase C pedagogy metadata and backward `dependsOn`

**CurriculumLessonV2** (`curriculum-lesson-v2/1.0.0`) is the server-assembled
artifact. It contains:

- identity
- pinned authoring context: release id + deterministic identity, cell, context hash, source checksums
- resolved objectives, with statement, page, confidence, concepts, standards and skills
- prerequisites
- the candidate's scenes
- assessment handoffs, carrying governed item refs only
- server-resolved candidate lab links with eligibility
- provenance: generator, prompt key/version/hash, model, candidate hash, migration record
- a constant governance block: `DRAFT`, human review required, not published, MOE approval not claimed, `HUMAN_REVIEW` required
- review gaps

Subjects and ages vary by scene choice, not by schema. The G4 proof uses five
different scene sequences. Science (phenomenon → prediction → lab → reflection),
reading (passage → vocabulary → comprehension) and early-primary (narrated →
guided manipulation) arcs use the same scene types and pedagogy fields.

## 4. Mandatory gates

| Gate | Implementation | Tests |
| --- | --- | --- |
| P1-1 learner list projection | `app/api/curriculum/route.ts`: students get `projectStudentCurriculumSummary` (no payload/storage URL/cost), platform + own-school scope, APPROVED status and governed lifecycle APPROVED when one exists; teachers also tenant scoped | `__tests__/curriculum/learner-payload-secrecy.test.ts` |
| P1-2 allow-list projection | `studentLessonProjection.ts`: assessment items, options, lab steps, observation forms, analysis questions, pseudo-labs and simulations are allow-listed; unknown fields never flow; native V2 payloads project only the Lesson Player V2 experience and fail closed when malformed | same file + `pipeline-runtime.test.ts` |
| P1-3 strict parser | `parse.ts`: byte bound, deep authority/secret key scan, strict zod schemas (unknown keys rejected), bounded strings/arrays, no URLs | `candidate-authority.test.ts` |
| P1-4 canonical ontology | `authoringContext.ts`: exact objective ids; grade, subject, kind, bindability, unit, topic, concept-in-release, single source; standards/skills only from release bindings; published release only; unresolved bindings become explicit gaps | `candidate-authority.test.ts` |
| P1-5 native provenance identity | snapshot schema v2 hashes the whole native structure; `assertNativeApprovedRevisionUnchanged` makes approved native instruction immutable inside the write transaction | `governance-provenance.test.ts` (12 single-field mutations) |
| P1-6 lab governance | `labs.ts`: real lab, version, checks, objective claim, grade band, prerequisites from registries; links are always CANDIDATE with RAW_OBSERVATION mapping; `labLinkEligibility` requires approved link + approved lesson + released lab + grade + version | `candidate-authority.test.ts` |
| P1-7 human review | `v2/governance.ts` wired into both branches of the governance writer: native approval needs HUMAN_REVIEW by a qualified USER on an exact v2 revision; automated/role/school/AI bases refused; compatibility mode (and the default flag state) refuses native approval | `governance-provenance.test.ts` (flag × event × basis matrix + writer integration) |
| P1-8 executable fallbacks | `deliverability.ts`: per scene × 9 runtime scenarios (default, offline, no WebGL, no video, keyboard, screen reader, reduced motion, low memory, no drag) against what the player renders today; anything not deliverable without an objective-preserving fallback blocks review | `governance-provenance.test.ts` |

P2 status:

1. Done: empty checks, nested-id uniqueness, age-variant size, backward-only dependencies, ordering rules (intro first, objective before explanation, mastery after learning, nothing but review/reflection after mastery).
2. Done: payload limits.
3. Done: migration records the source hash, adapter version, section map and omissions.
4. Done: migration takes only the source's declared objective and proposes no labs.
5. Done: response → objective mapping.
6. Done: evidence uses the pinned release identity, and approved lessons without one fail closed.
7. Done: an `AdmissionContext` parameter replaces the hardcoded ONLINE.
8. Done: tools come from the canonical registry, and Phase A's list has a parity test.
9. Done: `resolveToolAvailability` intersects the registry, grade context, flags, assessment prohibition and accommodations.
10. Done: descriptive pedagogy metadata.

## 4a. Independent review (Phase B)

Three bounded reviewers ran before the PR: (1) curriculum governance + learning authority, (2) pedagogy + accessibility + offline, (3) runtime compatibility + learner secrecy. No P0. All P1 findings were fixed, with regression tests in `__tests__/curriculum-v2/review-fixes.test.ts`:

- **Governance:** with provenance writers off, a create, update or upsert carrying native scene keys is refused. Legacy adoption of a native payload starts as DRAFT.
- **Secrecy:**
  - The lab observation form keeps its runtime shape (`field` / `inputType` / `choices`).
  - Top-level lab and problem-set fields are type-checked.
  - Answer, solution, mark-scheme and teacher sections are stripped at any heading level.
  - The AI-literacy rubric is no longer spread to learners on the work route.
  - A stored native artifact that puts a key in a non-formative scene fails closed, and governed item refs are re-picked.
- **Pedagogy and accessibility:**
  - A fallback reported as delivered is what the learner gets: FREE_RESPONSE fallbacks render as real inputs, LAB walkthroughs show the declared fallback, and required-media scenes always include their fallback.
  - Each distractor keeps its own feedback (`optionFeedback`).
  - Only evidence the runtime can collect counts.
  - Fallbacks are checked per scenario: a paper activity needs a stated non-visual path for screen readers.
  - Labs are checked against their reduced-motion, keyboard and 2D flags.
  - Lessons are not packageable while a required asset is missing.
  - The player only opens an APPROVED link to a RELEASED lab in an approved lesson.

The legacy pseudo-lab `expectedObservation` and the simulation `explanation` / `guardianGuide` stay learner-visible by explicit decision: the legacy lesson UI presents them after the activity, and they are not assessment keys. Native Curriculum V2 keeps expected observations reviewer-only.

## 4b. Second-pass review (Codex)

A second Codex pass on PR #176 raised four P1s. The fixes below closed P1-4. Codex's merge-gate pass on `95a6e0d9` found that P1-1, P1-2 and P1-3 were only partly closed. Section 4c records the follow-up fixes. Each regression test here was checked to fail on the code it fixes.

| Finding | Fix | Regression test |
| --- | --- | --- |
| P1-1 writers-off downgrade of native rows | `repository.ts`: with provenance writers off, update, in-transaction update and upsert lock the existing row and refuse any change to a native Curriculum V2 row except rendering/search fields (thumbnail, image, embedding, `isHero`). `hash` is the row's unique payload identity, so it is refused on native rows here and on the operational-fields path | `__tests__/curriculum-v2/writers-off-native-freeze.test.ts` (in-memory Prisma fake with transaction rollback) |
| P1-2 learner projection trusts stored shapes | `learnerSafeExperience.ts` rebuilds the experience field by field with primitive checks (malformed native data → not student-ready); legacy `title` / `grade` / `subject` / `lessonFormat` must be primitives; a final secret-key scan covers every projection; answer headings and answer-label lines are stripped in legacy bodies and authored learner material | `__tests__/curriculum-v2/learner-projection-adversarial.test.ts` |
| P1-3 learner listing wider than the Tutor | `lib/curriculum/learnerEligibility.ts` holds the one learner-visibility rule set (platform non-teacher rows; own-school rows that are school-wide or assigned to the student's classes; ACTIVE version; APPROVED lifecycle; no teacher-only/private row or payload audience; native rows only as an approved release). Both `app/api/curriculum/route.ts` and the Tutor use it. The teacher view is unchanged | `__tests__/curriculum/learner-listing-eligibility.test.ts` |
| P1-4 fallback lost in age-band wording | `compat.ts`: when a fallback is appended to a scene body, it is appended to every age-band body too; structures are refused, never stringified | `__tests__/curriculum-v2/player-render.test.tsx` (real Lesson Player V2, all four bands, required-media and unrendered-interaction cases). The merge gate confirmed these cases online and offline. That is the whole certified scope: no complete traversal, and no other degraded state (no WebGL, screen reader, reduced motion, low memory) is certified by this test |

### P2 disposition (inline review comments)

| Finding | Disposition | Evidence |
| --- | --- | --- |
| P2-1 stored `lessonExperience` (no `curriculumV2`) is not student-ready | **Deferred, fails closed by design.** No writer produces such payloads, and `main` never delivered them. Delivering one would trust a stored, self-asserted `authority.status`. Do it only with server-side release verification (as the Tutor does with `publishedRelease`) | `learner-listing-eligibility.test.ts` (`native-experience-only` is not listed) |
| P2-2 candidate can override the age band | **Fixed.** `validate.ts` rejects `age_band_mismatch`; `assemble.ts` takes `context.ageBand` | `candidate-authority.test.ts` |
| P2-3 lab scene counts as evidence under any kind | **Fixed.** `evidenceCollectable` counts `LAB_LAUNCH` only with `LAB_OBSERVATION` evidence | `candidate-authority.test.ts` |

## 4c. Merge-gate pass (Codex, on `95a6e0d9`)

The merge gate held the PR on three P1s. Each fix below has regressions that fail on `95a6e0d9` and pass on the fix. The final gate on `20a335d1` found two gaps in these fixes: the writers-off governance path and blank lines in learner text. Section 4d closes them; read the P1-A and P1-B rows together with 4d. Codex's own probes from that pass also pass. The one exception is its race probe, which expects a native-row error message where the fix now fails earlier, as not-found. Codex accepted either outcome.

| Finding | Fix | Regression test |
| --- | --- | --- |
| P1-A immutability race | **Locking rule:** every write to an existing row looks the row up, locks it (`SELECT ... FOR UPDATE`), reads it again and makes every decision on that post-lock read (`lockAndReadContent` in `repository.ts`). The write is bound to the locked row's id. An update whose row is absent at lookup fails as not-found (Prisma `P2025`). It is never written blind and never turned into a create. A writers-off upsert inserts only when the row is absent at lookup; a concurrently committed row makes the insert fail on its unique key, so nothing is silently overwritten. The revision-tracked path and the governance writer's revision path also snapshot after the lock. (On `20a335d1` the governance writer's compatibility branch did not yet do this; see 4d.) | `writers-off-native-freeze.test.ts`: concurrent insert after an absent lookup; legacy to native flip before the lock; upsert insert race; operational `hash` path; post-lock snapshot order on the revision path; plus the existing native update / in-transaction update / upsert / legacy-edit cases. The fake commits concurrent writes outside the transaction and rolls back the rest. It proves the locking order, not PostgreSQL behaviour |
| P1-B answer-bearing text | **Sanitization boundary:** `lib/learner-experience/learnerText.ts` is the one rule for answer- and teacher-bearing sections. It covers Markdown headings at levels 1-6, headings numbered into lists, `1.` / `1)` / `A.` / `-` prefixed label lines, and `Label:` lines (Expected Answer/Response, Answer(s), Answer Key, Correct Answer, Solution(s), Mark Scheme, Scoring Guide, Teacher Notes/Guide, and more). Prose that only uses those words is kept, and so is a bare label with nothing under it, such as a one-word answer option "Solution". Array positions are preserved, so option lists stay aligned. (On `20a335d1` a blank line still ended a label-opened block; see 4d.) Native experiences are rejected as not student-ready if any learner string carries such a section (bodies, age variants, key points, steps, prompts, feedback, fallbacks). Legacy, authored and lab payloads are filtered item by item before numbering, and then every string in the projection is filtered again | `learner-projection-adversarial.test.ts`: native fields, authored collections, numbered headings, all lab paths, mixed nested structures, a matrix of 12 labels x 11 forms, and safe prose that must stay |
| P1-C eligibility and direct detail | **Direct-detail semantics:** `learnerEligibility.ts` checks every dimension independently and fails closed on malformed metadata: row visibility allow-list (`class_only`, `school_wide`, `public`); payload `audience` and payload `visibility` each allow-listed; restriction flags (`teacherOnly`, `reviewerOnly`, `staffOnly`, `internal`, `private`, `hidden`); ACTIVE version; APPROVED lifecycle; native approved release; platform or own-school scope with school-wide visibility or an assignment to the student's own-school class. The list route, the detail route (`app/api/curriculum/[contentId]/route.ts`) and the Tutor apply the same gates in memory. The Tutor is deliberately narrower still: it also requires the student's grade, an enrolled subject and an unchanged approved revision. The list route's query filter is only a prefilter. On the detail route, a content or scope denial is indistinguishable from a missing row. A non-APPROVED lifecycle takes the existing signed unavailable path, so offline copies are purged, and REVOKED keeps its 410. Teacher views are unchanged | `learner-eligibility-parity.test.ts`: 6 allowed and 23 denied rows through the real list route, detail route and `resolveTutorContext`, against a fake database that evaluates the real `where` filters; teacher detail unchanged |

## 4d. Final merge gate (Codex, on `20a335d1`)

| Finding | Fix | Regression test |
| --- | --- | --- |
| P1-A writers-off governance used a stale payload | **Compatibility governance also uses post-lock state.** In compatibility mode, `appendCurriculumGovernanceEventInTransaction` locks the target and re-reads it (`lockAndReadCurriculumContent`) before any decision, then decides native or legacy from that row. Native approval is refused (exact-revision HUMAN_REVIEW is impossible without writers). A native row is frozen: no status, publication or payload change. A compatibility projection can never carry native structure. The projection write is bound to the locked row's id | `compatibility-governance-race.pg.test.ts`, real PostgreSQL 17 + pgvector, deterministic interleaving. T2 locks, turns the row native with a DRAFT provenance and holds; T1's unlocked lookup sees legacy and its lock waits, which PostgreSQL's `pg_stat_activity` confirms; then T2 commits. Cases: (1) approval rejected; (2) approval plus payload replacement rejected; (2b) non-approval event with a payload replacement rejected; (3) unchanged legacy approval still publishes; (4) already-native approval and replacement rejected; (5) the repository writers-off update under the same interleaving. Every rejection leaves payload, status, `publishedAt`, `hash`, lifecycle, current revision and revision count unchanged. Cases 1, 2 and 2b fail on `20a335d1` |
| P1-B blank lines reopened restricted text | (On `cf49fe3b` a colon label with inline content still hid only its own line; see 4e.) **Whitespace cannot reopen restricted learner text.** A label-opened block ("Expected Answer", "Expected Answer:", "**Expected Response:**", "1. Answer Key", "- Teacher Notes") now runs to the next structural section boundary: a Markdown heading, a bold-only section line (`**Practice**`) or a horizontal rule. Blank lines, wrapped paragraphs and numbered lists (answers are often numbered) never end it, and with no later boundary the block runs to the end of the text (fails closed). A bare label opens a block whenever learner content follows it, even after blank lines; a label with nothing after it ("Solution" as an answer option) stays ordinary text | `learner-projection-adversarial.test.ts` "blank lines cannot reopen": Codex's exact reproduction, plus 4 labels x 5 forms (bare, `Label:`, `##` heading, numbered, bullet) x 1 or 2 blank lines (40 cases). Each case checks the final output of the legacy body, authored classwork and independent items, legacy activities, lab instructions in a lesson and in authored materials, a standalone lab, a native scene body, age variant and key point, and compat-generated fallback text. Native cases must also be not student-ready. Further tests cover a block with no boundary, bold and rule boundaries, ordinary prose and answer options, and the G4 fixtures staying student-ready. 35 of these fail on `20a335d1` |

**Running the real-database race test locally.** It is skipped unless `CURRICULUM_RACE_DATABASE_URL` is set, so CI never needs a database. To run it, start a disposable `pgvector/pgvector:0.8.0-pg17` container, run `CREATE EXTENSION vector`, generate the schema with `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` and apply it with `psql`. Then run `CURRICULUM_RACE_DATABASE_URL=postgresql://... npx vitest run __tests__/curriculum-v2/compatibility-governance-race.pg.test.ts`. Never point it at a shared database: it creates and deletes rows.

**Detail-route unavailable responses.** For a student, a content or scope denial is an unsigned 404, indistinguishable from a missing row. A coherent governed row that is pending review or rejected gets a signed unavailable 404. Revoked content gets a signed 410. A row whose legacy `published` status lags a non-APPROVED lifecycle gets an unsigned 404. The offline client removes cached content for all of these.

## 4e. Final merge gate (Codex, on `cf49fe3b`)

Codex closed P1-A (with its own run of the real PostgreSQL suite), P1-C and P1-D. One P1 remained.

| Finding | Fix | Regression test |
| --- | --- | --- |
| P1-B inline label continuation leaked | **Recognized restricted labels with inline content also open hidden sections.** In `learnerText.ts` every restricted colon-label line opens the hidden block, whether or not text follows the colon. That covers `Expected Answer: X`, `1. Answer Key: X`, `1) ...`, `A. ...` and `- Teacher Notes: X`. The inline text and every continuation line, blank-separated paragraph, and numbered or bulleted list stay hidden until the next structural section boundary (Markdown heading, bold-only section line, horizontal rule); with no later boundary, they stay hidden to the end of the text. A `## Label: X` heading opens a Markdown section, which only a heading at the same or a higher level ends. Detection is structural: prose that only uses the words ("Check your answer with a partner.", "The solution can be explained another way.") and answer options ("Solution", "Expected Value") are kept. A dash separator (`Label - X`) is **not** recognized as a label; only the colon form and bare labels are | `learner-projection-adversarial.test.ts` "inline labels": Codex's exact reproduction, the market example, and 4 labels x 6 forms (`Label:`, `## Label:`, `1.`, `1)`, `A.`, `-`) x 7 continuations (wrapped line, one blank line, several blank lines, several paragraphs, numbered list, bullet list, paragraphs plus a list). Each case runs with 3 boundaries (heading, bold-only line, rule) and checks the final output of the legacy body, legacy activities, authored classwork, independent items, a lesson lab, an authored lab, a standalone lab, a native scene body, age variant and key point, and generated fallback text. Native cases must also be not student-ready. 142 of these 171 tests fail on `cf49fe3b`; the 29 that pass there are the `## Label:` forms (already covered by the heading rule) and the false-positive test |

### P2 disposition (after the merge gate)

| Finding | Disposition | Owner / phase |
| --- | --- | --- |
| P2-1 bare stored `lessonExperience` | **Deferred, fails closed.** Not student-ready, listed, detail-visible or Tutor-eligible (covered in the parity matrix). An approval state embedded in a lesson never becomes authority | Phase C native learner delivery: the server-side, release-derived authority work in section 10 |
| P2-2 candidate age band | **Fixed** (merge gate verified) | n/a |
| P2-3 lab evidence kind | **Fixed** (merge gate verified) | n/a |
| Duplicate scene objective ids | **Fixed.** `validate.ts` rejects `objective_duplicate` | `candidate-authority.test.ts` |
| Multi-objective evidence identity | **Deferred, dormant.** `evidenceAdapter.ts` assigns a non-lab observation to its first objective only. It has no production caller (`adaptEnvelope`), so no evidence is recorded with the wrong identity today. Identity fidelity across several objectives is **not** claimed | Owner of the first evidence-ingestion route, before that route ships |
| Native Tutor compatibility tests | **Scope stated.** `tutor.grounding-v2.test.ts` injects a projected experience through a test seam. Those tests certify the Tutor's handling of an experience, **not** production native learner delivery, which is ineligible today (section 10) | Phase C native learner delivery |
| Migration assessment omissions | **Recorded, explicit.** Every migration lists what it omits (answer keys, assessment items that become Assessment Player V2 requests) in the artifact's `omissions` record (`lib/curriculum/v2/migrate.ts`; section 4, gate 3). Unchanged here | Assessment Player V2 item authoring (governed items must be released before migrated mastery scenes can deliver) |

## 5. Validator coverage

Errors reject the artifact:

- unknown scene types
- duplicate ids at any level
- objectives outside the pinned context
- uncovered objectives
- oversized scenes and age variants
- missing or insufficient text alternatives
- missing offline fallback
- unknown or conflicting tools
- unknown labs, invented lab checks, and labs that don't claim the objective
- formative keys outside formative scenes
- mastery outside the assessment seam
- unmapped evidence responses
- unsupported interactions with no fallback
- ordering contradictions
- lessons with no learner action, or made entirely of explanation
- secret fields anywhere in learner-bound content

Gaps go to the reviewer:

- BLOCKING: undeliverable scenes, required media without a governed asset, missing transcripts, fallbacks that don't preserve the objective, objectives with no evidence, assessment requests with no governed items
- ADVISORY: unbound concept or standard, MEDIUM source confidence, declared-but-unsupported interactions, fallback use, candidate-only labs, long explanations, high density, tools not offered for the grade

Static checks catch structure, not teaching quality. A human reviewer judges the pedagogy.

## 6. Grade 4 Math vertical proof

`curriculum/v2/g4-math/candidates/*.json` contains five candidates written offline
in the generator format (`AUTHORED_FIXTURE`; no live model call). The pipeline
test also runs the same JSON as mocked model output to prove the AI path. The
committed review package `curriculum/review/g4-math-v2/` is regenerated by
`scripts/build-curriculum-v2-g4-proof.ts` and staleness-tested.

| Strand | Objective | Result | Why |
| --- | --- | --- | --- |
| Place value | s1-p1-obj1 | REVIEW_BLOCKED | No governed assessment items; DRAG_DROP declared with a paper fallback |
| Equivalent fractions | s1-p3-obj5 | READY_FOR_HUMAN_REVIEW | Concept, standard, prerequisite and governed item all bound; concrete → pictorial → abstract |
| Area & perimeter | s2-p5-obj9 | REVIEW_BLOCKED | No governed items; NUMERIC declared with a written fallback; MEDIUM source confidence |
| Solid figures | s2-p6-obj5 | REVIEW_BLOCKED | No governed items; `g4-solid-figures` (IN_REVIEW) linked as a candidate only, with a real-objects fallback |
| Bar graphs | s2-p6-obj6 | REVIEW_BLOCKED | Required bar-graph image has no asset; no governed items; MATCHING declared with a keyboard alternative |

A migration demo (`ll-g4-math-read-write-numbers-to-100000-2026.1`) shows the
legacy adapter. It comes out REVIEW_BLOCKED: the long body is flagged and
assessment items are pending. All artifacts are DRAFT, review required and not
published.

## 7. Governance and review flow

```
GENERATION → DRAFT → VALIDATION → HUMAN REVIEW (exact revision) → GOVERNED APPROVAL → RELEASE
```

- A reviewer reads the package for the exact artifact hash.
- The decision goes through the existing curriculum governance (`HUMAN_REVIEW`, qualified reviewer).
- Any change to scenes, objectives, interactions, evidence, tools, links, media, accessibility or fallbacks is a new revision with a new hash, and it needs its own review.
- An approved native revision cannot be edited in place.
- `AI_PLATFORM_REVIEW` is advisory only.
- Mount Coffee stays DRAFT/PENDING and student-ineligible.

## 8. Migration strategy

1. Native Curriculum V2 lesson (this pipeline)
2. Structured governed sections (NR-13 learner materials), or a bounded adapter such as `migrate.ts`
3. Phase A compatibility (`compat.ts` → `LessonExperience`)
4. `parseToSlides` fallback
5. Legacy read mode

Adapters map only declared structure, pin the source revision, record
omissions, never infer objectives, labs or authority, and run one named lesson
at a time.

## 9. Phase C handoff (Global Pedagogy)

The schema already represents strategies Phase C may choose, as descriptive
metadata only:

- `pedagogy.primaryStrategy` and per-scene `pedagogy.strategy`: concrete → pictorial → abstract, worked-example fading, retrieval practice, structured problem solving, inquiry, reflection, guided → independent, direct instruction
- `representation`: concrete, pictorial, abstract, verbal, mixed
- `scaffoldLevel`, at scene level and per evidence response
- `purpose` per scene
- `dependsOn`
- misconception refs

None of this grants mastery, a next action, remediation or learner state.

Phase C may set these fields in the generation brief and evaluate them in review.
It must keep two boundaries:

- It must not read learner data into curriculum artifacts.
- Adaptive sequencing must stay with the Learning Orchestrator.

## 10. Known limitations

- No live model call was made. The AI path is proven with mocked completions and registered prompts.
- Only one release (G4 Math 2026.1) is executable. Most G4 objectives lack concept, standard and item bindings, so most generated lessons are correctly REVIEW_BLOCKED until governed items exist.
- Generated lessons aren't persisted. Persistence through the governed writers, plus a reviewer UI, is the next step.
- Lesson Player V2 has no media renderer and no renderers for NUMERIC, MATCHING, ORDERING and the other declared interactions, so those are delivered through fallbacks.
- Assessment Player V2 isn't built. Mastery scenes carry governed item refs only.
- The deliverability model reflects today's runtime and must be updated when renderers land.
- The review package is Markdown. Recording decisions stays in the existing governance flow.
- **Native lessons in production:**
  - No student surface plays native lessons yet. The projection returns `lessonExperience`, but `LessonDeliveryClient` and the work route do not render it.
  - `toLessonExperience` always labels the authority `CURRICULUM_V2_DRAFT`. After governed approval, the server boundary must derive the status from provenance lifecycle plus the pinned release identity. Until then, evidence stays raw: it fails closed.
- **Writers off:** with provenance writers off, an existing native row is frozen. Only rendering and search fields (thumbnail, image, embedding, `isHero`) may change. Every other edit, including title, status and `hash`, needs the revision-tracked writers.
- **Native learner visibility:** a native row is learner-visible only as an approved release. `toLessonExperience` always emits `CURRICULUM_V2_DRAFT`, so no native row is listed, returned by the learner detail route, or Tutor-eligible until the release-derived authority above lands. This is an intentional fail-closed Phase B limitation (section 4c). The fix is to derive authority on the server; weakening the release check is not an option.
- **Locking proof:** the repository race regressions use an in-memory fake that models lock order and rollback. The compatibility-governance and repository writers-off races also have a real PostgreSQL test (section 4d), but it runs only when pointed at a disposable database; CI skips it.
- **Degraded-state certification:** the real-player tests cover the four age bands with required-media and unrendered-interaction fallbacks, online and offline. Complete traversal and the other degraded runtime states are modelled by `deliverability.ts` but not certified in the real player.
- **Evidence ingestion:** `adaptEnvelope` has no production caller. Re-review its admission context when an ingestion route lands.
- **Age and subject variation:**
  - Word limits are the same for every age band.
  - There is no NARRATION renderer, so narrated early-primary arcs block.
  - `minLength` counts characters, which assumes typing.
  - Reading lessons have no passage → question linkage in the contract.
  - These are Phase C inputs.
