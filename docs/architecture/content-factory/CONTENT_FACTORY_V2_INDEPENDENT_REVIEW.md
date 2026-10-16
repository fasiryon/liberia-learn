# Content Factory V2 independent integration review

Reviewed 2026-10-16 in the isolated `content-factory-v2` worktree. Scope includes the blueprint, manager, quality checks, demonstration, inventory preparation, tests and their existing Assessment V2, ActivityDefinition V1, ContentBundle V1 and Curriculum Excellence V1 dependencies. The final pass also covers the prepared production SQL, offline capture validator, validator CLI and read-only production inventory runbook. It does not authorize or execute that procedure.

The reviewer is a separate agent session that did not author the implementation. This is same-model-family advisory review. It does not satisfy the independent subject-expert requirement, establish human qualification, approve curriculum, authorize release or attest production behavior. The reviewer added only adversarial tests and this report. Implementation corrections were made by the authoring agent.

## Verdict

The reviewed changes are suitable as a local candidate-generation prototype after the corrections below. They end at human-review handoff, with unresolved source mapping and release blockers retained. Production activation and a completed production migration pilot remain blocked. A passing structural quality report is not a Curriculum Excellence attainment rating or evidence that students learned.

## Findings and corrections

| Finding | Evidence and observed behavior | Resolution |
| --- | --- | --- |
| Required: assessment plan declarations were disconnected from actual assessments | The original `checkPackage` allowed a DELAYED_RETRIEVAL task to point to the formative quiz and still return AWAITING_HUMAN_REVIEW. A regression reproduced the failure. Merely satisfying the Excellence plan vocabulary was insufficient. | Tasks now name `itemIds`. Quality checks resolve those items and check objective, diagnostic/retention/transfer purpose, context, scoring and independent-practice requirements. The substitution regression passes. |
| Required: sequence objectives could disagree with their resource | A sealed blueprint could claim extension-objective coverage for a core lesson. The original parser accepted it. | `parseBlueprint` now rejects `sequence_objective_mismatch`. The adversarial regression passes. |
| Required: resealed nested assessment authority injection | Unknown `approved: true` and `official: true` fields added to a definition survived semantic validation after resealing its hash and the form reference. Generation reached human handoff carrying those fields. | A strict runtime parser now lives with the existing Assessment V2 owner at `lib/assessment/v2/parse.ts` and precedes semantic validators. Unknown nested authority fields fail generation. The regression passes. |
| Required: demonstration regeneration overwrote prior content | Initial CLI output retained each run's journal but wrote package files into a shared output directory, overwriting earlier content while leaving old output hashes. | Full content and event journals now share an exclusively created run directory. Reviewed source uses exclusive file creation for package members. |
| Required: metadata-only payload could qualify as a full original lesson | The production capture validator initially accepted any nonempty payload object, including metadata with no instructional body, when its canonical revision hash matched. | Validation now reuses `validateCurriculumContentSnapshot` on the rebuilt current projection and records CURRENT_INSTRUCTIONAL_CONTENT_INVALID. The synthetic metadata-only regression passes and the row cannot become a pilot candidate. |
| Required: relationship baseline omitted direct lesson history stores | The initial prepared query counted assignment/homework submissions but omitted `GradedSubmission`, whose lessonId is a direct database-ID reference. It also lacked teacher/timetable assignment coverage and separate teacher-edit history references. | SQL, runtime capture schema, fixture and runbook now include those aggregate counts, StudentSession through ScheduledWork, and LessonVersion references/body hashes. Older Lesson metadata is counted as explicit reconciliation coverage; generic unit-only Submission links remain explicitly unattributable to a lesson. |

The first adversarial run reproduced two failures and passed self-review protection. A subsequent run reproduced the nested authority failure. After corrections, the focused suite passed all 14 then-present tests, including six independent adversarial cases. This sequence matters: the tests first demonstrated reachable defects rather than only confirming intended implementation behavior.

## Integration boundaries checked

- Assessment definitions, forms, items, protected specs and their hashes remain Assessment V2 contracts. The factory calls its validators and learner projection. It does not introduce another scorer, assessment release or attempt/evidence store.
- Native lessons use the Curriculum V2 candidate parser. Activities use ActivityDefinition V1 parsing and hashing. The demonstration composes ContentBundle V1 references; it creates no second delivery authority.
- Curriculum Excellence V1 provides the assessment-plan rules, rubric and reviewer-independence check. Every criterion remains NOT_EVALUATED in the local report. Factual correctness, instructional effectiveness and qualification are not inferred from generation or rendering.
- The fixed role graph validates production order. Generated envelopes carry the blueprint hash and exact dependency identities/hashes. Resealing an artifact with a stale dependency hash is caught by package closure checks. Existing tests also catch changed protected keys and mixed blueprint revisions.
- A reviewer sharing the author's stable agent identity fails before its executor runs. Same-family review remains recorded as non-independent. The local empty reviewer executors do not claim that expert review occurred.
- The learner assessment preview uses Assessment V2's allowlist. Copying distinctive protected moderation prose into a learner worksheet fails package checks even after resealing. Raw protected material is confined to a separately named reviewer file outside `public/` and learner routes.
- The manager has no approved/released state. No database, academic-record writer, assessment release writer or production migration dependency was found in the new factory and CLI sources. This inspection is a source boundary check, not a runtime authorization audit of future adapters.
- Inventory preparation consumes an explicit export and rechecks existing curriculum snapshot hashes. It has no database capability. The migration plan preserves historical identities and relationships, and describes future release through their existing owners.
- The optional artifact sink completes before a SUCCEEDED event or any downstream task. A sink failure is terminal and does not trigger paid-generation retries. The demonstration persists original artifacts beside the journal; projected review resources retain a source hash and a separate projection hash rather than presenting transformed bytes under the original content hash.

