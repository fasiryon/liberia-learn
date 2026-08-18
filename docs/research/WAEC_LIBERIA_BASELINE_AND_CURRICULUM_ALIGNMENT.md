# WAEC Liberia Baseline and Curriculum Alignment — Research Evidence

Status: LIVE RESEARCH RECORD. Written for P2-C
(`docs/roadmaps/CONSOLIDATED_BACKLOG.md`, PRIORITIES_1_2_5_6_7 program).
Last updated: 2026-08-17 (evidence-semantics correction pass — see
"Evidence-semantics correction" note below; supersedes the same-day
"Recovery pass" note further down, which is kept for history). Full
hash-level reproduction manifest: `docs/research/P2C_EVIDENCE_MANIFEST.md`.

## Evidence-semantics correction (2026-08-17, second pass)

The recovery pass below correctly found real MOE and WAEC documents, but
initially over-claimed what they prove: it treated WAEC Liberia's general
"detailed syllabuses... are distillation of the Ministry's Curriculum"
statement, plus a subject/exam-applicability fact (Mathematics is an
examined LJHSCE/LSHSCE subject), as sufficient to call the MOE Grade 9
Two-Set-Problems objective a **DIRECT** WAEC alignment that **MEETS_BASELINE**.
That is wrong: a general distillation statement and a subject-applicability
fact are **SUBJECT_LEVEL** evidence — they establish that *some* WAEC
baseline exists for Mathematics at this grade, not that *this specific
competency* was assessed at a known depth. No topic-by-topic WAEC
Mathematics syllabus was recovered this session (see "what remains
genuinely unverified" below), so no **TOPIC_LEVEL** WAEC evidence exists for
this competency.

The correction, now enforced in code (`lib/curriculum/benchmarking/aiWaecAlignment.ts`,
`hasTopicLevelWaecEvidence` + the guard inside `validateAiWaecAlignment`),
not just in this document: an alignment assessment may only claim
`relationshipType: DIRECT` or a definite `depthRelation` (MEETS_BASELINE /
ABOVE_BASELINE / SIGNIFICANTLY_ABOVE_BASELINE / BELOW_BASELINE) when at
least one WAEC-authority evidence item is marked `TOPIC_LEVEL`. Without
that, the assessment must fall back to `relationshipType: SUPPORTING` (or
PARTIAL/PREREQUISITE/ENRICHMENT/UNKNOWN as appropriate) and
`depthRelation: UNKNOWN` (or NOT_COMPARABLE). This is enforced by a new
required field on the evidence contract, `evidenceSpecificity: "TOPIC_LEVEL"
| "SUBJECT_LEVEL"` — no Prisma schema change was needed, since this is a
library-level TS contract, not a database column, and no real
`CurriculumBaselineAlignment` row has been seeded to production or staging
yet. See `__tests__/p2c/real-data-pilot.test.ts`, describe block "P2-C
evidence-specificity guard," for the enforced positive and negative cases,
and `__tests__/p2c/ai-authority-and-review.test.ts`, which had the same
over-claiming pattern in its original fixture (no WAEC-authority evidence
item at all, yet a DIRECT/MEETS_BASELINE claim) and has been corrected the
same way.

The Math pilot's real, corrected result: the WAEC-baseline layer for
"Two-Set Problems" is honestly `PARTIAL` coverage / `UNKNOWN` depth (not
`COMPLETE_AT_BASELINE`), pending either a real topic-level WAEC syllabus
document or a platform decision to accept subject-level distillation
evidence as sufficient for a lower-confidence `SUPPORTING` classification
(the current, corrected state) rather than a `DIRECT` one.

## Purpose and philosophy

This document records what LiberiaLearn can currently assert, with evidence,
about the Liberia examination landscape and the Liberia MOE curriculum, and
what it cannot yet assert. It exists to ground the P2-C data model
(`lib/curriculum/benchmarking/`, `prisma/schema.prisma` P2-C models) in real
sources rather than assumption.

Operating philosophy, restated from the founder decision that opened P2-C:
WAEC is a minimum external examination baseline, not the curriculum
authority and not the ceiling. Liberia MOE remains canonical. LiberiaLearn's
own mastery target is expected to sit above the WAEC baseline, with a
separate extension layer above that.

LiberiaLearn has **no formal relationship with WAEC**
(`WAEC_APPROVED = false`). Nothing in this document should be read as, or
used to construct, a claim of partnership, endorsement, licensing, or
official review authority. All alignment produced from this evidence is
`AI_ASSESSED_ALIGNMENT`, not `WAEC_APPROVED`, per
`lib/curriculum/benchmarking/aiWaecAlignment.ts`.

## Recovery pass note (2026-08-17)

An earlier pass this session incorrectly treated one WebFetch tool's HTTP 403
on `waecliberia.org.lr` and a non-content WebFetch render of
`moe.gov.lr/curriculum-download/` as a blocker. It was not: a real browser
session (Chrome, via the `claude-in-chrome` tool) reached every page that the
headless WebFetch tool was blocked from, and direct `curl` retrieval of the
MOE-hosted curriculum archives succeeded outright. This section replaces the
earlier "what cannot be asserted" list with real, first-party content. The
lesson: a single fetch path failing is evidence about that path, not about
the source's availability — see Phase 1 of the task that drove this pass.

## Evidence classification

Every claim below is tagged:

- **VERIFIED_FIRST_PARTY** — read directly from the official MOE (`.gov.lr`)
  or WAEC Liberia (`.org.lr`) site or an official MOE-hosted document this
  session.
- **VERIFIED_CORROBORATED** — supported by a non-authoritative but credible
  secondary source (regional WASSCE reference material, Liberia-specific
  news coverage, an NGO program-evaluation source), used only to corroborate
  or fill a gap, never as the canonical record where a first-party source
  exists.
- **UNVERIFIED** — reported somewhere but not confirmed against a first- or
  credible secondary source this session.
- **HISTORICAL** — first-party, but explicitly dated or superseded evidence
  (a legacy page, an old candidature count) rather than current state.
- **CONFLICTING_TERMINOLOGY** — first-party sources disagree or do not fully
  reconcile; both readings are preserved rather than one being silently
  chosen.

Only `moe.gov.lr` / `www.moe.gov.lr` (`.gov.lr`) and `waecliberia.org.lr` /
`www.waecliberia.org.lr` (`.org.lr`) are treated as authoritative hosts for
competency-level claims, matching `AUTHORITATIVE_HOSTS` in
`lib/curriculum/benchmarking/aiWaecAlignment.ts`. That set required no
change after this pass — see "Architecture validation" below.

## Retrieval method actually used

Headless `WebFetch` alone was insufficient: `waecliberia.org.lr` returned
HTTP 403 to it on every path tried, and the plain-HTML render of
`moe.gov.lr/curriculum-download/` did not surface the document links inside
its 8KB scan window. Two working paths were used instead, both legitimate,
official-domain retrieval:

1. **Real browser session** (`claude-in-chrome`) — navigated to
   `waecliberia.org.lr` pages directly; the live site rendered normally and
   the accessibility tree (`read_page`) exposed the actual `EXAMINATIONS`
   navigation menu and its hrefs, which is how the current page set
   (`/examination/`, `/ljhsce/`, `/lshsceregular/`, `/lshsceprivate/`) was
   discovered. The same session confirmed `www.waecliberia.org.lr/wassce.html`
   (the URL used by an earlier pass) is a dead legacy path — the live site
   returns "Page not found" for it — see the terminology section below.
2. **Direct `curl` of MOE-hosted files** — the `moe.gov.lr/curriculum-download/`
   page's own link targets, read via the browser's accessibility tree, are
   plain `http://www.moe.gov.lr/wp-content/uploads/...` ZIP files with no
   auth. `curl` retrieved all three (`GRADE-1-6.zip`, `GRADE-7-9.zip`,
   `Grade-10-12.zip`), each returning HTTP 200. `unzip` + `pdftotext -layout`
   extracted per-subject PDF curricula from each archive.

Neither path involved bypassing authentication, a paywall, or bot-detection
in a way that violates site terms — the MOE ZIPs are unauthenticated public
downloads linked from the ministry's own curriculum page, and the WAEC pages
are public marketing/regulation pages, not gated content.

## Confirmed: current Liberia examination landscape

| Exam | Grade | Administered by | Current official subjects (VERIFIED_FIRST_PARTY) |
|---|---|---|---|
| LPSCE — Liberia Primary School Certificate Examination | 6 | WAEC Liberia | Mathematics (310), General Science (320), Language Arts (330), Social Studies (340) — `waecliberia.org.lr/examination/` |
| LJHSCE — Liberia Junior High School Certificate Examination | 9 | WAEC Liberia | Mathematics (210), General Science (220), Language Arts (230), Social Studies (240) — `waecliberia.org.lr/ljhsce/` |
| LSHSCE (Regular) — Liberia Senior High School Certificate Examination | 12 | WAEC Liberia | Core: English Language (101), Mathematics (301); General: Economics (201), Geography (202), History (203), Literature-in-English (204); Science: Biology (401), Chemistry (402), Physics (403) — `waecliberia.org.lr/lshsceregular/` |
| LSHSCE (Private) | 12 | WAEC Liberia | Same subject universe as LSHSCE Regular; explicitly states its "detailed syllabuses... are a distillation of the Ministry's Curriculum" — `waecliberia.org.lr/lshsceprivate/` (VERIFIED_FIRST_PARTY quote) |
| LNAT — Liberia National Assessment Test | 3 | See LNAT section below | Not a WAEC-administered certificate exam — see below |

Grading (VERIFIED_FIRST_PARTY, `waecliberia.org.lr/examination/`,
`/ljhsce/`, `/lshsceregular/`):

- **LPSCE / LJHSCE:** 60% minimum passing mark per subject; final grade =
  40% Continuous Assessment Score (CASS, school-set) + 60% Terminal
  Assessment Score (TASS, WAEC-set); pass required in at least 3 of the 4
  subjects.
- **LSHSCE:** stanine 1-9 scale (1=Excellent, 2=Very Good, 3=Good, 4-6=Credit,
  7-8=Pass, 9=Fail); final grade = 30% CASS + 70% TASS; candidates enter 8-9
  subjects from the three groups, must pass at least 6 including both core
  subjects, and are placed in Division I/II/III by aggregate of best six
  subjects (Division I: aggregate <=24 plus credit in Math and English;
  Division II: 25-36; Division III: 37-48 with a 7/8 in Math and English).

2026 calendar (VERIFIED_CORROBORATED, Liberia-specific 2026 news coverage,
consistent with the exam structure above): LJHSCE April 20-21; LNAT April
22; LPSCE April 23-24; WASSCE/LSHSCE academic subjects from June 1 (Booker
Washington Institute vocational/trade candidates sit earlier).

## LNAT classification

Per the task's explicit instruction: treat LNAT separately and do not group
it with the WAEC certificate exams merely because news coverage places them
in the same calendar.

- **VERIFIED_FIRST_PARTY (negative evidence):** the live WAEC Liberia site's
  own `EXAMINATIONS` navigation menu (inspected directly via the
  accessibility tree of `waecliberia.org.lr`) lists exactly four items —
  LPSCE, LJHSCE, LSHSCE (Regular), LSHSCE (Private) — and no LNAT item. WAEC
  Liberia's own official examination pages have identical BACKGROUND /
  ENTRY REQUIREMENT / CANDIDATURE / GRADING / RESULT-CERTIFICATE structure
  for all four exams; there is no fifth page of that shape for LNAT.
- **VERIFIED_CORROBORATED:** Innovations for Poverty Action (IPA), a
  development-partner organization that worked directly with Liberia's MOE,
  describes LNAT as the product of "Liberia's first National Learning
  Assessment System (Policy and Framework)," MOE-developed with IPA, a
  written assessment "group-administered in Grade 3," held "directly on the
  students' respective school campuses, unlike other national examinations"
  (`poverty-action.org`). This explicitly distinguishes LNAT's
  administration model from the WAEC-administered exams.
- **CONFLICTING_TERMINOLOGY / UNVERIFIED:** at least one commentary source
  (FrontPageAfrica) refers to LNAT loosely as a WAEC-administered exam
  alongside LJHSCE/LPSCE/WASSCE, without WAEC's own site corroborating that.
- **Classification:** LNAT is treated as an **MOE learning-assessment
  instrument, not a WAEC certificate examination**, based on the first-party
  negative evidence (absence from WAEC's own live examination navigation)
  plus the IPA source's explicit MOE/IPA attribution. Per the task's
  fallback rule, it is **excluded from canonical WAEC baseline seeding**.
  It may still be modeled later as an MOE-only assessment instrument if
  P2-C or a future sprint needs that, but that is out of scope here.

## Examination terminology reconciliation

The task instructed: do not prematurely collapse LSHSCE / WASSCE / WAEC exam
into one permanent label; preserve conflict if evidence conflicts.

- **VERIFIED_FIRST_PARTY:** the live WAEC Liberia site currently organizes
  its Grade-12 exam exclusively under the label **LSHSCE** (Regular and
  Private candidature pages), administered by WAEC after "due registration
  with the West African Examinations Council."
- **CONFLICTING_TERMINOLOGY:** an older page at
  `www.waecliberia.org.lr/wassce.html` — the URL an earlier research pass
  cited as authoritative — now returns "Page not found" on the live site
  (confirmed by direct navigation this session). Liberia-specific news
  coverage and the regional WASSCE reference material both continue to use
  **WASSCE** for the same Grade-12 exam. WAEC Liberia's own site title for
  the exam is "the liberia senior high school certificate examination
  (lshsce)" — it presents LSHSCE as the Liberia-specific name for what is,
  regionally, the West African Senior School Certificate Examination.
- **Resolution recorded, not silently chosen:** this document treats
  **LSHSCE as WAEC Liberia's current, live, first-party label** for the
  Grade-12 exam, and **WASSCE as the regional/common name for the same
  underlying exam**, evidenced by the fact that no other Grade-12 WAEC exam
  exists in Liberia's structure and the old dedicated `wassce.html` page
  was retired rather than replaced with different content. This is not
  treated as fully proven identity (no first-party WAEC Liberia page
  currently states "LSHSCE is also called WASSCE" in those words), so
  `CurriculumAuthoritySource.exam` values should record both labels as
  aliases of one framework rather than merging them into a single string
  that discards the distinction, if/when real seeding happens.
- A second **material structural discrepancy** was found and is preserved,
  not resolved by evidence alone: WAEC Liberia's own LSHSCE(Regular) page
  describes a **two-core-subject** structure (English Language,
  Mathematics) with General and Science subject groups and a **stanine
  1-9** grading scale, which differs from the regional WASSCE reference
  material's description of a **four-core-subject** structure (English,
  Mathematics, Civic Education, plus a fourth core) with an **A1-F9**
  grading scale. Both are recorded; the first-party Liberia-specific page
  (stanine, two core subjects) is treated as authoritative for Liberia's
  actual LSHSCE administration, and the A1-F9/four-core description is
  treated as describing the broader regional WASSCE pattern that may not
  apply identically in Liberia. No source found this session (or the
  P2-C Subject Expansion pass below) reconciles these explicitly at the
  structural level.

### Reclassification (P2-C Subject Expansion pass, 2026-08-17)

The founder's own first-party findings for this pass state the operative
decision explicitly, and this document adopts it: the above discrepancy is
**not** treated as an open current-baseline conflict going forward. LPSCE,
LJHSCE, and LSHSCE (Regular) are the current verified Liberia baselines for
Grades 6, 9, and 12 respectively; LSHSCE-Private is the current verified
private-candidate framework. WASSCE regional rules (four-core, A1-F9) are
**not** substituted for Liberia's own first-party LSHSCE rules (two-core,
stanine) under any circumstance, regardless of WASSCE's currency elsewhere
in the WAEC ecosystem.

