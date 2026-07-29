# AI Teaching Runtime v1 Final Report

Date: 2026-07-29

Branch: `feat/teaching-runtime-v1`

Status: COMPLETE and merged to `main` at `61bc3279` after final review. The
production feature flag remains disabled.

Preview: `https://liberia-learn-m35foesnv-farquema-siryons-projects.vercel.app`

## Outcome

Teaching Runtime v1 now provides authenticated, tenant-scoped session start,
turn submission, degraded-mode recovery, and idempotent session completion.
Each turn runs through the existing governed agent harness, records cost and
tool activity, and persists an ordered `TeachingTurn`. Session completion
creates one idempotent `TeachingLedger`.

The live walkthrough found and closed one runtime defect before completion:
the model used common alias keys such as `session_id` and `message` for the two
teaching tools. The tool boundary now normalizes only those observed aliases
before strict Zod validation, the prompt gives exact argument examples, and
agent failures return a structured fail-closed 503 instead of an empty 500.

## Full sprint scope

This report closes the complete 16-task AI Teaching Runtime v1 sprint, not
only the Task 16 gate. The branch changes 41 files across persistence, agent
governance, runtime orchestration, API delivery, offline recovery, testing,
cost measurement, and documentation.

The delivered classroom lifecycle is:

1. An authenticated teacher or same-school admin starts a session against an
   approved global or school-owned lesson.
2. The runtime decides `FULL_CONFIDENCE` or `DEFERRED` once from the lesson's
   live MOE alignment and stores the decision on the session.
3. Each classroom exchange reserves a unique turn index atomically, derives a
   deterministic Lesson Director pacing action, and makes exactly one governed
   `runAgent("teaching-runtime", ...)` invocation.
4. The agent receives literal lesson content, objectives, grade, subject,
   guardrail mode, and the pacing hint. It can use only the two allowlisted
   teaching tools.
5. The completed turn stores narration, guardrail behavior, tool activity,
   pacing action, cost, and ordering. Failed attempts do not reuse an already
   reserved turn index.
6. A connectivity or equipment failure can switch the classroom to cached
   audio-only material or a printable worksheet while recording the degraded
   mode when the server is reachable.
7. Ending the session blocks new turns, builds one idempotent structured
   ledger, completes the lifecycle, and writes the correlated audit event.

## Task-by-task completion

| Task | Status | Delivered result |
|---:|---|---|
| 1 | COMPLETE | Added `TeachingSession`, `TeachingTurn`, and `TeachingLedger`, plus an atomic `nextTurnIndex` sequence, using additive migrations and indexes. |
| 2 | COMPLETE | Added pure lesson narration and slide extraction with `body_standard`, `body_block`, legacy body, HTML cleanup, objective fallback, and tests. |
| 3 | COMPLETE | Added live per-lesson alignment classification using the existing canonical MOE alignment reader. |
| 4 | COMPLETE | Added deterministic Lesson Director pacing for continue, pause, comprehension check, prerequisite revisit, and exit ticket decisions. |
| 5 | COMPLETE | Registered the governed system prompt for grounded teaching, honest deferral, exact tool arguments, and private Whisper behavior. |
| 6 | COMPLETE | Added allowlisted `teaching.sendWhisperPrompt` and `teaching.flagOutOfScope` tools with strict schemas, audit tags, push reuse, and cost-simulation notification suppression. |
| 7 | COMPLETE | Registered the feature-flagged `teaching-runtime` agent with low temperature, bounded output, tool allowlist, and per-invocation, per-user, and daily cost caps. |
| 8 | COMPLETE | Added per-turn orchestration on the existing agent harness, atomic ordering, curriculum context assembly, honest-deferral detection, cost capture, and fail-closed agent handling. |
| 9 | COMPLETE | Added device-cache-based audio-only and printable worksheet recovery formatters, browser adapters, controls, and tests. |
| 10 | COMPLETE | Added an idempotent ledger builder with standards, objectives, resources, questions, response aggregates, transcript, confidence flags, deferrals, and Whisper counts. |
| 11 | COMPLETE | Added the authenticated session-start API with approved-content checks, school isolation, one-time alignment selection, and transactional start auditing. |
| 12 | COMPLETE | Added the authenticated turn API with teacher ownership or same-school admin scope, Zod input validation, runtime invocation, and structured failure responses. |
| 13 | COMPLETE | Added the degraded-mode API with school and facilitator scoping plus an atomic `teaching.session.degrade` audit event. |
| 14 | COMPLETE | Added race-safe and idempotent completion using `ACTIVE` to `ENDING` to `COMPLETED`, ledger upsert, scoped replay, and transactional end auditing. |
| 15 | COMPLETE | Added and ran the paid cost simulator against real aligned and unaligned lessons, including one-turn ceiling probes and two 50-turn sessions. |
| 16 | COMPLETE | Passed the full gate, deployed an enabled preview, completed real aligned and unaligned walkthroughs, verified recovery, Whisper persistence, and ledgers, and fixed the defect found live. |