## Prepared read-only production procedure

Source inspection found an explicit REPEATABLE READ READ ONLY transaction, session-local timeouts, SELECT statements and a terminal ROLLBACK. There are no DML, DDL, temporary tables, application functions, explicit locking reads or academic writers in the prepared SQL. Session checks reject missing salt, non-read-only state and the listed administrative/write privileges. These checks supplement the separately required least-privilege and complete-visibility attestations; they cannot establish those attestations by themselves.

The query selects lesson bodies and canonical immutable revisions, plus aggregate relationship counts and salted event references. It includes AssignmentSubmission, HomeworkSubmission and GradedSubmission separately, TeacherLessonAssignment and TimetableAssignment by logical content identity, and StudentProgress/StudentSession through ScheduledWork. Assignment totals count store relation rows and do not claim distinct pedagogical tasks. Separate LessonVersion teacher-edit references retain body hashes without exporting author IDs or metadata. The older metadata-only Lesson graph produces an explicit reconciliation gate when nonempty. Unit-level Submission/Assessment links and unstructured legacy metadata are documented coverage limits.

It does not select pupil identifiers, response bodies, scores or event metadata. Full authored content remains restricted because free text may contain personal information. The runbook requires operator/data-owner authorization, catalog verification, target/role/RLS attestation, a private output directory, SQL commit/hash receipt and successful client exit. It forbids owner-credential fallback or schema repair. The reviewer checked relevant relationship columns against the repository schema, not a live catalog.

The offline validator rejects incomplete/wrong-count captures, non-read-only assertions, unknown personal fields in event references, duplicate identities and mismatched event-reference counts. It retains damaged/missing revision evidence as ineligible gaps. It independently rebuilds the current canonical snapshot and compares it with the exact current revision, so a mutable body change cannot silently qualify as that revision. Its output explicitly says OFFLINE_INTEGRITY_CHECKED_NOT_PRODUCTION_ATTESTED. The CLI rejects invalid UTF-8, requires a new output directory outside the checkout and uses exclusive output creation. The supplied discovery identifiers remain unverified revision leads pending accepted authoritative production evidence.

No live read, connection, SQL execution, credential retrieval or production attestation was attempted. SQL execution permissions, full visibility, actual schema compatibility, export privacy and target identity remain operator gates. Offline synthetic validation cannot close them.

## Verification

Command run by this reviewer: `npx.cmd vitest run __tests__/content-factory-v2`.

Initial review checkpoint: two test files, 14 tests passed. The final stable implementation passed all 27 tests across four files with the command above. The added metadata-only production-capture regression also passed independently with `npx.cmd vitest run __tests__/content-factory-v2/production-inventory.test.ts -t "metadata-only"`. The six original adversarial cases cover actual delayed-task substitution, sequence objective mismatch, same-agent review, resealed nested approval fields, stale dependency hashes and protected-prose leakage. The final fixture additionally verifies six assignment relation rows and fifteen submissions, including seven GradedSubmission records. Authoring-agent checks should be reported separately in the final handoff.

An earlier reviewer attempt at `npm.cmd run validate:changed` passed the API route policy audit and stopped because the worktree lacked the local `.bin/vitest` preflight target. Focused tests were run successfully through `npx.cmd`. The authoring agent owns the final validation rerun and environment repair evidence; this report does not count that earlier command as a pass.

Source inspection covered hash/envelope construction, audit-before-execution behavior, bounded retries, strict candidate parsing, item/form/spec closure, protected projections, demonstration file retention and the pure inventory adapter. This review made no network calls, production reads, production writes or commits.

## Remaining gates and integration order

1. Reconcile and integrate the exact Assessment V2 and Curriculum Excellence foundations with their owners. Academic Records stays downstream of authorized assessment outcomes and school policy. Coordinate changes affecting PRs #190–#194 or MergeOps separately.
2. Integrate the factory as local candidate authoring only. The single-executor manager and local journal are not a durable concurrent job service. Reuse the existing agent/job, audit, cost-control and persistence infrastructure before activation.
3. Obtain an authorized, attested production read-only inventory. Select and compare an actual Grade 7 unit with exact legacy revisions and relationship baselines. Repository fixtures cannot close this gate.
4. Resolve national-objective mappings, trusted native authoring context, curriculum release/ontology/template prerequisites and approved retention policy. Source hashes are bindings, not evidence of source authority or semantic mapping correctness.
5. Have qualified humans examine factual accuracy, answer keys, misconception mappings, accessibility, offline behavior and the original-versus-candidate comparison. Obtain the separate independent reasoning/extension review. No criterion marked NOT_EVALUATED counts as MET.
6. Route exact candidate revisions, assessments and bundle composition through existing review/release owners. Any production migration, official academic write or release requires separately authorized work. Preserve original content, assignment, submission and learning-event records.

The report covers the reviewed implementation checkpoint. A later change to assessment contracts, audience projection, authority checks, dependency hashing or persistence needs renewed focused review.