The prior label for this discrepancy, `CONFLICTING_TERMINOLOGY`, is
superseded by **`REGIONAL_FRAMEWORK_NOT_APPLICABLE_TO_CURRENT_VERIFIED_LIBERIA_BASELINE`**.
This is a decision about which framework governs LiberiaLearn's baseline
calculations, not a retroactive claim that the structural discrepancy was
somehow resolved by new evidence -- it was not; the two-core/stanine vs.
four-core/A1-F9 difference above is preserved verbatim, unedited, exactly
as originally found. WASSCE is recorded only as an `examAliases` entry
(`["WASSCE"]`) on the seeded `WAEC.LIBERIA.LSHSCE.REGULAR` baseline
framework row (`scripts/p2c-staging-exam-framework-seed.ts`) -- a name
pointer only, not a second, competing framework row that could participate
in baseline calculations. No dedicated WASSCE `CurriculumAuthoritySource`
row was created: the only WASSCE-specific Liberia URL previously on record
(`wassce.html`) still 404s, and fabricating a fresh citation for a source
never actually re-verified this session would violate this program's own
evidence-honesty rule. If a future session finds a live, current,
Liberia-specific WASSCE source, it should be registered as
`REGIONAL_WAEC_REFERENCE` (still not participating in baseline
calculations) or, if it explicitly establishes an identity claim with
LSHSCE, used to promote this reclassification with real evidence rather
than decision alone.