## Major implementation areas

### Persistence and concurrency

- Three new sprint-owned tables were added without changing the meaning or
  access rules of existing domain tables.
- `TeachingTurn(sessionId, turnIndex)` is unique.
- `TeachingSession.nextTurnIndex` is incremented atomically before an agent
  call, preventing concurrent requests from selecting the same turn number.
- A failed or moderated invocation leaves a visible sequence gap instead of
  reusing an index and obscuring that an attempt occurred.
- The end route moves the session to `ENDING` before ledger construction so a
  new turn cannot be accepted during completion.
- `TeachingLedger.sessionId` is unique and the builder uses upsert, making a
  repeated completion request idempotent.

### Governed teaching agent

- All model work goes through the existing routed agent harness. There are no
  direct provider calls in the teaching runtime.
- One turn equals one invocation. Continuous audio/video streaming was
  intentionally excluded from v1.
- The agent is protected by `AGENT_TEACHING_RUNTIME_ENABLED`, a two-tool
  allowlist, output limits, budget routing, and agent cost caps.
- The runtime persists the real per-turn model cost and the platform persists
  the full correlated `AgentInvocation`.
- Agent invocation and audit rows are now written in one transaction. If the
  audit write fails, the invocation persistence fails with it.
- The shared AI budget guard now fails closed when usage data is unavailable
  instead of allowing unmetered calls.

### Knowledge Guardrails and classroom pacing

- Genuine MOE alignment produces `FULL_CONFIDENCE`; absent, empty, malformed,
  or placeholder alignment produces `DEFERRED`.
- `FULL_CONFIDENCE` responses are instructed to remain grounded in the lesson
  and identify the source topic in teacher-friendly language.
- `DEFERRED` responses are limited to literal lesson content and must use the
  out-of-scope tool plus an honest teacher-referred deferral when more
  knowledge would be required.
- The deterministic Lesson Director uses recent student outcomes and turn
  thresholds to request comprehension checks, prerequisite revisits, pauses,
  and exit tickets.

### Facilitator Whisper Mode

- The agent can send a private coaching nudge through the existing VAPID push
  service.
- Whisper content is recorded on the corresponding teaching turn and counted
  in the final ledger.
- The paid simulation suppresses real notification delivery while still
  measuring the tool-call behavior.
- Live persistence was verified. Device delivery remains pending because the
  selected test facilitator had no active push subscription.

### Teaching Recovery

- Projector failure selects cached `AUDIO_ONLY` delivery.
- Internet or power failure selects a cached printable `WORKSHEET`.
- Recovery reads the existing browser lesson cache and therefore remains
  usable when the server cannot be reached.
- If online, the client records the degradation reason and mode through the
  scoped API. Local recovery is not blocked if that audit request cannot be
  delivered immediately.

### Authentication, tenant isolation, and auditability

- Start, turn, degrade, and end routes require `TEACHER` or `ADMIN`.
- Every route requires a school-scoped user.
- A teacher can access only their own session in their school. An admin can
  operate only on sessions in the admin's school.
- Session start accepts only approved global content or approved content owned
  by the same school.
- Start, degradation, end, tool activity, and every agent invocation are
  auditable.
- The runtime's internal agent role remains `system`, following the existing
  harness convention, only after the human-facing API route authorizes the
  caller.

## Full branch file inventory

### Data and migrations

