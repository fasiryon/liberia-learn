# Content Factory V2

Status: candidate production prototype. No release, database migration, production generation, official assessment, grade, mastery or academic-record writes are enabled.

## Scope and acceptance

The mission extends the existing content pipeline with one versioned instructional production plan, a dependency manager, exact-hash candidate packages and Curriculum Excellence V1 checks. All resources must pin the same blueprint revision. A changed prerequisite, objective, key, lesson or support requirement invalidates the dependent candidate package. Failed checks cause revision before human review. Automated recommendations never establish approval.

The acceptance proof is a reproducible Grade 7 number-sense package with lesson sequence, classwork, homework, quiz, summative, practical, project, teacher guide, protected answer keys and rubrics, worksheet, accessible text, retention and transfer opportunities. Tests must reject mixed revisions, missing objectives/dependencies, cycles, changed keys, self review, unsafe offline material and manufactured authority. The demo must expose unresolved curriculum and human-review requirements.

The implementation order is blueprint and integrity validation, existing-contract candidate adapters, dependency/retry manager, quality evaluation, Grade 7 demonstration, then independent integration review. Each stage is locally testable. Hosted inventory and release are separate human handoffs.

## Existing-system audit and reuse matrix

Baseline is `origin/main` at `a1508ceaf7d89a338de624e9f63c9c4c592ca28c`, refreshed from origin for this mission. Draft Assessment V2 is `133a238f92559ded8bbe7942753d502e22de76ec`, Academic Records V2 is `b1403d190e29ddaef1498e32acf1e9ad7bf6f342`, and Curriculum Excellence V1 is `3b51aef9afaa95711a7bf5164797c006e516d002`. Draft foundations are not evidence of deployment. The Assessment and Excellence drafts are merged only into this isolated branch to use their implementations directly. Academic Records was read, not integrated or modified. PRs #190–#194 and MergeOps are untouched.

