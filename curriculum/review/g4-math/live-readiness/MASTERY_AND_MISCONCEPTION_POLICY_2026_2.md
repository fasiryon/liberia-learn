# Grade 4 Math release 2026.2: mastery continuity and misconception policy (PROPOSAL)

Prepared 2026-09-26 on branch `feat/g4-math-curriculum-review-revisions-v1`, applying the curriculum/product review CPR-2026-09-26.

**Status: PROPOSED. Not active.** No runtime code reads this document. Nothing here changes mastery, scoring, ranking or misconception logic, and nothing here is written to production. Activating any part needs a founder decision followed by a STOP-level review and a reviewed code PR (items R4 and R5 in `RELEASE_2026_2_AND_WRITE_PLAN.md`).

## 0. Principles (documented by CPR-2026-09-26)

Mastery continuity:

1. If a concept's semantics are unchanged and its governed evidence semantics are unchanged, prior evidence may carry forward.
2. Changed or new concepts do not inherit mastery by default.
3. Every carry-forward mapping is explicit, versioned and auditable.

Misconception policy:

1. An unchanged concept may inherit its existing misconception policy.
2. A changed or new concept needs an explicit policy binding.

Learning target: `LR-MATH-G4_6-02` stays `PARTIAL` until the full Grade 4 Math cell is reviewed and live-certified (enforced today by `__tests__/curriculum/g4-learning-target-readiness.test.ts`).

## 1. Mastery continuity proposal

Today evidence is scoped to a release identity, so a learner starts 2026.2 with empty concept states unless an explicit mapping carries 2026.1 evidence forward (`RELEASE_2026_2_AND_WRITE_PLAN.md`, R4).

### 1.1 Concept-by-concept assessment

| Concept (2026.1) | What changes in 2026.2 | Governed evidence | Proposal |
|---|---|---|---|
| `g4-fractions-equal-parts` rev 1, "Recognize fractions as equal parts" | **Changed.** The bound lesson now defines a fraction as equal parts of a whole *or part of a set*, and the end-of-lesson evidence assesses part of a set (`g4-frac-check-part-of-set`). A learner who mastered rev 1 (whole only) has shown no evidence on sets. | Diagnostic `g4-frac-diagnostic-equal-parts@1.0.0` unchanged (sha256 `3c73bd555847…`); five new items. | **No inheritance.** Before 2026.2 is registered, the composer must give this concept revision 2 (label, for example, "Recognize fractions as equal parts of a whole and of a set"). The composer currently carries rev 1 forward verbatim, so this is a required change, not done here. Learners start rev 2 at the diagnostic. |
| `g4-fractions-equivalence` rev 1 | Unchanged. | `g4-frac-practice-equivalence@1.0.0` unchanged (sha256 `bd851cc72d99…`). | **Eligible** for carry-forward, only through an explicit mapping (1.2). |
| `g4-fractions-compare` rev 1 (LiberiaLearn extension, not MOE-aligned) | Unchanged. | `g4-frac-diagnostic-compare@1.0.0` unchanged (sha256 `50dbae78c2e1…`). | **Eligible** for carry-forward, only through an explicit mapping (1.2). |

Founder alternative for `g4-fractions-equal-parts`: carry 2026.1 responses to the unchanged diagnostic item as *prior diagnostic evidence* for rev 2, never as rev 2 mastery. That needs its own mapping entry and changes what the first 2026.2 action is for those learners, so it is listed as an option, not proposed.

### 1.2 Proposed mapping record

A reviewed file (for example `curriculum/review/g4-math/release-carry-forward-2026.2.json`), one entry per carried concept:

```json
{
  "id": "cf-g4-math-2026.2-equivalence-v1",
  "fromRelease": { "id": "lr-moe-g4-math-fractions-2026.1", "identity": "de256495ec6f72fe8160179331c7f891d0574a2087a21163fbe28b93f9d88540" },
  "toRelease": { "id": "lr-moe-g4-math-2026.2", "identity": "<the approved 2026.2 identity>" },
  "conceptId": "g4-fractions-equivalence",
  "fromRevision": 1,
  "toRevision": 1,
  "items": [{ "itemId": "g4-frac-practice-equivalence", "itemVersion": "1.0.0", "sha256": "bd851cc72d99…(full hash)" }],
  "basis": "UNCHANGED_CONCEPT_AND_EVIDENCE",
  "approvedBy": "<founder>",
  "approvedAt": "<ISO time>"
}
```