- `prisma/schema.prisma`
- `prisma/migrations/20260728_000001_teaching_runtime_v1/migration.sql`
- `prisma/migrations/20260728_000002_teaching_turn_sequence/migration.sql`

### Teaching runtime

- `lib/teaching/alignment.ts`
- `lib/teaching/ledger.ts`
- `lib/teaching/lessonContent.ts`
- `lib/teaching/lessonDirector.ts`
- `lib/teaching/recovery.client.ts`
- `lib/teaching/recovery.ts`
- `lib/teaching/runtime.ts`
- `lib/teaching/types.ts`

### Agent platform integration

- `lib/agents/agents/teaching-runtime.agent.ts`
- `lib/agents/bootstrap.ts`
- `lib/agents/invocationLog.ts`
- `lib/agents/prompts.ts`
- `lib/agents/prompts/teaching-runtime.md`
- `lib/agents/runtime.ts`
- `lib/agents/tools/teaching.tools.ts`
- `lib/ai/budgetGuard.ts`

### API and recovery interface

- `app/api/teaching/sessions/route.ts`
- `app/api/teaching/sessions/[sessionId]/turn/route.ts`
- `app/api/teaching/sessions/[sessionId]/degrade/route.ts`
- `app/api/teaching/sessions/[sessionId]/end/route.ts`
- `components/teaching/TeachingRecoveryControls.tsx`

### Cost measurement

- `scripts/teaching-runtime-cost-sim.ts`

### Tests

- `__tests__/agents/invocationLog.test.ts`
- `__tests__/agents/teachingRuntimeAgent.test.ts`
- `__tests__/agents/teachingTools.test.ts`
- `__tests__/ai.budget.test.ts`
- `__tests__/api/teachingSessions.test.ts`
- `__tests__/teaching/alignment.test.ts`
- `__tests__/teaching/ledger.test.ts`
- `__tests__/teaching/lessonContent.test.ts`
- `__tests__/teaching/lessonDirector.test.ts`
- `__tests__/teaching/recovery.test.ts`
- `__tests__/teaching/recoveryComponent.test.tsx`
- `__tests__/teaching/runtime.test.ts`

### Plan, state, and repository metadata

- `.gitignore`
- `docs/superpowers/plans/2026-07-28-teaching-runtime-v1.md`
- `docs/audits/TEACHING_RUNTIME_V1_FINAL_REPORT.md`
- `docs/roadmaps/CURRENT_EXECUTION_STATE.md`

## Task 15 cost measurement

The required paid 50-turn simulations used fresh, real curriculum records and
an existing school-scoped teacher.

| Alignment | Session | Turns | Total cost | Cost per turn | Deferrals |
|---|---|---:|---:|---:|---:|
| FULL_CONFIDENCE | `cms56whxw0000vo4ci6vcgw3j` | 50 | $0.032309 | $0.000646 | 2 |
| DEFERRED | `cms59xi1m0000von0cqbvh2dc` | 50 | $0.013708 | $0.000274 | 5 |

Both one-turn probes were below the approved $0.005 per-invocation ceiling.

## Six escalation-point resolutions

1. Alignment mode is derived once at authenticated session start from the live
   lesson's genuine MOE alignment and stored on the session.
2. V1 is turn-based. Every classroom exchange is one governed
   `runAgent("teaching-runtime", ...)` invocation. Continuous streaming remains
   outside V1.
3. Real paid cost was measured for both an aligned and an unaligned 50-turn
   session before classroom-readiness was claimed.
4. A session starts only through the authenticated, school-scoped start route.
5. Whisper Mode reuses the existing VAPID push service. The walkthrough
   persisted a real successful tool call. No device received it because the
   selected test teacher had no active push subscription.
6. Persistence is additive: `TeachingSession`, `TeachingTurn`, and
   `TeachingLedger` were added without weakening existing RBAC, tenant
   isolation, or audit logging.

## Task 16 real walkthrough

### Aligned lesson

- Content: `civics-g1-1-rules-rights-and-duties-assessment-and-reflection`
- Session: `cms6eynvk0000kv04orn7lgds`
- Guardrail: `FULL_CONFIDENCE`
- Result: 10 turns, 1 deferral, $0.011770 total
- Out-of-scope check: the France question produced an honest teacher-referred
  deferral.
