# AI Teaching Runtime v1 Final Report

Date: 2026-07-29

Branch: `feat/teaching-runtime-v1`

Status: COMPLETE on preview. The production feature flag remains disabled.

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
- Focused teaching regressions: PASS, 28 tests
- `npx vitest run`: PASS, 4,407 tests in 537 files
- `npm run build`: PASS, 378 static pages generated
- Vercel preview deployment: READY

One full-suite attempt saw an unrelated audio dry-run test exceed its
five-second timeout under parallel load. The test passed alone in 1.63 seconds,
and the unchanged full-suite retry passed all 4,407 tests.

## Mobile audit cycle summary

The separate `fix/mobile-audit-issues` worktree contains validated commit
`d8da8453`, covering:

- admin student and placement detail routes and pages
- normalized placement response details
- removal of post-login demo hints
- safe feature-flag messages instead of raw codes
- `/teacher` dashboard consolidation
- user-facing encoding repair

That committed snapshot reports:

- TypeScript: PASS
- Vitest: PASS, 1,541 tests in 204 files
- Build: PASS
- Encoding repair command: PASS

The mobile-audit worktree also contains later uncommitted hardening in six
paths: the admin placement route, `package.json`, the encoding script, two test
files, and `lib/encoding/`. Those follow-up edits were not merged, committed, or
revalidated as part of this teaching-runtime cycle and must not be represented
as shipped.

## Next step

Review and merge `feat/teaching-runtime-v1` to `main`. Keep
`AGENT_TEACHING_RUNTIME_ENABLED` disabled in production until a deliberate
release decision and a facilitator device with an active push subscription are
available for delivery verification. Review and commit or discard the separate
mobile-audit follow-up worktree before merging its validated audit commit.
