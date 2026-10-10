# Learn discovery PR 2B ? final consumer contract

Base: `c24e79e159c34310304a1ae8a1529e4d21ee20ef`.
Branch: `feat/product-design-v2-learn-data`.
UI reference reviewed: `feat/product-design-v2-learn-ui` at
`73b31ea0d1cf61ca90bc424c5c7e2e20cc64bf14`, including
`docs/product-design-v2/LEARN_V2_PR2_EVIDENCE.md`.

## Canonical presentation seam

`GET /api/student/learn` requires STUDENT role and current own-school student context.
It returns `LearnDiscoveryReadModel` (`lib/student/learnDiscovery.server.ts`):

```ts
{
  schemaVersion: "learn-discovery/2",
  availability: "current" | "empty" | "unavailable",
  freshness: "current" | "unavailable",
  generatedAt: string,
  currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" },
  subjects: Array<{ subject: string, label: string }>,
  lessons: { availability, total, items },
  activeUnits: { availability, eligibility: "eligible" | "not_enrolled" | "unavailable", items },
  assignedWork: { availability, items },
  checks: { availability, total, items, reason? },
  resources: { availability, items, destinations, compiledBooks: "deferred" },
  subjectCompletion: [...],
  search: { availability: "deferred" },
  limits: { perSection: 100, linkedContent: 200, catalogBoundReached: boolean }
}
```

Section availability is `current`, `empty`, or `unavailable`. `empty` is a successful
current read of zero items. Disabled checks are explicitly unavailable, with a safe
reason, rather than claiming there are no checks. Missing/deleted/mismatched-school
student context returns an unavailable model. Anonymous/wrong-role requests retain
401/403. Read failures/deadlines return 503 and empty unavailable sections, without
internal error details. Responses are `private, no-store`; there is no stale cache.
A client-retained snapshot must become stale after a failed refresh and must never
replace an authorization denial. No field promises offline storage/sync/submission.

The governed next action remains a separate canonical request. This model does not
call it, copy ranking, make decisions, create sessions, compute mastery, or write
evidence. Empty discovery says nothing about no-plan semantics.

## Eight gaps

1. **CLOSED: lesson availability.** `/api/student/lessons` now returns explicit
   availability: `current` for genuine empty; `unavailable` on failure/deadline.
   The whole Learn display read has an 8-second response deadline; outstanding DB
   reads may finish, but never write or replace the unavailable response.
2. **CLOSED: authorized count.** Lesson `total` counts only the same final
   eligibility-approved candidates as the list. Counting scans DB batches of 100
   while retaining only the requested display page. The paged lessons API retains
   12 items/page; the Learn summary retains at most 100 lessons. No pre-filter count
   or arbitrary legacy text-length test is used: openable eligible legacy content
   follows the canonical detail policy, including native release eligibility.
3. **CLOSED: subjects.** Identifiers/labels derive only from current own-school
   enrollments, independently of schedules. Global content never creates a subject.
4. **CLOSED: checks.** Existing Exam records are projected to id/title/subject/status,
   state/locked/href and safe reason. Gates mirror exam start: session school, placed
   grade, PUBLISHED, not deleted, class enrollment and academic-year enrollment.
   Passed exams are unavailable for a new attempt, with null href. No questions,
   readiness, scores, standards, explanations, answer keys or recommendations are
   queried by discovery. The summary is capped at 100; its total describes that
   bounded summary. No assessment authority or start/submit semantics change.
5. **CLOSED with explicit resource defer.** The existing textbook hub's authorized
   curriculum readings (`lesson`, `unit_plan`, `term_plan`, `full_pack`) provide
   display summaries with `id`, `title`, `kind: "reading"`, `href`, availability,
   state and locked flag. Catalog scope is placed grade + enrolled subjects + shared
   detail eligibility. Textbooks is an explicitly known authorized destination.
   Compiled PDF books and inline Practice/Projects/Offline availability are deferred:
   the administrative compiler/device-local storage are not learner catalog authority.
   No new resource catalog or fabricated saved/synced state is introduced.