- Recovery: `{"mode":"WORKSHEET","recorded":true}`
- Ledger: `cms6f2cdv005pl1049kcg24ex`

### Whisper verification

- Session: `cms6h70tl0004jo04i8453u3p`
- Ledger: `cms6h78xa0001l1040dxiuuyg`
- Persisted count: `whisperPromptsIssued: 1`
- Push delivery: zero devices, because the test teacher had no active push
  subscription. The tool call and private prompt were still persisted and
  audited.

### Unaligned lesson

- Content: `cha-g9-math-multimedia-demo-elite-2026-04-23t20-09-12`
- Session: `cms6h7a420004l1046gopvuv4`
- Guardrail: `DEFERRED`
- Result: 10 persisted turns, 5 deferrals, $0.004642 total
- Whisper prompts: 1
- Out-of-scope ledger entries: 5
- Ledger: `cms6hn2ua0030jo04n9xm7siq`
- A moderation-blocked synthetic prompt reserved turn index 5 without
  persisting a turn. The atomic sequence therefore contains
  `[0,1,2,3,4,6,7,8,9,10]`, preserving the failed attempt rather than reusing
  an index.

### Ledger evidence

```json
{
  "aligned": {
    "ledgerId": "cms6f2cdv005pl1049kcg24ex",
    "aggregatedResponses": {
      "totalTurns": 10,
      "deferredTurns": 1,
      "whisperPromptsIssued": 0
    },
    "standardsCovered": ["LR-CIV-G1_3-01"],
    "transcriptEntries": 10,
    "outOfScopeQuestions": [
      {
        "turnIndex": 3,
        "text": "What is the capital of France, and why is it famous?"
      }
    ]
  },
  "unaligned": {
    "ledgerId": "cms6hn2ua0030jo04n9xm7siq",
    "aggregatedResponses": {
      "totalTurns": 10,
      "deferredTurns": 5,
      "whisperPromptsIssued": 1
    },
    "standardsCovered": [],
    "transcriptEntries": 10,
    "outOfScopeQuestionCount": 5
  }
}
```

## Observed guardrail difference

The aligned lesson answered nine of ten prompts from the curriculum and
deferred only the unrelated France question. The unaligned lesson narrated
literal ratio content but deferred five of ten prompts, including requests for
new examples, calculus comparison, and photosynthesis. It was conservative
enough to defer one request to repeat a literal worked example. This confirms a
visible behavior difference, while also documenting that V1 grounding remains
prompt and tool enforced rather than a deterministic post-response verifier.

## Validation

- `npx prisma generate`: PASS
- `npx tsc --noEmit`: PASS with `NODE_OPTIONS=--max-old-space-size=6144`
- Final focused teaching review: PASS, 39 tests
- `npx vitest run`: PASS, 4,409 tests in 537 files
- `npm run build`: PASS, 378 static pages generated
- Vercel preview deployment: READY

An earlier pre-review full-suite attempt saw an unrelated audio dry-run test
exceed its five-second timeout under parallel load. The test passed alone in
1.63 seconds, the unchanged retry passed, and the later final merge suite
passed all 4,409 tests without that timeout.

## Final merge review

The merge review integrated current `main`, including the live NR-2
reconciliation, and then re-ran the complete gate. Review found one tenant
boundary gap before merge: `teaching.sendWhisperPrompt` trusted the
model-supplied session ID. Both teaching tools now require the requested
session to match the invocation trace. Whisper additionally queries by the
invocation facilitator and school before a push can be attempted. Regression
tests prove that cross-session targets fail before a database read or push.

The degradation route now records mode changes only for an `ACTIVE` session.
The production Vercel environment was inspected during final review and has no
`AGENT_TEACHING_RUNTIME_ENABLED` variable, leaving the runtime disabled by
default.

## V1 boundaries and remaining release work

- This is a turn-based runtime, not continuous microphone, camera, or video
  streaming.
- V1 delivers the governed runtime, APIs, and a reusable recovery component.
  It does not yet mount a complete facilitator classroom UI; the certified
  walkthrough exercised the authenticated APIs directly.
- Grounding is enforced by prompt, constrained context, tool signaling,
  moderation, audit, and observed behavior. V1 does not contain a
  deterministic post-response verifier that can mathematically guarantee every
  generated sentence is grounded.