Rules the implementing PR must enforce:

- Both release identities are pinned. If either changes, the mapping is void.
- Every item is pinned by id, version and sha256. Any change to an item voids the mapping.
- `toRevision` must equal `fromRevision`; a changed concept can never appear in a mapping.
- Replay resolves carried evidence only through the mapping, and the learner record shows which mapping was applied.
- A mapping is added by a human through a reviewed PR, never by tooling.

## 2. Misconception policy proposal

Today `GRADE4_MATH_MISCONCEPTION_POLICY` (`lib/learning-state/misconceptionPolicy.ts`, `misconception-signal-policy/1.0.0`) is keyed to the 2026.1 identity and has one mapping: binding `g4-frac-bind-equal-parts-v1`, item `g4-frac-diagnostic-equal-parts@1.0.0`, option index 3 (`4/3`) -> `g4-fractions-numerator-denominator-reversal`. It fires under no other release.

The only mapped concept, `g4-fractions-equal-parts`, changes in 2026.2, so under the principle above it does **not** inherit. Proposal: a separate policy object keyed to the approved 2026.2 identity (policy version `misconception-signal-policy/1.1.0`), leaving the 2026.1 policy byte-identical.

| # | Signal | Binding / item | Option index (text) | Basis |
|---|---|---|---|---|
| M1 | `g4-fractions-numerator-denominator-reversal` (existing) | `g4-frac-bind-equal-parts-v1` / `g4-frac-diagnostic-equal-parts@1.0.0` | 3 (`4/3`) | Unchanged item and meaning; re-bound explicitly, not inherited. |
| M2 | same | `g4-frac-bind-part-of-whole-v1` / `g4-frac-practice-part-of-whole@1.0.0` | 3 (`8/3`) | Reversed fraction. |
| M3 | same | `g4-frac-bind-part-of-set-v1` / `g4-frac-practice-part-of-set@1.0.0` | 3 (`5/2`) | Reversed fraction. |
| M4 | same | `g4-frac-bind-check-part-of-set-v1` / `g4-frac-check-part-of-set@1.0.0` | 3 (`8/3`) | Reversed fraction. |
| M5 | **new** `g4-fractions-set-part-to-part` ("May use the other part, not the whole set, as the denominator") | `g4-frac-bind-part-of-set-v1` / `g4-frac-practice-part-of-set@1.0.0` | 2 (`2/3`) | Red to not-red, the error named in the 2026.2 teacher notes. |
| M6 | same new signal | `g4-frac-bind-check-part-of-set-v1` / `g4-frac-check-part-of-set@1.0.0` | 2 (`3/5`) | Ripe to unripe. |
| M7 | same new signal | `g4-frac-bind-part-of-whole-v1` / `g4-frac-practice-part-of-whole@1.0.0` | 2 (`3/5`) | Eaten to not eaten. |

Not proposed: a signal for complement answers (`5/8`, `3/5` for "red"). They can come from misreading the question as well as from a misconception, so a signal would be noisy.

Concepts `g4-fractions-equivalence` and `g4-fractions-compare` have no signals today and none are proposed.

Implementation (not done): `resolveGovernedMisconceptionSignal` compares against a single policy; supporting a second release-keyed policy is a code change for the R5 PR, with tests that 2026.1 evidence still resolves exactly as today.

## 3. What would activate this, in order

1. Founder decision on sections 1 and 2 (accept, amend or reject each row).
2. Composer change: `g4-fractions-equal-parts` revision 2 in 2026.2 (changes the approvable identity, so it comes before the release-level approval).
3. Reviewed PR implementing the mapping file and replay rules (R4) and the 2026.2 misconception policy (R5), with a STOP-level review.
4. Release-level approval of the resulting exact identity (R1), then registration (plan section 3.3).
