# Academic Records & Promotion V2

Status: **audit + pure domain foundation + small safe fixes.** No migration, no production data
change, nothing activated. The new modules are not yet wired into routes.

Code: `lib/academic-records/v2/`, `components/records/OfficialReportCard.tsx` ·
Tests: `__tests__/academic-records-v2/`, plus updated `__tests__/academics/promotion.test.ts` and
`__tests__/sprint3.reportcards.test.ts` · Companion: `docs/architecture/assessment/ASSESSMENT_ARCHITECTURE_V2.md`
(on `feat/assessment-architecture-v2`), which defines the assessment evidence these records consume.

---

## 1. Phase 1 audit — current implementation (main @ `a1508cea`)

| Area | Implemented | Finding | Severity | Action here |
| --- | --- | --- | --- | --- |
| AcademicYear / Term (`prisma/schema.prisma`, `lib/records/systemOfRecord.ts`) | School-scoped years, one active year, named terms with dates | Terms carry no "issues report" flag, no closeout, no lock; nothing assumes four quarters (good) | P2 | V2 `AcademicCalendar` + `calendarFromAcademicYear` adapter |
| Report-card generation (`lib/reportCards/generateReportCard.ts`) | Per-term card from submissions, `Grade` rows, attendance | **Term looked up by id only**: a term of another school's year produced a card under the student's school. **Class lookup unscoped.** | P1 | **Fixed**: term's academic year and class must belong to the student's school (409 otherwise) |
| — same — | | **Missing evidence shown as zero**: no submissions → `average: 0` → "0% F"; no attendance → `rate: 0` | P1 | **Fixed**: `null`, rendered "—" / "Not recorded" on student, guardian and print pages |
| — same — | | **Incompatible combination**: raw integer scores averaged regardless of each assignment's maximum; exam `Grade` rows averaged across all time (not term-scoped); submissions not filtered by class or school; EXCUSED counted as ABSENT; letter grade from hard-coded 90/80/70/60 bands in three UI files; a "Mastery" column inside the grade table | P1 | EXCUSED now reported separately. The rest is **replaced, not patched**, by the V2 calculator and record (legacy left for compatibility) |
| Report-card editing (`app/api/report-cards/[id]/comment/route.ts`) | Teacher/admin comments; principal comment admin-only | **Published cards could be edited** without amendment | P1 | **Fixed**: 409 "request an amendment" |
| Publication (`[id]/publish`, `publish-all`) | Conditional-claim publish (no double notifications) | `publish-all` publishes every DRAFT of a class/term with no teacher verification or period lock | P1 | Documented; V2 `publishReportCard` requires LOCKED periods. Route unchanged (activation decision) |
| Uniqueness | `ReportCard @@unique([studentId, termId])` | A student in several classes gets one card whose `classId` flips to the last class generated | P2 | V2 record is per student × period with per-subject class ids |
| Guardian / student access (`app/api/guardian/report-cards`, `app/api/student/report-cards`, `app/api/report-cards/[id]`) | Student: own PUBLISHED; guardian: linked + PUBLISHED; teacher/admin: same school | Teachers can read every card in the school, not only their classes | P2 | V2 `canViewReportCard` limits teachers to their classes |
| Transcripts (`upsertTranscriptForSchool`) | School-scoped upsert of grade/GPA/summary JSON | Overwrites freely; no versioning or amendment trail | P2 | Documented; same amendment model should apply (stage 4) |
| Promotion (`lib/academics/promotion.ts`, `/api/admin/promotions/*`) | Admin-selected students promoted/retained/graduated; per-student transaction; audit | **No academic eligibility evaluation** — any listed student is promoted. Target year **not checked to belong to the same school** or to start after the source year | P1 | **Fixed**: target year must be same school, different, and later. Eligibility: V2 evaluator (not yet gating the route) |
| — same — | | **Retention recorded as COMPLETED**, so repeated-grade history was indistinguishable from completion | P1 | **Fixed**: source enrollment marked `RETAINED` |
| — same — | | Graduation checks only grade = 12, no requirements | P1 | V2 evaluator requires every graduation requirement known and met; otherwise PENDING_REVIEW |
| Enrollment transitions (`lib/records/promotion.ts`) | `canTransitionEnrollmentStatus` | ACTIVE → any status; PROMOTED → GRADUATED allowed | P2 | Documented; V2 plans transitions from decisions only |
| Idempotency | `AcademicEnrollment @@unique([studentId, schoolId, academicYearId])` prevents duplicate year rows | Re-running a promotion is safe at the DB level; no decision identity | — | V2 transition plans carry an idempotency key derived from the decision version |
| AI grading (`lib/ai/staleGradeReleaser.ts`, cron `/api/cron/release-stale-grades`) | After 72 h, `aiGrade` is copied into the official `score` with no teacher approval | **AI independently sets an official grade** | **P0 policy** | Not changed (product decision). V2 classifies these as `AI_AUTO_RELEASED` and excludes them from official grades |
| SLM / mastery (`lib/learning-state`) | Admitted governed evidence → concept mastery | Not connected to records (correct) | — | Report records show mastery only from `MASTERY_ADMITTED_EVIDENCE`, labelled separately |
| Audit (`lib/audit.ts`) | `logAudit` on generate/publish/comment/promote | — | — | V2 returns `RecordsAuditEvent`s for every transition |