One piece of real corroborating (not dispositive) evidence surfaced this
pass: the Grade 10-12 Geography curriculum PDF's own materials list cites
"WASSCE Q&A (Papers 1&2)" as a student study aid (`GEOGRAPHY 10-12.pdf`,
p.48 region, MOE archive, see Subject Expansion evidence below) --
first-party MOE material treating WASSCE-branded resources as ordinary
regional reference/practice material circulating alongside the Liberia
curriculum, not as a second governing exam authority. This is consistent
with, but does not by itself prove, the founder's classification.

### Live re-verification of LPSCE and LSHSCE(Regular), 2026-08-17

The subject/code/CASS-TASS/grading/entry/certificate details below were
independently re-derived this pass via a real browser session against
`waecliberia.org.lr` (not reused from memory or this document's earlier
pass), before being seeded to staging. They match the earlier pass's
findings and the founder's brief for this sprint exactly, with the
Division I/II/III aggregate bands (already present above) additionally
confirmed live rather than assumed.

- **LPSCE** (`https://waecliberia.org.lr/examination/`): Mathematics 310,
  General Science 320, Language Arts 330, Social Studies 340; all four
  compulsory; CASS 40% / TASS 60%; 60% minimum pass per subject; certificate
  requires passing at least 3 of 4 subjects.