| System and evidence | Existing owner and reusable behavior | Overlap, gap and V2 boundary |
| --- | --- | --- |
| `docs/architecture/content-factory/CONTENT_FACTORY_READINESS_V1.md`, engine and product audits | Existing convergence decision, immutable composition over existing authority | Governs this design. UnitBlueprint is an upstream production plan, ContentBundle remains the composition/delivery contract |
| `lib/curriculum/v2/{contract,parse,validate,pipeline,assemble,reviewPackage,governance}.ts` | Strict lesson candidates, pinned authoring context, deterministic assembly, review gaps, qualified human governance | Keep. Older lesson factories and NR seed/batch generators must adapt to this candidate boundary. No generated approval flags |
| `lib/ai/curriculum-factory.ts`, `lib/curriculum/{generationEngine,nationalFactory,regenerationQueue,regenerationQualityGate}.ts`, `scripts/factory-*.ts` | Generation, batching, cost and quality operations | Multiple entry points author similar embedded lesson/assessment material. Adapt their completion callbacks, not their publication shortcuts |
| `lib/agents/{runtime,registry,toolRegistry,control,costEnforcement,invocationLog}.ts`, `lib/agents/goals/` | Authorized tool execution, routing, flags, moderation, invocation budgets/logs and goal continuation | Factory Manager coordinates content dependencies only. A future paid executor must call this runtime with existing RBAC/cost controls. Prototype uses deterministic local executors and spends nothing |
| `docs/internal/agents/{curriculum-architect-agent,qa-governance-agent}.md` | Curriculum authoring and JSON repair roles | Existing QA focuses on shape and permits template repairs. Adapt role prompts to Excellence criteria; an ACCEPT response is advice, never approval |
| `lib/content-bundle/v1/{types,validator,hash,resolver,projection}.ts`, `lib/activity-definition/v1/` | Exact composition/member refs, activity content, learner/staff split, resolution and hash validation | Reuse types, hashes and projections. No second bundle model, item bank, activity store or operational assignment model |
| `lib/assessment/v2/{types,hash,validator,lifecycle,projection,scoring,evidence,retention,consumers}.ts` on draft branch | Items, forms, separate protected specs, exact-hash review/release, server/human scoring and tiered evidence | Direct dependency. No factory scoring, gradebook or mastery path. Opportunities are plans, never student evidence. Offline is capture only and keys stay protected |
| Legacy `Exam*`, `PracticeItem`, `AssessmentItem`, lesson quiz/adaptive and `lib/grading/` | Operational exams, practice, submissions and moderation | Legacy Prisma AssessmentItem is a membership row, not AssessmentItemV2. Adapt into candidates. Draft audits flag the 72-hour AI official-grade release; factory cannot invoke it |
| `lib/curriculum/excellence/{standard,assessmentBlueprint,instructionalReviewer,misconceptionErrorModels,outcomeClaims}.ts` on draft branch | National Foundation, LiberiaLearn Mastery, Global Excellence; assessment-plan rules, revision-bound advisory review | Governing quality framework. Reuse rules and retain NOT_EVALUATED/human-required criteria. Structural success cannot certify factual quality or learning outcomes |
| `lib/curriculum/provenance/{hash,snapshot,reader,validation}.ts`, `lib/curriculum/mutations/`, `lib/curriculum/review/` | Immutable revision lineage, existing scoped writer/reviewer credentials, decisions and evidence | Sole durable authority. Factory artifacts are local candidate evidence, not a competing governance ledger. Persistence extension requires snapshot coverage and schema review |
| `lib/learning-authority/{releaseManifests,governedInventory,governedGrade4Math}.ts`, `lib/learning-state/`, `lib/learning-evidence/evidenceContract.ts` | Registered releases, canonical admitted evidence and student learning state | Keep. Grade 7 candidate labels do not imply executable release. Factory has no student data or learning-state writes |
| `docs/architecture/LEARNING_ORCHESTRATOR_DECISION_INTELLIGENCE_V1.md`, `STUDENT_LEARNING_MODEL_V1.md`, `STUDENT_CALIBRATION_EVIDENCE_INTELLIGENCE_V1.md` | Learner next-action recommendation, mastery and evidence quality | Content production scheduling is separate from choosing a learner's next activity. Blueprint prerequisites describe content dependencies only |
| `docs/architecture/records/ACADEMIC_RECORDS_PROMOTION_V2.md` at draft `b1403d19` | School policies, normalized grades, NO_EVIDENCE, teacher verification, locks, finalized records, authorized promotion and appeals | Read dependency contract only. Records consume finalized academic data, not generated packages or raw evidence. No factory import of record writers |
| `ScheduledWork`, Assignment/Submission, Homework/Submission, CapstoneProject/Portfolio, LabSession; content persistence V1 docs | Operational instances, historical relationships and classroom delivery | Keep identifiers/history. Later bind a new reviewed revision through existing persistence, never update historical rows to a replacement |
| Textbook/media/export/offline infrastructure; `docs/architecture/OFFLINE_FIRST.md`, lab runtime and release pipeline V1 | Derived renderings, hashed assets, cache/sync, certification and revocation | Derive audience-specific outputs from exact refs. Prototype text/paper alternatives require no new renderer. Lab inclusion needs separate certification |
| `docs/architecture/FULL_CURRICULUM_RELEASE_PIPELINE_V1.md`, `lib/curriculum/v2/governance.ts`, release registry | Human decisions, immutable release bindings and revocation | Only existing owners may release. Factory ends at review handoff. Founder/platform review and MOE endorsement remain distinct |

Main architecture documentation was inspected for system ownership, AI systems, offline delivery, curriculum release, governed learning authority, learning orchestration, calibration, content bundles, activities and persistence. Prior audit narratives are evidence leads, not proof of current runtime or hosted data. Targeted implementation inspection determines ownership above.

## UnitBlueprint contract

Executable schema: `lib/content-factory/v2/blueprint.ts`. The schema version is independent of the immutable blueprint content version. SHA-256 uses the existing curriculum canonical JSON with a factory-specific domain. Only its self hash is excluded. Unknown fields, moving aliases and malformed pins are rejected.

The plan identifies grade, subject, unit, national objectives and explicitly optional LiberiaLearn extensions. Every objective pins source revision and page/pointer evidence; unresolved mappings remain explicit gaps. Outcomes reference these objectives. Prerequisites name diagnostic and fallback resources. Misconceptions map to instruction and protected diagnostic response patterns. The ordered sequence pins planned resource ids and dependency order. Assessment tasks reuse Excellence task vocabulary and refer to generated Assessment V2 items/forms. Support requirements describe differentiation, accessibility and objective-preserving offline alternatives. Exact source, prompt, repository and legacy revision references are part of the hash.

