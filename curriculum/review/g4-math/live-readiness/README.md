# Grade 4 Math live readiness (prepared, not executed)

Prepared 2026-09-26 on `main` 369cc4e1. **Nothing in this folder has been run against production.** Every write below needs explicit founder authorization at the time it runs.

Production = Supabase project `bnphuinpvgpmebcsvmsp`. Note: `.env`, `.env.local` and `.env.production` **all** point at production. There is no local or staging default. Any script run from this repo with those files loaded touches production.

## 1. Fractions lesson publication

| Item | Value |
|---|---|
| Lesson | `ll-g4-math-fractions-equal-parts-2026.1` version `1.0.0`, "Fractions as Equal Parts" |
| Source | `lib/curriculum/authority/grade4FractionsLesson.ts` at `main` 369cc4e1 |
| Payload sha256 | `3138edc3d4f8880fe91724c6857ab1f02b976cb8800b7f89cec466bee337f447` (`sha256(JSON.stringify(payload))`) |
| Bound by | release `lr-moe-g4-math-fractions-2026.1`, identity `de256495ec6f72fe8160179331c7f891d0574a2087a21163fbe28b93f9d88540` (unchanged) |
| Script | `scripts/author-grade4-fractions-authority.ts` (canonical workflow: `createCurriculumContent` + `appendCurriculumGovernanceEvent`) |
| Writes to | `DATABASE_URL` via `lib/db.ts` (not `DIRECT_URL`) |

**Preconditions, verified read-only 2026-09-26:**
- No `CurriculumContent` row with this contentId (0 rows).
- No `CurriculumContentRevision` with idempotency key `curriculum:ll-g4-math-fractions%` (0 rows).
- Standard `LR-MATH-G4_6-02` exists (`cmlly543o0006vonc0bbpm41z`, "Add, subtract, and compare fractions and decimals").
- Skill `placement-skill-MATH-G4_6` exists.

**Reviewer identity input:** `LIBERIALEARN_FOUNDER_REVIEWER_ID` = the founder's own `User.id`. It is recorded as actor, author and reviewer: `approvalBasis HUMAN_REVIEW`, `reviewAuthority PLATFORM`, `reviewerRoleSnapshot FOUNDER_CURRICULUM_REVIEWER`, `reviewerQualificationRef founder-reviewer:<id>`. It must be a human who actually reviewed the lesson (see `../unit-3.md` §3.4). Check it first:

```sql
select id, email, role from "User" where id = '<founder user id>';
```

**Command (founder runs it, after reviewing):**

```bash
DATABASE_URL="$(grep '^DATABASE_URL' .env.production | cut -d= -f2- | tr -d '"')" \
LIBERIALEARN_FOUNDER_REVIEWER_ID=<founder user id> \
npx tsx scripts/author-grade4-fractions-authority.ts
```

Expected result: one `CurriculumContent` row (`status published`, `visibility public`, `schoolId null`), a `CurriculumProvenance` (`VERIFIED`), one `HUMAN_CREATE` revision, and governance events `SUBMITTED` then `APPROVED` (HUMAN_REVIEW / PLATFORM). This is **not** MOE approval. The lesson becomes visible to Grade 4 learners.

Idempotent: all three writes carry idempotency keys (`curriculum:ll-g4-math-fractions-equal-parts-2026.1:{1.0.0,submitted,approved}`), so a re-run after a partial failure does not duplicate.

**Verification query:**

```sql
select c.id, c."contentId", c.status, c.version, p."lifecycleState", p."provenanceCompleteness", p."currentRevisionId",
  (select array_agg(e."eventType"::text || ':' || coalesce(e."approvalBasis"::text,'') order by e."occurredAt")
     from "CurriculumGovernanceEvent" e where e."revisionId" = p."currentRevisionId") events
from "CurriculumContent" c join "CurriculumProvenance" p on p."curriculumContentId" = c.id
where c."contentId" = 'll-g4-math-fractions-equal-parts-2026.1';
-- expect: status published, lifecycle APPROVED, completeness VERIFIED, events {SUBMITTED:, APPROVED:HUMAN_REVIEW}
```

**Rollback / recovery:** never delete (governance history is audit data). Append a `REVOKED` event through `appendCurriculumGovernanceEvent` with a reason and all consequence policies: `futureAssignmentPolicy BLOCK_NEW`, `existingAssignmentPolicy WITHDRAW_EXISTING`, `offlineCachePolicy URGENT_INVALIDATE_ON_NEXT_REFRESH`, `actorType USER`, `actorUserId` = founder. Status becomes `REVOKED` and the lesson leaves learner view. `REINSTATED` (HUMAN_REVIEW) reverses a revocation. There is no dedicated revoke script yet; it's a one-call use of the governance writer.

## 2. Learning target `LR-MATH-G4_6-02`

| Item | Value |
|---|---|
| Payload | [`lr-math-g4_6-02.target.json`](lr-math-g4_6-02.target.json) |
| Provenance | MOE source version `cmt1nt69k0002vopsjrim1ejv` (Math 1-6.pdf p.42); structured objectives p3-obj4, p3-obj5; release id + identity; Standard `LR-MATH-G4_6-02` |
| Expected binding | `curriculumRevisionId` = the published fractions lesson's current revision (resolved at apply time). `moeObjectiveId` stays null: production has no Grade 4 `MoeCurriculumObjective` rows |
| Script | `scripts/seed-g4-learning-target.ts`: dry run by default (read-only transaction); `--apply` also requires `CONFIRM_PRODUCTION_WRITE=LR-MATH-G4_6-02` |
| Order | only after §1. The script refuses if the lesson is missing, not `published`, or lacks a HUMAN_REVIEW approval on its current revision |