## 2. Academic periods and official grades

- **Calendar** (`calendar.ts`): any number of named reporting periods. Validation checks that
  they are ordered, do not overlap and fall inside the year, that at least one issues a report,
  and that closeout dates are after the last period. Tests use two semesters and six marking
  periods; nothing assumes four quarters.
- **Grading policy** (`gradingPolicy.ts`): versioned and hashed, and a policy can be `DRAFT`,
  `APPROVED` or `RETIRED`. It defines:
  - category weights, which must sum to 100;
  - points-weighted or equal weighting within a category;
  - what happens to an empty category (re-normalize the rest, or mark the grade incomplete);
  - missing work (`EXCLUDE_UNTIL_RESOLVED`, or `ZERO_WHEN_TEACHER_CONFIRMED`);
  - the late penalty, the descending scale with pass/fail bands, rounding, and the minimum number
    of scored entries.

  There is **no default policy**. A source marked `MOE_DIRECTIVE` needs a reference and a named
  attesting person; that records provenance and is not an MOE endorsement.
- **Calculation** (`gradeCalculation.ts`) follows these rules:
  - each entry is normalized against its own maximum;
  - entries from another student, school, class, subject or period are refused;
  - `EXEMPT` is excluded, not counted as zero;
  - `MISSING` is zero only if the policy allows it and a teacher confirmed it; otherwise it blocks
    the grade;
  - `INCOMPLETE` and `PENDING_MODERATION` block the grade;
  - `LATE` applies the policy penalty;
  - AI scores without teacher approval, and auto-released AI scores, are excluded and block the
    grade;
  - a subject with no evidence is `NO_EVIDENCE` with a null percent.

  The result is `COMPLETE`, `INCOMPLETE` (with blockers) or `NO_EVIDENCE`.
- **Lock** (`periodLock.ts`): the period moves OPEN → TEACHER_VERIFIED → LOCKED.
  - Only the assigned teacher can verify, and only when no result is incomplete.
  - A principal or admin of the same school locks the period.
  - If grades change after verification, the lock is refused until the teacher re-verifies.
  - Transitions are idempotent.
- **Mastery and grades** are separate fields (`ReportCardRecord.masteryIndicators`). Each
  indicator carries a fixed label, `SKILL_MASTERY_INDICATOR_NOT_A_GRADE`, and an evidence tier of
  `MASTERY_ADMITTED_EVIDENCE`.

## 3. Promotion and retention authority

- **Evaluator** (`promotion.ts`) is deterministic: the same input gives the same `inputDigest`. It
  returns PROMOTE, CONDITIONAL_PROMOTION, RETAIN, GRADUATE or PENDING_REVIEW, always with
  `requiresAuthorizedDecision: true`.
- It returns **PENDING_REVIEW** whenever any of these holds:
  - there is no policy, the policy is unapproved or invalid, or it belongs to another school;
  - the grade is not covered by the policy;
  - the enrollment is not active;
  - the records are not finalized;
  - a required subject is missing, incomplete or has no evidence;
  - attendance is required but missing;
  - a graduation requirement is unknown;
  - a terminal-grade student does not meet graduation requirements. That case goes to review, not
    to an automatic RETAIN.
- There is **no AI input** to the evaluator. `attachAdvisory` places an AI or teacher explanation
  beside a recommendation without changing it.
- **Decision** (`promotionDecision.ts`) must be made by a principal or admin of the same school.
  - Overriding the recommendation, or deciding a PENDING_REVIEW case, needs a written rationale.
  - CONDITIONAL_PROMOTION needs a remediation plan.
  - GRADUATE is only valid at the terminal grade, and nobody can be promoted past it.
- **Transition plan**: a pure description of the enrollment writes.
  - The target year must belong to the same school, be a different year, and start after the
    source year ends.
  - An existing target enrollment is a conflict.
  - Retention closes the source enrollment as `RETAINED` at the same grade.
  - Graduation creates no target enrollment.
  - The idempotency key is derived from the decision version, so re-applying the same decision is
    a no-op.
  - An open appeal blocks the transition.
  - Prior-year records are never rewritten.
- **Appeals**: an appeal must be filed within the window and give a reason. It is resolved by
  school leadership that includes someone other than the original decider. A revision creates
  decision version 2 that supersedes `@1`; the original stays in history.

## 4. Reporting experience

`buildReportCardView` + `OfficialReportCard` render one official record for teacher, admin,
student and guardian. Students and guardians can only view published records; drafts carry a
"DRAFT — NOT AN OFFICIAL RECORD" watermark.

