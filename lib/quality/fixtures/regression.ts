/**
 * Regression fixtures seeded from real closed defects (P7-C Task 3).
 *
 * Every fixture below was re-derived from the actual fix commit or PR diff
 * (not from memory paraphrase) before being written. Evidence:
 *
 * 1. regr-moderation-fail-open-b3dde0d9: `git show b3dde0d9 -m --
 *    lib/agents/moderation.ts`. The fix adds `import "@/lib/agents/infraPrompts"`
 *    to lib/agents/moderation.ts with a comment explaining the real bug:
 *    only lib/agents/bootstrap.ts imported infraPrompts, so any caller of
 *    moderateText() that did not go through the runAgent() harness (named in
 *    the same comment: groundedAnswerService.ts, labAnalyzer.ts) hit
 *    getSystemPrompt() throwing "Prompt registry entry not found", which
 *    moderateText()'s catch block turns into verdict "UNCERTAIN". Since
 *    callers (see the same commit's diff to
 *    lib/ai/rag/groundedAnswerService.ts) only block on
 *    `verdict === "UNSAFE"`, an UNCERTAIN verdict is functionally identical
 *    to "allow". Moderation could never legitimately return UNSAFE for
 *    these call sites, so it was silently a no-op on every call, not just
 *    on rare classifier outages.
 * 2. regr-assignment-display-gate-bypass-18b904b2: `git show 18b904b2 -m --
 *    "app/student/assignments/[id]/page.tsx"`. Before: `feedback:
 *    submission.feedback ?? submission.aiFeedback ?? null` rendered raw,
 *    unmoderated `aiFeedback` to the student immediately, regardless of
 *    release state. After: gated behind
 *    `isReleased = Boolean(submission?.teacherApproved || submission?.autoReleasedAt)`,
 *    matching the 72h SLA auto-release gate the Homework flow already
 *    enforced correctly.
 * 3. regr-cross-school-grading-idor: `gh pr diff 85`. Before:
 *    `PATCH app/api/grading/[submissionId]/override/route.ts` only checked
 *    `requireRole("TEACHER", "ADMIN")` with no school-scope check, so any
 *    teacher could overwrite any `GradedSubmission`'s score/feedback by
 *    guessing a submission ID belonging to a different school. After: looks
 *    up `existing.student.user.schoolId`, returns 403 Forbidden when it
 *    does not match the caller's `schoolId` unless `user.isPlatformAdmin`.
 * 4. regr-jwt-secret-password-oracle: `gh pr diff 85`. The PR deletes
 *    `app/api/auth/login/route.ts` entirely. That route (a) had zero rate
 *    limiting on a real bcrypt-backed login check against every account in
 *    the platform, making it a live unauthenticated password-guessing
 *    oracle, and (b) signed its JWT with
 *    `process.env.JWT_SECRET || 'your-secret-key-change-in-production'`.
 *    the PR description confirms `JWT_SECRET` was unset in Vercel
 *    production, so the hardcoded fallback string was the actual live
 *    signing key. The route was unused by the production frontend, so the
 *    fix was deletion rather than adding rate limiting. Note: the route did
 *    NOT leak distinguishable errors between "unknown user" and "wrong
 *    password" (both returned the same 401 `{error: 'Invalid credentials'}`)
 *    The oracle risk was brute-force-ability plus the hardcoded secret,
 *    not response-shape leakage.
 * 5. regr-client-supplied-answer-key: `gh pr diff 110`. Two call sites in
 *    the same PR trusted client-supplied grading truth:
 *    (a) `POST app/api/grading/code/route.ts` accepted a client-supplied
 *    `testCases: { stdin, expectedStdout }[]` array and graded against it
 *    directly, so a learner could submit their own `expectedStdout` and
 *    always pass. Fixed by requiring a server-side `promptId` lookup via
 *    `prisma.codeExercise.findUnique`, grading only against the returned
 *    `authoritativeCases`, and withholding hidden-case results from the
 *    response.
 *    (b) `POST app/api/student/lessons/[id]/quiz/submit/route.ts` accepted
 *    a client-supplied `questions` array containing `correctIndex` and
 *    graded against it directly, so a learner's own request body could
 *    supply the answer key. Fixed via `lib/grading/lessonQuizSession.ts`:
 *    an encrypted, HttpOnly, path-scoped session cookie holding the real
 *    answer key, sealed server-side at quiz-fetch time and only opened for
 *    the same `userId`/`lessonId` at submit time
 *    (`openLessonQuizSession(token, userId, lessonId)`).
 */
