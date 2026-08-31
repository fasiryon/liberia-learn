# NR-14.5 Auto-grading Fairness Audit

## Scope and authority

This is a repository audit, not a claim about unreviewed production data. The
approved item/rubric is the grading authority. No generic fuzzy matching,
demographic rule, or student-group assumption is used.

| Response type | Grader | Authority | Normalization | Confidence/review | Offline |
| --- | --- | --- | --- | --- | --- |
| Lesson quiz / WAEC practice | deterministic selected option | server-held approved item key | integer index only | deterministic; no AI judgement | queue as pending review |
| Code exercise | Judge0 sandbox | validated server-held test cases | trim terminal stdout only | deterministic result; teacher override remains available | not locally graded |
| Essay | rubric-bound AI advisory | exercise rubric or WAEC default | word-count threshold only | advisory and teacher override | not locally graded |
| AI literacy | rubric-bound AI advisory | stored exercise rubric and exercise-type guidance | word-count threshold only | advisory and teacher override | not locally graded |
| Teacher grading assist | rubric-bound AI advisory | teacher supplied approved rubric; teacher final authority | bounded strings | fallback is explicitly manual review | online only |

## Findings and remediation

1. Lesson quiz submission accepted a client copy of `correctIndex`. This was an
answer-key leak and allowed a forged score. The learner response now excludes
keys. The server retains the complete quiz in an encrypted, HttpOnly, two-hour
session bound to learner and scheduled lesson.
2. Code grading accepted client-provided expected outputs. The grading endpoint
now loads the validated `CodeExercise` by prompt id and lesson id, uses all
server-held tests, and does not return hidden-case output.
3. AI essay, AI-literacy, and teacher-assist prompts now explicitly label the
learner submission as untrusted data and separate it from rubric instructions.

## Fairness regression matrix

The rerunnable fixtures are the focused grading suites. They cover exact
correct/incorrect answers, malformed payloads, idempotency, answer-key
withholding, hidden code tests, output whitespace, language allow-list,
resource limits, LLM malformed output, fallback, and rubric-bound advisory
grading. Numeric-expression, fill-in, ordering, matching, and semantic text
auto-graders are not implemented in this repository, so no unsupported
normalization or fuzzy-equivalence policy was introduced.

Representative content uses repository contracts across Grade 2, 5, 8, and 9
authored lesson material. The auto-graded routes found do not encode a subject,
region, dialect, or demographic-specific rule. Spelling and punctuation only
affect scores where an approved essay rubric includes mechanics; they are not
globally normalized away.

## High-stakes and audit safety

AI results are advisory only. Teacher override is available through
`PATCH /api/grading/[submissionId]/override`; teacher assist declares final
teacher authority and writes audit events. Deterministic local results have
stored assessment evidence; offline attempts are deliberately stored as
`offline_pending_review` with no fabricated score. No provider credentials,
production/staging mutation, or schema change was used.