The rendered report includes:

- subject grades with their category breakdown and weights;
- attendance, with excused absences shown separately, or "No attendance recorded";
- teacher comments;
- a separately titled section, **"Skill mastery (separate from grades)"**, which explains that it
  does not change the grades;
- strengths, areas for improvement and the support plan;
- the year-end decision and its status (pending school review, under appeal, or decided);
- the principal's comment;
- a footer with the record id, version and verification hash, plus an amendment notice when the
  record was amended.

Accessibility and printing:

- semantic headings and table captions;
- `scope="col"` and `scope="row"` on table headers;
- every status is stated in text, never shown by colour alone;
- print-friendly classes.

The component is server-renderable and tested by static rendering. It is not yet mounted on any
route.

Official records are immutable once published. `amendPublishedReportCard` produces a SUPERSEDED
prior record and a new version. The new version links to the prior content hash and records a
reason, the requester and a different approving leader. `publishReportCard` requires school
leadership, locked periods for every subject, no incomplete subjects, and a matching expected
version (optimistic concurrency, so two concurrent publishes cannot both succeed).

## 5. Tests

`__tests__/academic-records-v2` has 32 tests, and the updated legacy suites bring the total for
these areas to 75. They cover:

- calendars that are not quarter-based, and invalid structures;
- the AcademicYear/Term adapter;
- grading-policy validation, including the MOE provenance rule;
- the policy itself: required, approved, and from the same school;
- NO_EVIDENCE instead of 0;
- per-scale normalization against raw averaging;
- missing, exempt, late, incomplete and pending distinctions;
- exclusion of AI scores that no teacher approved, including auto-released ones;
- refusal of cross-school, cross-class, cross-subject and cross-period entries;
- verification and lock roles, including lock refusal after grades change;
- refusal of wrong-school, wrong-year, wrong-period, unenrolled-class and mixed-policy drafts;
- publish authority, lock requirement and concurrent-publish conflicts;
- amendments: an independent approver and preserved history;
- access isolation for students, guardians, teachers and other schools;
- attendance: excused shown separately, and no records is not 0%;
- accessible rendering, with mastery labelled separately;
- the promotion evaluator in every outcome, including PENDING_REVIEW for every uncertain input;
- AI advisories leaving the recommendation unchanged;
- decision authority, rationale and remediation rules;
- transition idempotency, refusal of cross-school or backwards years, RETAINED history, and
  graduation without a target year;
- the appeal window, independent reviewer, versioning and double-resolution refusal;
- the legacy fixes: report-card term and class from another school, null averages and rates,
  target-year checks in promotion, RETAINED status, and the 409 on editing a published card.

## 6. Staged implementation plan

1. **(this PR)** Audit, domain modules, and the safe fixes listed in §1.
2. **Persistence (additive, separately reviewed).** Add `GradingPolicyVersion`,
   `ReportingPeriod` (or extend `Term` with `issuesReport`/order), `ClassSubjectPeriodLock`,
   `GradeEntry` (or a view over existing submissions with explicit status), `ReportCardVersion`
   (append-only, `contentHash`, `priorVersionHash`), `PromotionDecision` and `PromotionAppeal`.
   Draft a runbook under `docs/ops/`, follow the advisor escalation contract, and do not apply
   anything to production.
3. **Teacher gradebook.** Teachers enter or confirm statuses (missing, exempt, late), see
   blockers, and verify their periods.
4. **Leadership.** Leaders lock periods and publish V2 records behind a flag. Legacy cards remain
   readable. Transcripts move to the amendment model.
5. **Year-end.** Run the evaluator from finalized records, then the decision UI, then transition
   plans applied in a single transaction, then appeals. Only after this should the current
   `/api/admin/promotions/*` routes require a recorded decision.
6. **Mastery indicators.** Fed by Assessment V2 admitted evidence through the SLM, once
   admission policies are approved.

## 7. Unresolved policy decisions (owners required)

1. **The 72-hour AI grade auto-release.** Retire it, or keep it as unofficial feedback only? It
   currently writes the official `score`.
2. **Official grading policy per school.** Category weights, scale and pass mark, missing and late
   rules, minimum evidence. Is there an MOE directive to cite? None is assumed or claimed here.
3. **Reporting calendar per school.** The periods, which of them issue reports, and the closeout
   dates.
4. **Promotion policy per school or grade band.** Required subjects, failure thresholds for
   conditional promotion and retention, minimum attendance, and graduation requirements (for
   example the applicable WAEC/national examination). Whether repeated retention needs escalation.
5. **Whether `NO_EVIDENCE` subjects may appear on a published card.** For example a late
   transfer. Currently allowed and shown as "Not graded", never 0.
6. **The appeal window length and panel composition.**
7. **Whether `publish-all` should be retired** in favour of the lock-and-publish flow.
8. **Teacher read scope** for report cards: all of the school, or only the teacher's classes.
