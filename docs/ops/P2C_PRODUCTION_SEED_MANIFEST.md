# P2-C Production Seed Manifest

Date: 2026-08-19. Deterministic allowlist for the P2-C production data seed —
not "copy staging." Every count below was freshly re-queried from staging
(`yonpfzjczoffhrgibxkz`) during this pass, not carried from earlier commit
messages, per explicit instruction.

## Hard finding — read this before seeding anything

**Staging's live `AssessmentBaselineFramework` row for `WAEC.LIBERIA.LSHSCE.REGULAR`
currently has `examAliases: ["WASSCE"]` and `regionalReferenceLabels: []` —
the exact opposite of what its own seed script
(`scripts/p2c-staging-exam-framework-seed.ts:171,175`) actually sets
(`examAliases: []`, `regionalReferenceLabels: ["WASSCE"]`).**

Independently re-verified via raw SQL against staging, bypassing any
Prisma-client-layer concern:

```
code: WAEC.LIBERIA.LSHSCE.REGULAR
examAliases: ["WASSCE"]              <- stale, wrong
regionalReferenceLabels: []          <- stale, wrong
createdAt: 2026-08-17T18:22:34.336Z
```

The seed script's *source code* is correct and matches every prior audit
pass's finding (`examAliases: []` everywhere, WASSCE isolated to
`regionalReferenceLabels`). The *already-persisted row* predates that fix
and was never re-synced — the fix changed future-insert behavior, not this
existing row. This is a real, previously undetected gap: every earlier
"PASS" on this specific claim this session verified the script's source,
not this row's live value. **It does not affect calculation safety**
(`__tests__/p2c/wassce-isolation.test.ts` proves no calculation code reads
either field, and this row's `examAliases` value was never queried by any
gap-engine/depth logic) — it is a data-hygiene gap, contained to staging,
not a semantic regression.

**Not fixed in this pass** — out of the 10 explicitly authorized actions,
and this pass's own instruction is to prepare, not to make unscoped
staging writes. **The production seed below uses the CORRECT values
(`examAliases: []`, `regionalReferenceLabels: ["WASSCE"]`), not a copy of
staging's current stale row.** Recommend a separate, small, explicitly
authorized staging correction (a 2-column `UPDATE` on 1 row, matching the
seed script's own already-reviewed intent) before or alongside the next
pass, so staging and its own source code agree.

## Allowlist

### A — schema only
13 tables + `EvidenceSpecificity` enum + `regionalReferenceLabels` field.
No rows — created by the 3 P2-C schema migrations.

### B — canonical reference data: 4 WAEC exam frameworks
**4 rows**, not 5 — see Action 2 decision below.

| Code | Level | examAliases (production) | regionalReferenceLabels (production) |
|---|---|---|---|
| `WAEC.LIBERIA.LPSCE` | PRIMARY | `[]` | `[]` |
| `WAEC.LIBERIA.LJHSCE` | JUNIOR_SECONDARY | `[]` | `[]` |
| `WAEC.LIBERIA.LSHSCE.REGULAR` | SENIOR_SECONDARY | `[]` | `["WASSCE"]` |
| `WAEC.LIBERIA.LSHSCE.PRIVATE` | SENIOR_SECONDARY_PRIVATE_CANDIDATE | `[]` | `[]` |

**Excluded (Founder decision, Action 2):** the 5th, superseded merged pilot
row (`code: WAEC.LIBERIA.LSHSCE`, `createdAt: 2026-08-17T17:14:33.186Z`,
no suffix) — current canonical Liberia structure is 4 frameworks; this row
predates the split and is preserved in staging/history only, never
promoted to production.

Idempotency: upsert keyed on `code` (matches `scripts/p2c-staging-exam-framework-seed.ts`'s
own pattern — `code` is the framework's stable, human-legible identifier,
not the cuid `id`, so a production seed script can re-derive the same
logical rows deterministically without depending on staging's literal
`id` values). Authority: WAEC Liberia's own public exam pages, live-fetched
and cited by URL in each framework's linked `CurriculumAuthoritySourceVersion`.

### C — source authority registry
**7** `CurriculumAuthoritySource` rows, **7** `CurriculumAuthoritySourceVersion`
rows (fresh count). Real URLs, real SHA-256 hashes of the actual fetched
MOE/WAEC pages/documents, per `docs/research/P2C_EVIDENCE_MANIFEST.md`.
Idempotency: upsert keyed on `canonicalUrl` (source) /
`(sourceId, contentHash)` (version) — matches the seed script's own
resolution logic.

### D/E — WAEC/MOE metadata
**18** `AssessmentBaselineSubject` rows, **17** `MoeCurriculumObjective`
rows, **16** `AssessmentBaselineCompetency` rows — fresh count, all 16
still `SUBJECT_LEVEL` (`evidenceSpecificity` groupBy: `{SUBJECT_LEVEL: 16}`),
none upgraded to `TOPIC_LEVEL`. Idempotency: upsert keyed on each model's
own `code` field (subjects/competencies) or the stable objective code MOE
publishes (objectives).

### F — representative pilot mapping
**1** `CurriculumBaselineAlignment` row (the Math G9 Two-Set-Problems
alignment, honestly `SUPPORTING/PARTIAL/UNKNOWN`, never overclaimed to
`DIRECT`/`MEETS_BASELINE`), **2** `CurriculumLearningTarget` rows (mastery +
extension). Idempotency: upsert keyed on the `(moeObjectiveId, competencyId)`
pair for the alignment, `(objectiveId, targetType)` for learning targets.

### G — AI reviewer/agent records
**0** — nothing to seed. Zero rows have ever been persisted from the AI
SME review path; confirmed zero live consumers of these tables outside
`scripts/`/`__tests__/` this entire session.

### Not seeded — categories that must never reach production

| Category | Content | Row count in staging (informational only) |
|---|---|---|
| H — proof/test fixtures | `p2c-live-ai-sme-proof.ts`, `p2c-live-dedup-proof.ts`, `p2c-distributed-dedup-proof.ts`, `p2c-reconcile-ai-proof-telemetry.ts` output | n/a — these don't create P2-C schema rows, only `AIInteraction`/`AiInteractionLog` telemetry |
| I — staging AI telemetry | `AIInteraction`/`AiInteractionLog` rows tagged `route=curriculum.waecBaselineAlignment` + `requestType=p2c_live_ai_sme_proof`, or `route=p2c.dedupClosureProof`/`p2c.distributedDedupProof`/`p2c.distributedDedupProof` | ~40+ rows across both tables this session alone |
| J — test users | none found matching this description in P2-C's scope | 0 |
| K — test curriculum mappings | none beyond the legitimate Math-pilot mapping already counted under F | 0 |

`curriculumCompetencyCoverage`: **0** rows in staging — correctly nothing
to seed (no CurriculumContent coverage has been reviewed/accepted yet).
`examPreparationProfile`, `policyConfig`, `policyOverride`,
`curriculumAlignmentValidityEvent`: **0** rows each in staging — nothing to
seed for any of these tables.

## Rights / provenance summary

Every category B–F row traces to a real, cited, hash-verified source
document or live WAEC/MOE web page (see
`docs/research/P2C_EVIDENCE_MANIFEST.md` and
`docs/research/WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md`) —
nothing in this manifest is synthetic or AI-generated. All rows are
deterministically re-derivable from those source documents by re-running
the (corrected) seed scripts, not staging-specific random IDs — production
seeding should mint its own `id` values via the same `cuid()` default
Prisma uses, keyed for idempotency on the stable business fields noted
above, not by copying staging's literal `id` strings.
