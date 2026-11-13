# LiberiaLearn STEM Excellence School Program V1

Owner: Chief of Staff (program director). Agents: **T2 Codex** (Content Factory, access policy, fixtures, packaging) and **T1 Claude** (student experience, teaching blocks, labs, day navigation). Started 2026-10-23.

**Scope (founder, 2026-10-23, final): the full STEM school day for every grade, Kindergarten through Grade 12,** with two synthetic sections per grade. Grades 5 and 7 are the implementation baselines, not the scope. There is no separate six-lesson pilot: the six sealed draft.6 lessons are extended into the days, and every other slot is filled by Content Factory lessons. A grade's day is complete only when every instructional slot opens a factory lesson that passes G1-G8; the simulation computes this. Draft.6 bytes and historical lesson records stay unchanged.

Current readiness: `docs/program/RELEASE_READINESS_V1.md`.

Nothing in this program is pushed, merged, deployed or activated. The learning-preview flag stays OFF until the founder authorizes an exact version. The synthetic school lives only in the isolated database Codex verifies. The Vercel Preview that shares production Supabase is prohibited.

## Deliverables in this branch (`docs/stem-excellence-program-v1`)

| Deliverable | File |
| --- | --- |
| Full-school curriculum gap matrix (generated) | `docs/program/STEM_COVERAGE_MATRIX_V1.md`, `curriculum/program/stem-v1/coverage-matrix.json` |
| K-12 course catalog, including every missing course | `curriculum/program/stem-v1/source/courses.cjs` → `course-catalog.json` |
| STEM Excellence Daily Instruction Standard | `docs/program/STEM_EXCELLENCE_DAILY_INSTRUCTION_STANDARD_V1.md` |
| Grade 7 and Grade 5 full school days, plus band sequences | `docs/program/STEM_SCHOOL_DAY_PLANS_V1.md`, `curriculum/program/stem-v1/day-plans/*.json` |
| Lesson pins: draft.6 (sealed) and schoolday (provisional) | `curriculum/program/stem-v1/source/draft6-pins.json`, `schoolday-pins.json` |
| Open production orders (machine-readable) | `curriculum/program/stem-v1/production-orders.json` |
| Instruction-quality audit of both V4 batches | `docs/program/V4_INSTRUCTION_QUALITY_AUDIT_V1.md`, `curriculum/program/stem-v1/{draft6,schoolday}-instruction-audit.json` |
| Daily schedules for all 13 grades (sections A and B) | `curriculum/program/stem-v1/day-plans/*.json` (G5, G7 hand-authored; others generated from band templates in `scripts/cos-stem/lib/days.cjs`) |
| K-12 period matrix: grade, section, slot, lesson, hash, validation, G3, G4 | `docs/program/K12_PERIOD_MATRIX_V1.md`, `curriculum/program/stem-v1/period-matrix.json` |
| Content Factory generation backlog | `curriculum/program/stem-v1/generation-backlog.json` (90 orders, 4 parallel band batches) |
| Computing and Engineering instructional standard | `docs/program/COMPUTING_ENGINEERING_STANDARD_V1.md`, `curriculum/program/stem-v1/source/standards.cjs` |
| Independent academic QA (G3) and per-grade reports | `scripts/cos-stem/g3-audit.cjs` → `curriculum/program/stem-v1/g3-audit.json`; `docs/program/GRADE_QUALITY_REPORTS_V1.md` |
| Synthetic school-day simulation (26 sections, 520 learners) | `docs/program/SCHOOL_DAY_SIMULATION_V1.md` (`scripts/cos-stem/lib/simulate.cjs`) |
| Release readiness and blockers | `docs/program/RELEASE_READINESS_V1.md` |
| Builder and validator | `scripts/cos-stem/build-program.cjs` (`--check` before any commit touching these files) |
| This plan: blueprint, ownership, targets, gates, backlog, status | `docs/program/STEM_PROGRAM_V1.md` |

## 1. What the audit found