Generated resources carry `{blueprintId, version, contentHash}`, their own immutable identity/version/hash, author identity and exact dependency hashes. The factory supplies this envelope, never trusts a generator to assert it, and validates its complete dependency closure. A reviewed blueprint does not approve its generated children. Regeneration creates a new run/revision and leaves old artifacts and audits available.

`legacyLeads` contains user-provided discovery IDs without asserting a production revision. Verified `legacy` pins require an inventory snapshot and remain a separate field. The demo also pins its deterministic template source bytes, so code changes alter its blueprint identity. Production adapters must allocate new immutable versions through existing revision owners. Pure sealing helpers cannot enforce global version uniqueness without that repository.

## Agent dependencies and authority

| Role | Dependencies | Existing role/code to adapt | Output |
| --- | --- | --- | --- |
| Curriculum Architect | pinned sources | curriculum architect prompt, authoringContext | objectives, source/legacy gaps and plan evidence |
| Learning Science Designer | architect | Excellence standard, concept graph | progression, fading, remediation and evidence plan |
| Lesson Author | learning design | Curriculum V2 generator/parser | candidate lesson sequence, classwork, homework, worksheet, teacher guidance |
| Assessment Designer | learning design, lessons | Assessment V2 | definitions, ordered forms, items and protected scoring specs |
| Project/Practical Designer | lessons, assessment | ActivityDefinition V1 | practical/project candidates with public criteria and protected guide refs |
| Media and Accessibility Agent | all authored content | existing media/offline pipeline | text/paper alternatives and asset requirements |
| Independent Quality Reviewer | every producing role | instructionalReviewer, Excellence blueprint | exact-package advisory findings, no self review |
| Governance and Release Agent | independent quality | existing reviewer/release modules | human handoff checklist and unresolved gates only |

Factory Manager has workflow states only: PLANNED, RUNNING, REVISION_REQUIRED, FAILED and AWAITING_HUMAN_REVIEW. There is deliberately no APPROVED or RELEASED state. It validates DAGs before execution, awaits append-only audit output before invoking a task, bounds attempts, hashes inputs/dependencies/outputs, and reruns failed generation with previous errors. It never calls an official writer. The artifact sink is part of the failure boundary: a failed audit write stops work. Production durability, transactional claims and concurrent workers remain with the existing agent/job infrastructure and need a separate adapter before activation.

The CLI supplies an artifact sink that persists complete original candidates before SUCCEEDED events. Both events and artifacts use exclusive files under the same run directory. `candidate-resources.json` is a derived review index with separate source-content and projection hashes; complete hash-verifiable originals are `artifact-*.json`. In-memory tests use no-op sinks. Rejected attempt diagnostics are recorded, but raw malformed generator responses are not retained by the prototype. A governed production adapter must retain those restricted candidates and generation-invocation evidence before operational use.

## Quality and review handoff

Deterministic checks validate blueprint closure, artifact hashes, curriculum objective/sequence consistency, Assessment V2 contracts and secret separation, rubric/key references, accessibility/offline declarations, misconception links and Excellence assessment-plan rules. They do not decide factual correctness, localization accuracy, instructional effectiveness or human qualification. Every Excellence criterion appears in the report; unevaluated expert criteria remain pending. A subject expert must verify examples/keys, a different reviewer must examine reasoning/extension and the existing governance flow must authorize exact revisions. No authored work may count as its author's approval.

The demo is a review package only. It may contain protected scoring material in a distinct reviewer-only file. It must never be served from `public/`, a learner route or a general offline export. Preview uses Assessment V2 allowlists and leakage checks. No approved retention schedule is assumed; delayed tasks are proposed opportunities awaiting policy approval.

## Migration pilot and integration order

See `CONTENT_FACTORY_V2_MIGRATION.md` for read-only inventory, exact legacy preservation, candidate comparison and release handoff. Integrate Assessment V2 and Curriculum Excellence first, then blueprint/manager/prototype. Reconcile Assessment Player and existing content-persistence adapters next. Academic Records remains downstream of authorized assessment evidence and approved school policies. Coordinate PRs #190–#194 with their owners before any future overlap; this branch edits none of their sources.