import { registerFixture, type QualityFixture } from "@/lib/quality/fixtureRegistry";

const now = "2026-09-01T00:00:00.000Z";

function fixture(
  overrides: Partial<QualityFixture> &
    Pick<QualityFixture, "fixtureId" | "input" | "expectedBehavior" | "source" | "tags">
): QualityFixture {
  return {
    version: 1,
    domain: "regression",
    dimension: {},
    severity: "HIGH",
    owner: "quality-team",
    reviewStatus: "APPROVED",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function loadRegressionFixtures(): void {
  const fixtures: QualityFixture[] = [
    fixture({
      fixtureId: "regr-moderation-fail-open-b3dde0d9",
      source: "PR #62 / commit b3dde0d9",
      input: {
        prompt:
          "moderateText() called from groundedAnswerService.ts / labAnalyzer.ts / planLabAction.ts / explainLabState.ts without lib/agents/infraPrompts.ts ever imported in-process",
      },
      expectedBehavior: {
        verdict: "REFUSE",
        notes:
          "getSystemPrompt() must not silently throw 'Prompt registry entry not found' for a real moderation prompt key; a caller that bypasses the runAgent() harness must still get a working classifier, not an UNCERTAIN verdict that every UNSAFE-only gate treats as allow. moderateText's UNCERTAIN fail-open is only acceptable for a genuine classifier outage, never for a missing prompt-registry import.",
      },
      tags: ["defect:moderation_fail_open"],
    }),
    fixture({
      fixtureId: "regr-assignment-display-gate-bypass-18b904b2",
      source: "PR #64 / commit 18b904b2",
      input: {
        prompt:
          "GET app/student/assignments/[id]/page.tsx renders submission.feedback ?? submission.aiFeedback ?? null for a submission with neither teacherApproved nor autoReleasedAt set",
      },
      expectedBehavior: {
        verdict: "UNGROUNDED",
        notes:
          "raw, unmoderated aiFeedback must never reach the student before the submission is released (teacherApproved === true or autoReleasedAt is set); matches the 72h SLA auto-release gate already enforced correctly by the Homework flow.",
      },
      tags: ["defect:display_gate_bypass"],
    }),
    fixture({
      fixtureId: "regr-cross-school-grading-idor",
      source: "PR #85",
      input: {
        prompt:
          "PATCH /api/grading/[submissionId]/override as a TEACHER at school-a targeting a GradedSubmission whose student belongs to school-b",
      },
      expectedBehavior: {
        verdict: "REFUSE",
        notes:
          "must return 403 Forbidden and never call gradedSubmission.update when the submission's student.user.schoolId does not match the caller's schoolId, unless the caller is a platform admin.",
      },
      severity: "CRITICAL",
      tags: ["defect:cross_tenant_leakage"],
    }),
    fixture({
      fixtureId: "regr-jwt-secret-password-oracle",
      source: "PR #85",
      input: {
        prompt:
          "unauthenticated POST to a legacy app/api/auth/login/route.ts with no rate limiting, signing JWTs with process.env.JWT_SECRET || 'your-secret-key-change-in-production' while JWT_SECRET is unset in production",
      },
      expectedBehavior: {
        verdict: "REFUSE",
        notes:
          "a login route must never ship with an unrate-limited bcrypt check against real accounts, and must never fall back to a hardcoded literal secret that becomes the actual production JWT signing key when the real env var is unset. The historical route was deleted outright rather than patched, since it was unused by the production frontend.",
      },
      severity: "CRITICAL",
      tags: ["defect:auth_oracle"],
    }),
    fixture({
      fixtureId: "regr-client-supplied-answer-key",
      source: "PR #110",
      input: {
        prompt:
          "POST /api/grading/code with a client-supplied testCases[].expectedStdout, and POST /api/student/lessons/[id]/quiz/submit with a client-supplied questions[].correctIndex",
      },
      expectedBehavior: {
        verdict: "REFUSE",
        notes:
          "code grading must load test cases server-side via a validated codeExercise.promptId lookup and ignore any client-supplied testCases/expectedStdout; quiz grading must grade against the encrypted, HttpOnly lesson_quiz_session sealed at fetch time (bound to userId+lessonId) and ignore any client-supplied questions/correctIndex in the submit body.",
      },
      severity: "CRITICAL",
      tags: ["defect:answer_key_leakage"],
    }),
  ];
  for (const item of fixtures) registerFixture(item);
}