1. **No live lesson is usable as approved curriculum.** The 2026-10-16 read-only library audit, a mechanical/AI classification and not a qualified independent review, classified all 1,105 production lessons as needing work: 701 REVISE, 353 governance hold, 51 rebuild required. None has passed qualified independent review; every judgment area still awaits it (correction prompted by Project Atlas, `9fff8615b`). DB status `APPROVED` (1,052 rows) reflects an old state machine, not quality.
2. **Live content is often filed under the wrong subject.** Grade 7 MATH includes "Exploring Action Verbs in Farming for Career Readiness". Grade 7 SOCIAL_STUDIES rows are PE and sports-vocabulary lessons. Grade 7 CIVICS includes "The Importance of Clear Vocabulary in Effective Communication".
3. **Technology and Engineering are absent from the live catalog.** All 344 live COMPUTER_SCIENCE and ENGINEERING lessons are on governance hold. V4 has no Engineering or Computing teaching pattern, and the registry has no coding or design-cycle block.
4. **Kindergarten has no content and no catalog entry.** The legacy catalog runs from Grade 1 and starts Computer Science and Engineering at Grade 7.
5. **V4 lessons: 17.** Six are sealed draft.6 (five Grade 7, one Grade 5), with recipe-level defects Q1-Q9. Eleven are provisional school-day lessons (five Grade 7, six Grade 5): stronger content, but with mojibake (S1), policy text shown to learners (S2), no hints or distinct misconceptions (S3), and computing and engineering forced into the science pattern (S4).
6. **Result:** both reference days (G7 and G5 Day 1) now have every teaching period bound to a V4 lesson. Only remediation is a gap. Across K-12, 45 of 91 platform course-grade cells are still missing courses (23 with no content, 22 held only), 12 have V4 lessons, 31 have modernizable live content, and 3 have candidates in review.

## 2. Missing courses added

Every course-grade cell a STEM school day needs now exists in the program catalog: 13 grades (K-12), 104 cells, 531 units. Each unit has a title and a specific performance task, plus required blocks and registered labs.

Added beyond the legacy catalog:

- **Kindergarten:** Math, Reading and Language, Science, Social Studies, Computing (unplugged), Engineering and Making.
- **Computing and Engineering, Grades K-6.**
- **Biology, Chemistry and Physics, Grades 10-12,** as separate courses.
- **Civics, Grades 6-12,** separate from Social Studies.

A catalog entry is a **course specification, not lesson content**. The legacy catalog (`fullCoverageCatalog.ts`) was deliberately **not** extended, because `generationEngine.ts` reads it.

## 3. Ownership and file boundaries

| Owner | Owns | Must not touch |
| --- | --- | --- |
| **CoS** | `docs/program/**`, `curriculum/program/stem-v1/**`, `scripts/cos-stem/**`, `artifacts/v4-coordination/COS-*` | Other owners' worktrees, packages and files |
| **T2 Codex** | Content Factory V4 (`lib/content-factory/**`, `curriculum/factory-v4/**`, including `4.0.0-schoolday.*`), access policy, `/learn/preview/[selection]`, the isolated database, schoolwide fixtures and timetable modes, dependency disposition, Linux packaging, `docs/qa/draft6/**` | Teaching renderers, registry, geography, PWA, LessonPlayerV2 beyond `progressStorage` |
| **T1 Claude** | `lib/learner-experience/teaching/**` (registry, instruction patterns), `components/experience/**`, the geographic map, PWA and #199, labs, the **day navigation** (`school-day/1.0.0`, `/learn/day`), browser and accessibility acceptance | Factory recipes, access policy, fixtures, packages |
| **Shared by agreement** | `LessonPlayerV2` props (`progressStorage`: T2; `sceneAttachments`: T1); `lib/curriculum/v4/standard.ts` (T1 edits, T2 acks) | One owner at a time; merge-tree check before push |

Single-authority rules:

- **One lesson generator:** Content Factory V4. The school-day batch is its full-day output. CoS production orders for periods the factory now covers are retired, so that no second spec competes with it.
- **One teaching-block registry:** `lib/learner-experience/teaching/registry.ts`.
- **One school-management system:** the existing School, Class, Timetable and related models. No schema change.
- **One runtime binding authority:** the CoS day-plan JSON says what each period holds. T2's admission policy (`lessons[].timetable`, per `T1-SCHOOL-DAY-PROPOSAL.md` item 2) is the only runtime link from a period to an admitted selection and hash. T1's day shell reads only what it admits.
- **One course map:** this catalog. The CoS maps each factory lesson to a `courseId` and unit (`schoolday-pins.json`).

## 4. Production targets

**K-12 Day 1 (now):** 90 generation orders across four independent band batches (K-2 24, 3-5 17, 6-8 17, 9-12 32), plus 2 CoS support specs. Each band batch runs in parallel and is audited and re-pinned as it lands. The waves below continue from there.

| Wave | Scope | Lessons | State / exit condition |
| --- | --- | ---: | --- |
| **W1, reference days** | G7 and G5 Day 1 | 12 bound (6 draft.6 + 11 schoolday, of which 7 are used on Day 1) + 2 retrieval sets | Teaching periods filled. Open: PO-G7-RET-01, PO-G5-RET-01; S1-S3 fixes; Codex commit and seal |
| **W2, reference weeks** | G7 and G5 full STANDARD_45 week (28 + 27 platform periods) | ≈ 38 more | Day 2 partly bound (G7: 4 of 6; G5: 1 of 6) |
| **W3, one day per band** | One complete day each for K, G2, G3, G9, G10, G12 | 36 | Every band has one gap-free reference day |
| **W4, rehearsal window** | Two weeks for every grade | 710 | No unlabelled gaps |
| **W5, full year** | 36 weeks, every course | 11,718 | National scale |

During the 2026-10-26 to 11-09 placeholder window, the realistic target is W1 plus as much of W2 as passes G1-G7. Every other period appears as a labelled gap.

## 5. Integration and QA gates (per exact lesson version)

| Gate | Check | Owner |
| --- | --- | --- |
| G1 Spec | Day plan and pins validate (`build-program.cjs --check`) | CoS |
| G2 Technical | V4 standard: no ERROR or BLOCKING; sealed receipt; hashes; renderer gate; protected keys absent; **no mojibake** | T2 |
| G3 Instruction quality | CoS audit: distinct misconceptions, hints in guided phases, diagnostic interactions, no policy or answer text shown to learners, simulations and labs used where they exist, specific learner actions, full practice continuum, subject-true pattern for Computing and Engineering, authentic Liberian application | CoS |
| G4 Subject expert | Qualified human review of the exact version. AI review is advisory. | Founder-appointed reviewer |
| G5 Experience | Real routes: keyboard, screen reader, 400% zoom, #199 notice forced visible, offline parity, required attachments (Civics map) | T1 |
| G6 Timed rehearsal | Each lesson fills its period, measured | T1 + CoS |
| G7 Isolation and security | Isolated DB verified; synthetic identities; no grading, mastery or assignment writes; per-lesson hash, cohort, window and revocation | T2 |
| G8 Authorization | Founder authorizes the exact package hash | Founder |

Integration: the CoS assembles an integration branch from origin/main using merges only. It re-verifies draft.6 byte identity, re-pins the schoolday hashes once sealed, runs `build-program.cjs --check`, and records exact commits before any push request.

## 6. Coordinated backlog, highest value first