- The preview is validated, but production is not enabled or released.
- Live Whisper persistence is proven, but delivery to a real facilitator
  device still requires an active push subscription.
- Quiz scoring, homework assignment, facilitator notes, and finalized
  narrative fields exist in the ledger shape but are not populated by the v1
  turn loop.

## Mobile audit cycle summary

The requested mobile audit was completed separately on
`fix/mobile-audit-issues`. Its validated commit is `d8da8453`, with 21 files
changed, 1,149 insertions, and 492 deletions.

### Findings and resolutions

| Finding | Resolution in validated commit |
|---|---|
| P0: the admin student list exposed a detail workflow without a working student detail destination. | Added the admin student detail page, tenant-scoped API route, shared detail loader, and list navigation. |
| P0: teacher and admin placement workflows could not provide a complete, normalized attempt review. | Added the admin placement detail page and API, normalized both role-specific payloads, and exposed question, selected answer, correctness, and concept data. |
| Post-login dashboards still exposed demo-oriented hints and credentials messaging. | Removed the hints from admin, general, guardian, and platform dashboard surfaces. |
| Disabled features could expose internal feature-flag codes to users. | Replaced raw codes with safe user-facing messages in affected curriculum, placement, and lesson-creation pages. |
| `/teacher` duplicated a large dashboard implementation and could drift from `/teacher/dashboard`. | Consolidated the entry point by redirecting `/teacher` to the canonical teacher dashboard. |
| A live user-facing class label contained mojibake. | Added an encoding repair command and repaired the detected label. |

### Validated mobile-audit files

- `app/admin/curriculum/units/page.tsx`
- `app/admin/page.tsx`
- `app/admin/placements/[placementId]/page.tsx`
- `app/admin/placements/page.tsx`
- `app/admin/students/[id]/page.tsx`
- `app/admin/students/page.tsx`
- `app/api/admin/placements/[id]/route.ts`
- `app/api/admin/students/[id]/route.ts`
- `app/api/teacher/placements/[id]/route.ts`
- `app/dashboard/page.tsx`
- `app/guardian/GuardianDashboardClient.tsx`
- `app/guardian/dashboard/page.tsx`
- `app/platform/page.tsx`
- `app/teacher/create-lesson/page.tsx`
- `app/teacher/page.tsx`
- `app/teacher/placements/[placementId]/page.tsx`
- `docs/roadmaps/CURRENT_EXECUTION_STATE.md`
- `lib/adminStudentDetail.ts`
- `lib/placementDetail.ts`
- `package.json`
- `scripts/fix-encoding.ts`

That committed snapshot reports:

- TypeScript: PASS
- Vitest: PASS, 1,541 tests in 204 files
- Build: PASS
- Encoding repair command: PASS

### Follow-up review disposition

The mobile-audit worktree contained later hardening in six paths:

- modified `app/api/admin/placements/[id]/route.ts`
- modified `package.json`
- modified `scripts/fix-encoding.ts`
- untracked `__tests__/admin.placement-detail.route.test.ts`
- untracked `__tests__/mojibake.test.ts`
- untracked `lib/encoding/mojibake.ts`

The branch was fast-forwarded to current `main` before review. The placement
authorization and encoding changes were legitimate in intent, but review found
that the encoding test accepted partially repaired mojibake. That expectation
was corrected locally. Focused tests then passed 10/10 and TypeScript passed.

The required unmodified full Vitest suite did not pass: multiple unrelated
legacy tests exceeded their five-second timeouts and the suite exceeded the
command ceiling. Because the normal gate remained red, none of the six
follow-ups were committed. They were explicitly discarded, their temporary
stash was dropped, and the stale worktree and redundant local branch were
removed. They must not be represented as shipped or pending in Git.

The validated audit also notes that a broader legacy source-text encoding
sweep may still be warranted.

## Next step

Keep `AGENT_TEACHING_RUNTIME_ENABLED` disabled in production until a deliberate
release decision and a facilitator device with an active push subscription are
available for delivery verification. The validated mobile-audit commit is
already in `main`; its rejected follow-ups require a new scoped implementation
and a clean full gate if they are reconsidered later.