Dry run today returns `precondition_failed: ll-g4-math-fractions-equal-parts-2026.1 is not in the database`, which is correct.

```bash
DIRECT_URL=<prod direct url> npx tsx scripts/seed-g4-learning-target.ts                       # dry run
DIRECT_URL=<prod direct url> CONFIRM_PRODUCTION_WRITE=LR-MATH-G4_6-02 npx tsx scripts/seed-g4-learning-target.ts --apply
```

**Verification query:**

```sql
select id, code, version, grade, subject, "targetLevel", "verificationStatus", "curriculumRevisionId", "platformVersion"
from "CurriculumLearningTarget" where code = 'LR-MATH-G4_6-02';
-- expect one row, version 1, curriculumRevisionId = the lesson's currentRevisionId
```

**Rollback:** nothing references the new row at creation (`coverageMappings` empty), so it can be deleted by id if created in error. After anything references it, retire it with a superseding version (`supersedesTargetId`) instead.

**Runtime impact:** no runtime code reads `CurriculumLearningTarget` by this code today; only the template-cell certifier checks it. It's a traceability record, not a runtime blocker.

## 3. Live certification checklist

Run after any promotion: re-snapshot (`scripts/curriculum-cleanup-snapshot-v1.ts`, read-only), then `npx tsx scripts/certify-template-cell-v1.ts --live-gate` (exit 1 unless every check passes). Current results are in `artifacts/template-cell-v1/G4_MATH_TEMPLATE_CELL_V1.md`.

| Check | Now | What makes it pass |
|---|---|---|
| 44/44 objectives have reviewed governed lessons | FAIL (1/44) | founder review of each draft, then promotion (below) |
| classwork / homework / practice resolve from governed sources | FAIL (0/44 all three) | promoted lessons carry them; the fractions lesson lacks a practice set |
| quiz / diagnostic / exit assessment resolve from governed sources | FAIL (0/44 all three) | promoted lessons + governed items; the fractions lesson has no quiz |
| evidence bindings resolve | PASS | |
| ToolPolicies resolve | PASS | |
| interaction classifications resolve | PASS | 4 needs have no Grade 4-6 online tool (offline fallback only) |
| offline behavior valid | PASS | |
| release references resolve in production | FAIL (lesson + target missing) | §1 then §2 |
| no draft treated as governed | PASS | enforced by the certifier and inventory builder |
| no MOE approval claimed | PASS | |
| internally executable | PASS | |

**Promotion path for a reviewed draft (not built yet; founder decision):** a draft becomes governed only when (a) the founder's ledger decision is APPROVE, (b) it's published through the canonical workflow with HUMAN_REVIEW by the founder, and (c) it's bound in a **new release version** (`2026.2`). That release adds one concept per objective, governed items built from the lesson's quiz/diagnostic/assessment, and evidence and tool policies. Release `2026.1` must stay unchanged because its identity hash is stored in learner evidence.

## 4. Adaptive-intelligence handoff (PR #149)

Contract: `governed-cell-inventory/1.0.0`, built by `buildGovernedCellInventory(GRADE4_MATH_TEMPLATE_CELL, GRADE4_MATH_ONTOLOGY_RELEASE)` in `lib/learning-authority/governedInventory.ts`. Current output: `artifacts/template-cell-v1/g4-math-governed-inventory.json`.

- `activities[]`: the only valid orchestrator candidates (release items + bindings). Maps 1:1 onto `governed-learning-evidence/1.0.0`: `objective.conceptId` = `conceptId`, `objective.objectiveId` = `objectiveId`, `activity.activityId/activityVersion` = release item id/version, `evidenceType` = `DIAGNOSTIC|PRACTICE`, `curriculum.ontologyReleaseId/Identity` = inventory `releaseId/releaseIdentity`, `strength.policyRef` = `evidencePolicyId`.
- `lessons[]`: governed lessons only (today one, not yet live).
- `uncoveredObjectiveIds[]`: 42 MOE objectives with no governed concept. The orchestrator must return `NO_VALID_RESOURCE` for them, never a draft.
- `objectiveId` for extension concepts is `LIBERIALEARN_EXTENSION:<conceptId>` (today `g4-fractions-compare`), so they're never reported as MOE-aligned.
- `excluded.draftLessons` (43) is a count only; draft ids and content aren't in the contract.

PR #149's build is currently failing on its own branch. After it's repaired, it should replace its compatibility fixture with this inventory. No intelligence code changes are made here.

## 5. Founder decisions

1. Review the fractions lesson (`../unit-3.md` §3.4) and, if approved, run §1 yourself with your own user id.
2. Target `LR-MATH-G4_6-02`: seed it (§2), and choose `verificationStatus` PARTIAL vs VERIFIED and the code namespace. Or leave it unseeded, since nothing at runtime needs it; the certifier's release-live check then stays failing.
3. Review the 43 drafts in batches and record decisions in `../review-ledger.json`.
4. Authorize building the `2026.2` release and promotion tooling for approved drafts.
5. Resolve the flagged scope questions (fraction addition/subtraction depth, LCM/GCF method, customary units, 'medium' = median).
6. Decide whether the fractions lesson should gain a practice set and quiz (currently missing) before it is published.