| # | Owner | Task | Depends on |
| --- | --- | --- | --- |
| 1 | T2 | Fix **S1 mojibake** in `lib/content-factory/v4/schoolday/curriculum.ts` and `lessonAuthor.ts`, and add a package test that rejects `â€`. Regenerate the school-day batch. | - |
| 2 | T2 | Fix S2 (move policy text to the teacher projection; lesson-specific bodies) and S3 (distinct misconception ids; hints in guided phases) in the school-day recipe. Then commit and seal the batch. Draft.6 stays untouched. | #1 |
| 3 | T2 | Record computing and engineering lessons under COMPUTER_SCIENCE and ENGINEERING_FOUNDATIONS, not SCIENCE (S4) | #4 for the pattern |
| 4 | T1 | Propose instruction `1.1.0` (Engineering and Computing patterns) and registry `teaching-blocks/1.2.0` or `1.3.0` (`DESIGN_CYCLE`, `MEASUREMENT_TABLE`, `CODE_TRACE`, `GRID_ROBOT_PROGRAM`, `BUDGET_CONSTRAINT_TABLE`). Proposal in a T1-*.md first, implement after T2 ack. | - |
| 5 | T1 | **Day navigation** for the full day (`T1-SCHOOL-DAY-PROPOSAL.md`, CoS ack): `school-day/1.0.0`, `/learn/day`, reuse of `/student/today` and `TodayV2`. Each period opens `/learn/preview/[selection]`. Gaps show "No approved lesson for this period yet - teacher-led session". Memory-only state. | #6 |
| 6 | T2 | Seed G7-A and G5-A STANDARD_45 timetables from the day plans. Admission policy `lessons[].timetable` covers **every lesson in the day** (draft.6 + schoolday), so the policy cap must hold a whole day, not six. Civics stays bound to its exact hash and map attachment. | Isolated DB |
| 7 | T1 | Browser acceptance of the **full day** as one journey (G5 gate): the six already-accepted draft.6 lessons plus each school-day lesson, with the map visible and #199 forced visible | #2, #5 |
| 8 | T2 | Produce the two retrieval sets (PO-G7-RET-01, PO-G5-RET-01) and the open Day 2 periods (G7 Social Studies and a second Computing lesson; G5 P1 and P3-P6) | #2 |
| 9 | CoS | G3 re-audit when the batch is sealed; re-pin; regenerate the matrix; integration branch | #2 |
| 10 | T2 | Subject-mismatch sweep of live rows (finding 2). Report only. | - |

## 7. Founder decisions needed

| Id | Decision | CoS recommendation |
| --- | --- | --- |
| D1 | Science draft.7 for Q6? | Not now. The school-day fair test (`g7-science-evaporation-fair-test`) supplies the investigation in the Grade 7 week. Revisit after G4. |
| D2 | Strip "Generated:" from draft.6 titles in the derived view? | Yes, derived view only; package bytes unchanged |
| D3 | Adopt the daily standard and weekly allocation as a LiberiaLearn proposal (not MOE policy) | Adopt |
| D4 | Day-plan JSON as the planning source; T2 policy as the only runtime binding; no schema change | Adopt |
| D5 | School-day version naming (`4.0.0-schoolday.1`, not draft.7) | Adopt (T2 proposal) |
| D6 | Reuse the geographic county map outside Civics | Allow after Civics passes G5 |
| D7 | Offline mode for the rehearsal | Superseded: T2 reports a founder offline override (`T2-STEM-K12-ACK.md`): bounded, previously authorized offline continuation with integrity checks, local expiry and revalidation on reconnect. The CoS has not seen the founder's text and records it as reported. |
| D8 | T1 reports its authenticated synthetic-student run is blocked: the schema push into its disposable `t1draft6` database was denied by tool permission three times | Founder's call. It blocks only G5 authenticated evidence. |

## 8. Status with exact commits (2026-10-23)

| Item | Commit | State |
| --- | --- | --- |
| origin/main | `e5d89c34f` (PR #198 merged) | Local `main` checkout is behind at `887f23ecc`; not touched |
| This program | `docs/stem-excellence-program-v1` (from `e5d89c34f`), worktree `.task-worktrees/stem-program` | Local, unpushed. Head is in the mailbox note. |
| T2 draft.6 seal | `36d2ca665` (export `fe951d396`) | Six packages; Civics `2a388b30…` matches the founder pin |
| T2 school-day batch | `feat/content-factory-schoolday` @`c33fd6fbf`, `4.0.0-schoolday.1-draft.2` | Committed review draft, not sealed. 11 packages; hashes identical to the CoS pins. S1 mojibake still present. |
| T2 security | `fix/v4-pilot-security-release` @`5f3348b30` | Local, unpushed. HOLD on security and packaging. |
| T1 map | `feat/v4-civics-geographic-map` @`db178bb3e` | Local |
| T1 #199 | `fix/pwa-notice-obstruction-199` @`3672d50e1` | Local |