- **LSHSCE (Regular)** (`https://waecliberia.org.lr/lshsceregular/`): Core
  -- English Language 101, Mathematics 301 (compulsory); General --
  Economics 201, Geography 202, History 203, Literature-in-English 204;
  Science -- Biology 401, Chemistry 402, Physics 403; entry 8-9 subjects;
  stanine 1-9 grading (1 Excellent, 2 Very Good, 3 Good, 4-6 Credit, 7-8
  Pass, 9 Fail); CASS 30% / TASS 70%; certificate requires passing at
  least 6 subjects including both Core subjects, at least one General
  subject, and at least one Science subject; Division I (aggregate <=24,
  credit in Math+English), Division II (25-36, credit), Division III
  (37-48, grade 7/8 in Math+English).

Both pages' captured-render SHA-256 hashes and the seed script that
consumes them are recorded in `docs/research/P2C_EVIDENCE_MANIFEST.md`.

## Real MOE curriculum content recovered

Retrieved directly from `moe.gov.lr/curriculum-download/` (link targets
read from the live page's accessibility tree, then `curl`-fetched):

| Grade band | Archive (VERIFIED_FIRST_PARTY URL) | Subject PDFs inside |
|---|---|---|
| 1-6 | `http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip` | English 1-6, French, General Science 1-6, **Math 1-6**, Physical Education 1-6, Religious & Moral Education 1-6, Social Studies Grade 1-6 |
| 7-9 | `http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip` | English 7-9, French, General Science 7-9, **Math 7-9**, Physical Education, Religious & Moral Education, Social Studies 7-9 |
| 10-12 | `http://www.moe.gov.lr/wp-content/uploads/2019/09/Grade-10-12.zip` | biology, Chemistry, Economics, ENGLISH GRAMMAR, French, GEOGRAPHY, History, LITERATURE, **Maths**, Physical Education, Physics (all 10-12) |

The Grade 10-12 subject set (Biology, Chemistry, Economics, English,
Geography, History, Literature, Maths, Physics) matches the LSHSCE(Regular)
subject groups almost exactly, which is direct corroboration of WAEC
Liberia's own statement that its syllabus is a distillation of this
curriculum. Two distinct dates were captured for these archives (full detail
and hashes in `docs/research/P2C_EVIDENCE_MANIFEST.md`): the HTTP
`Last-Modified` header on all three ZIPs is **2026-07-29** (a recent
server-side re-upload/re-serve), while the internal per-file timestamps
inside each ZIP are **2020-07** (when the PDFs were themselves last saved).
No official MOE statement was found asserting either "this is the current
curriculum" or "a newer edition exists." Classification:
**CURRENTLY_VERIFIED_OFFICIAL_EDITION** — the edition actually served by
`moe.gov.lr` as of this retrieval, with content dated 2020-07 — **not**
`CURRENT_LATEST_EDITION`, since that would claim knowledge of whether a
newer edition exists, which this session does not have.

### Math pilot: real objectives extracted

**Grade 9 Mathematics** (`Math 7-9.pdf`, extracted via `pdftotext -layout`),
Semester One, Period I, **Topic: TWO-SET PROBLEMS**, page 37 of the source
PDF:

> "Learners are able to apply the concepts of sets to solve simple two-set
> problems using Venn diagrams, find the complement of a set and represent
> it on the Venn diagram, and determine the number of subsets of a set and
> determine [the] rule for finding the number of subsets of a set."
> (paraphrased line-wrap; the source objective column reads: "Draw and use
> Venn diagrams to solve simple two-set problems" / "Find and write the
> number of subsets in a set with up to 5 elements" / "Find the rule of the
> number of subsets in a set")

Grade 9 also covers (same PDF): Arithmetic, Basic Algebra, Simultaneous
Equations, Geometry (parallel/perpendicular lines, regular polygons,
triangle construction SSS/SAS/ASA, similar triangles), Trigonometry and
Measurement (Pythagorean theorem, sine/cosine/tangent), Probability and
Statistics (frequency tables, histograms, central tendency, permutations
and combinations), and Vector Addition.

**Grade 12 Mathematics** (`Maths 10-12.pdf`), Semester Two, **Topic:
DIFFERENTIATION AND INTEGRATION**, pages 67-68 of the source PDF:

> "Learners are able to apply concepts to find the limits of simple
> polynomial and trigonometric functions, find the derivatives of simple
> algebraic and trigonometric functions. They are able to find the area
> under a curve and the indefinite integrals of simple polynomial and
> trigonometric functions." Objectives include defining/discussing the
> difference quotient, limits, differentiation (first principle and rules),
> and integration (definite area/summation concept, indefinite integrals).

Grade 12 also covers (same PDF): Numbers and Numeration (real numbers,
bases, modular arithmetic, identities, powers/roots), Sets and Logic
(explicitly including "solve two sets and three sets problems using Venn
diagram"), Relations/Functions/Mappings/Ratio/Proportion/Variation, Vector
and Trigonometry, Transformations, Plane Geometry, Probability and
Statistics (including standard deviation, linear/quadratic graph
interpretation), and the Differentiation/Integration unit above.

**Grade 3 Mathematics** (`Math 1-6.pdf`), Semester One, Period I, Unit I,
**Topic: REVIEW OF OPERATIONS**, page 22: "Add one and two digit numerals,"
"Subtract two digit numerals using regrouping," name parts of a whole
(fractions), identify `>`, `<`, `=`. Used below as the NOT_APPLICABLE
example (Grade 3 predates WAEC's earliest exam, LPSCE, at Grade 6).

## What LiberiaLearn's own content actually covers (real gap check)

Queried the live `CurriculumContent` table directly (read-only, via Prisma,
`subject: MATH`) rather than assuming:

- **Grade 9 MATH: 3 total rows** — "Ratios in Market Prices," "Understanding
  and Applying Quadratic Equations in Real Life," "Maximizing Garden Yield
  with Quadratic Equations." **None cover sets, Venn diagrams, or
  two-set problems** — the real MOE Grade 9 objective above has no matching
  titled LiberiaLearn lesson.
- **Grade 12 MATH: 16 total rows**, all generic unit names ("Problem Solving
  and Review: Assessment and Reflection" x11, "Patterns, Algebra, and
  Functions: Assessment and Reflection" x2, similarly-templated "Guided
  Application" variants) with no title referencing differentiation,
  integration, calculus, or limits. **The real MOE Grade 12
  Differentiation-and-Integration objective has no matching titled
  LiberiaLearn lesson.**

This check was title-only (lesson bodies were not opened), so it should be
read as "no titled lesson found," not "proven absent from every lesson
body." It is nonetheless a real, evidence-based finding, not a manufactured
one: LiberiaLearn's Grade 9/12 Math footprint is thin (3 and 16 rows
respectively) and neither pilot topic surfaced.

## Above-baseline candidate (with appropriate hedging)

WAEC Liberia's own LSHSCE(Regular) page (VERIFIED_FIRST_PARTY) enumerates
**the complete current subject universe** a Liberia LSHSCE candidate can
register for: English, Mathematics (core); Economics, Geography, History,
Literature-in-English (general); Biology, Chemistry, Physics (science).
There is no "Further Mathematics" or other calculus-focused subject in that
list. MOE's own Grade 12 Mathematics curriculum, by contrast, includes a
full Differentiation-and-Integration unit (VERIFIED_FIRST_PARTY, above).
This supports treating Grade-12 calculus content as a genuine
**above-baseline** candidate: MOE teaches it, but no separate WAEC-Liberia
subject exists to examine it independently of the single compulsory
Mathematics (301) paper. This does **not** prove the compulsory Mathematics
(301) paper itself never touches introductory calculus — no topic-by-topic
WAEC Mathematics syllabus document was found this session, only the subject
list. The "core WASSCE mathematics typically excludes calculus" pattern is
**VERIFIED_CORROBORATED** only (regional WASSCE reference material), not
first-party for Liberia's specific paper content.

## Architecture validation against real data

Per the task's instruction 9 ("real data should validate the architecture;
report the smallest required change; do not redesign preemptively"):

- `AUTHORITATIVE_HOSTS` in `lib/curriculum/benchmarking/aiWaecAlignment.ts`
  (`moe.gov.lr`, `www.moe.gov.lr`, `waecliberia.org.lr`,
  `www.waecliberia.org.lr`, `waec.org`, `www.waecliberia.org`... — see that
  file) already covers every real evidence URL used in this pass. **No
  change required.**
- The MOE-objective structure (grade, subject, domain/topic, authoritative
  wording, evidence locator) maps cleanly onto the real PDF structure
  (Grade -> Semester/Period -> Topic -> Outcomes/Objectives/Content), which
  is exactly the `Grade -> Subject -> Domain/Strand -> Topic/Unit ->
  Objective/Standard` hierarchy the P2-C brief specified. **No change
  required.**
- The `CoverageDegree`/`DepthRelation` vocabulary and the gap engine's
  refusal to infer `COMPLETE` from title similarity held up: the real
  LiberiaLearn-content check above is a legitimate `PARTIAL`/gap finding by
  content-absence, not a forced one.
- One real nuance the schema does not yet capture: an **exam-alias**
  concept (LSHSCE / WASSCE as two names for what may be the same
  underlying framework, per the terminology section above).
  `AssessmentBaselineFramework.exam` is currently a single `String` field.
  This is a **smallest-required-change candidate**, not yet made: consider
  an optional `examAliases: String[]` on `AssessmentBaselineFramework`
  (additive, nullable-default-empty) so both labels can be recorded without
  merging them. Not implemented this pass, since no real
  `AssessmentBaselineFramework` row has been seeded yet and the fixtures
  below work fine with a single canonical `exam: "LSHSCE"` value plus a note
  — this is a recommendation for whoever performs the actual staging seed,
  not a blocking finding.
- The one real, non-schema change this pass required: an
  `evidenceSpecificity: "TOPIC_LEVEL" | "SUBJECT_LEVEL"` field on the
  `AlignmentEvidence` TS contract in `aiWaecAlignment.ts`, plus a guard in
  `validateAiWaecAlignment` that rejects a `DIRECT` relationship or a
  definite depth relation when no WAEC-authority evidence item is
  `TOPIC_LEVEL`. This is a library-level TypeScript contract change, not a
  Prisma schema/migration change — see the "Evidence-semantics correction"
  section at the top of this document.

## What remains genuinely unverified

- No topic-by-topic WAEC Mathematics (210/301) syllabus/exam-specification
  document was found (only the subject list, grading rules, and WAEC
  Liberia's own statement that its syllabus distills the MOE curriculum).
  If WAEC Liberia publishes one, it was not discoverable via search
  indexing or the live site's navigation this session.
  `OFFICIAL_SOURCE_DISCOVERED_CONTENT_UNAVAILABLE` applies here, not
  `SOURCE_MISSING`: the official page (`lshsceregular/`,
  `lshsceprivate/`) exists, advertises being governed by "detailed
  syllabuses," but does not itself publish or link that document.
- Whether a newer (post-2020) revision of the MOE curriculum PDFs exists is
  unverified; PDF content is dated 2020-07, though the server re-served the
  archives on 2026-07-29 (see `P2C_EVIDENCE_MANIFEST.md`'s edition
  classification — recorded as CURRENTLY_VERIFIED_OFFICIAL_EDITION, not
  CURRENT_LATEST_EDITION).
- The 39-new-subjects-for-2026 WASSCE expansion claim (from `moeliberia.com`,
  a non-government `.com` news domain, not `moe.gov.lr`) remains
  unverified against a `.gov.lr` or `.org.lr` source.
- Whether `liberiawaec.org` (a separate, DNS-unreachable-this-session
  domain) is an official mirror, a licensed partner, or unrelated remains
  unknown.

## Sources consulted

VERIFIED_FIRST_PARTY:
- [LPSCE — waecliberia.org.lr/examination/](https://waecliberia.org.lr/examination/)
- [LJHSCE — waecliberia.org.lr/ljhsce/](https://waecliberia.org.lr/ljhsce/)
- [LSHSCE (Regular) — waecliberia.org.lr/lshsceregular/](https://waecliberia.org.lr/lshsceregular/)
- [LSHSCE (Private) — waecliberia.org.lr/lshsceprivate/](https://waecliberia.org.lr/lshsceprivate/)
- [WAEC Liberia homepage — waecliberia.org.lr](https://waecliberia.org.lr/) (live `EXAMINATIONS` navigation inspected directly)
- [MOE Curriculum Download — moe.gov.lr/curriculum-download/](https://moe.gov.lr/curriculum-download/)
- MOE curriculum archives: `GRADE-1-6.zip`, `GRADE-7-9.zip`, `Grade-10-12.zip` (URLs in the table above), specifically `Math 1-6.pdf`, `Math 7-9.pdf`, `Maths 10-12.pdf`

VERIFIED_CORROBORATED:
- [WAEC Liberia Announces 2026 National Examination Dates — The New Dawn Liberia](https://www.thenewdawnliberia.com/waec-liberia-announces-2026-national-examination-dates/)
- [Closing the Learning Gap: Building Liberia's First National Primary Learning Assessment System — IPA](https://poverty-action.org/closing-learning-gap-building-liberias-first-national-primary-learning-assessment-system)
- [West African Senior School Certificate Examination — Wikipedia](https://en.wikipedia.org/wiki/West_African_Senior_School_Certificate_Examination) (regional pattern only, not Liberia-specific authority)

UNVERIFIED / discovery-only, not used as canonical:
- [WAEC Liberia Releases 2025 Exam Results, Introduces New Subjects for 2026 — moeliberia.com](https://www.moeliberia.com/waec-liberia-releases-2025-exam-results-introduces-new-subjects-for-2026/) (`.com`, not the government `moe.gov.lr` domain despite the similar name)
- `liberiawaec.org` (alternate domain, unreachable this session, authority status unverified)