6. **CLOSED: unit availability.** Both Learn and `/api/student/units/active` distinguish
   empty eligible, not enrolled, and unavailable. The latter now returns
   `{ availability, eligibility, generatedAt, items }` instead of a bare array.
7. **CLOSED: server item states.** Openable lessons/readings/checks/units carry explicit
   `state: "open"`, `locked: false` and authorized hrefs. An audience-authorized
   standalone assignment whose linked lesson is denied may remain visible with
   `state: "unavailable"`, `locked: true`, null lesson/content/action href and
   `reason: "This activity is not available"`. `assignmentHref` still links to the
   authorized assignment list. Foreign/stale linked schedules are omitted.
   Completed checks have null href and a data-supported completion reason.
   Undiscoverable foreign/teacher/pending/rejected/revoked content is never turned
   into a restricted catalog teaser. No lock is inferred from raw governance fields.
   Existing unit-sequence prerequisite display locks remain existing presentation
   semantics; this PR adds no new unit unlock or educational authority.
8. **DEFERRED: search.** `/api/search` queries globally published lessons without learner eligibility
   gates, and the RAG query is retrieval; neither proves learner discovery parity. No
   authorized learner resource search seam was found. No search/index/RAG/vector/LLM
   infrastructure was added.

## Scope and deep links

Shared `learnerVisibilityWhere`, `learnerRowAllowed` and `learnerScopeAllows` enforce
platform non-teacher content or own-school school-wide/class-assigned content;
learner visibility/audience; ACTIVE versions; APPROVED lifecycle; approved native
learner projection. Published/APPROVED legacy status is also required. Teacher-only,
foreign-school, unenrolled class, inactive, pending, rejected and revoked content
never appears as openable.

Assignment audience reads fail closed on missing delegates, errors and malformed
metadata; direct audience lookup also fails closed. The existing assignment policy
and scoring/submission behavior remain canonical. Scheduled lesson detail applies
shared eligibility before starting progress. Unit loaders scope progress links to
own-school enrollments and verify supplied schedule ids against content/class.
The textbook hub's server loader uses the same eligibility.

Lesson/resource hrefs use `/student/lesson/{contentId}` and its curriculum API policy;
unit hrefs use `/student/units/{unitId}`; checks use `/student/exams/{examId}` and its
existing start gate. Navigation identifiers are URL encoded. At unchanged policy
state, LIST ELIGIBILITY <= DETAIL ELIGIBILITY. Revocation between discovery/open
must still deny the open, retaining the existing 404/403/410 semantics.

Units reflect eligible schedules within +/-7 days and include summaries from the
bounded catalog + linked work set, not a complete syllabus/recommendation.
Assignments/schedules/resources cap 100, linked content caps 200. Subject completion
is scheduled-work completion from the authorized window/linked assignments, never
mastery. No client school/class/user inputs provide authority.

## Exact integration instructions for Claude

1. Start convergence from UI head `73b31ea0d1cf61ca90bc424c5c7e2e20cc64bf14` and
   cherry-pick the PR 2B data commit reported in the handoff (or merge its branch
   into the convergence branch). Do not merge to main during this handoff.
2. Keep governed GET/POST rendering and identity/session semantics unchanged.
3. Replace separate discovery reads with `/api/student/learn` if desired. Consume
   each section's items/availability and unit eligibility explicitly. Do not infer
   policy states from absent href, raw status, grade or any governance field.
4. LessonCatalog can retain `/api/student/lessons`; its `availability: "current"`
   confirms empty results. Replace the old `studentId` confirmation heuristic with
   availability. `count` is returned page length; `total` is final eligible count.
5. Any retained `/api/student/units/active` consumer must validate the envelope and
   consume `.items`; the old bare-array validator must be updated. Use not_enrolled
   separately from a confirmed empty weekly unit list.
6. Render checks/resources summaries only from these safe projections. Unavailable
   item actions have null href and explicit state/reason. Do not fabricate compiled
   textbook, practice, project, offline or search availability.

No Claude-owned UI, shell, global CSS, lesson player, ranking, Tutor retrieval,
assessment scoring or teacher-shell files are changed on this branch.
