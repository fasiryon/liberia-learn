# First Ten: Curriculum Excellence Handoff V1

This is the Curriculum Excellence response to the first-ten workstream handoff request ([issue #196](https://github.com/fasiryon/liberia-learn/issues/196)). It is not part of the hashed contract (see the manifest), so it can be updated without changing the contract digest.

## Integration designation

| Item | Value |
|---|---|
| Branch | `docs/modernization-first-ten-spec-v1` (local; not pushed) |
| Contract commit | `ac196397cb13bd6866879c9f5c24503e5195c61d` |
| Base | PR #195 head `3e4ba71df9f462d273fe3be1e1bb585aea30c8c0` (itself on PR #191) |
| Contract | `curriculum/modernization/v1/first-ten/spec.json`, `liberialearn-first-ten-modernization-contract/1.0.0`, raw-bytes SHA-256 `648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b` |
| Lesson contract | `liberialearn-first-ten-lesson-contract/1.0.0` |
| Manifest | `curriculum/modernization/v1/first-ten/manifest.json`, SHA-256 `4cb6fb5588f5f840fe8b702f181a051a5838b093c1db82b0ea14d9c4b64ea549` (pins every contract file and advisory review) |
| Status | `READY_FOR_OWNER_APPROVAL` (not approved) |
| Prior version | 0.1.0 at `9628d97f6932ae4c0c399ec15455230e3f76607e` (spec SHA-256 `9b0128d7…`), accepted by Curriculum Excellence as the V1 cohort baseline. Source IDs and revisions are unchanged and asserted literally. |

## Ten real lessons

All ten are bound to the read-only extract `7d5e25cb…` (captured 2026-10-16). Every snapshot hash was recomputed with `hashCurriculumSnapshot`. **No candidate has been authored for any of them.** Candidate IDs and versions are therefore deliberately absent: there are no `UNSELECTED` slots and no synthetic substitutes.

| # | contentId | databaseId | revisionId | snapshot SHA-256 | Grade · subject | Candidate | Review status |
|---:|---|---|---|---|---|---|---|
| 1 | `wk_mca7a_fri_p4` | `cmm7xs89200e9vo70t6qdlgho` | `cmss8ptit002jvo540275dfvw` | `c7a1257c…` | G7 CIVICS | none | diagnosis: AI advisory, confirmed 6/6; human: not started |
| 2 | `wk_mca7a_wed_p4` | `cmm7xs4ez00dzvo703kixnumu` | `cmss8poxb001fvo544mp6ebop` | `744f8d1f…` | G7 CIVICS | none | advisory 7/7; human: not started |
| 3 | `hero-civics-g7-democracy-and-representation-in-liberia` | `cmpzniahk001dvon4p327wkgz` | `cmss94h3z03bzvo54hj7c7z8t` | `cca45669…` | G7 CIVICS | none | advisory 7/7; human: not started |
| 4 | `wk_mca7a_fri_p3` | `cmm7xs7v000e8vo70m7n72h3t` | `cmss8pt0j002fvo54be8gcrnd` | `d218a3e1…` | G7 SCIENCE | none | advisory 6/6; human: not started |
| 5 | `science-g5-plants` | `cmlpe4i9w0002vofgss8b2049` | `cmss8mp3p0007vo1wqsa620v2` | `ba219ffc…` | G5 SCIENCE | none | advisory 6/6; human: not started |
| 6 | `hero-math-g7-geometry-area-and-perimeter-of-polygons` | `cmpyg7yx6003avoqgrqwkw7id` | `cmss9493703a7vo54xxnhxmjy` | `31416f12…` | G7 MATH | none | advisory 7/7; human: not started |
| 7 | `lesson_mca_1` | `cmlrkjnow00dmvo7o4cajgquf` | `cmss8mpl0000bvo1wos7i1ew4` | `872222a2…` | G7 MATH | none | advisory 5/5; human: not started |
| 8 | `hero-math-g2-place-value-tens-and-ones` | `cmpyfel1o000xvopge4q6bboh` | `cmss946is039nvo54is10v1t4` | `78437ada…` | G2 MATH | none | advisory 5 confirmed, 1 disputed (D6, restated); human: not started |
| 9 | `wk_mca7a_mon_p2` | `cmm7xrzxj00dnvo70sxga6kgz` | `cmss8pj580003vo54iiun3f8s` | `d1767e29…` | G7 LITERACY | none | advisory 5/5; human: not started |
| 10 | `hero-english-g7-vocabulary-in-context-reading-west-african-texts` | `cmpznzads0044von4w059zpm1` | `cmss94i4b03c7vo54sblilk60` | `d224500e…` | G7 ENGLISH | none | advisory 5/5; human: not started |

Full hashes are in `source-bindings.json` and `spec.json`.

## Review evidence, by kind

- **Engineering:** deterministic tests and checks (below). No human engineering review has been recorded on this branch.
- **Academic, advisory:** three independent AI reviewers (same model family as the author) each did a blind diagnosis before seeing the spec, then gave per-defect verdicts with sources. The files are in `curriculum/modernization/v1/first-ten/advisory-reviews/`, hashed in the manifest. They confirmed 59 of 60 defects and found further defects, which the author verified before adoption. Every record carries `countsAsIndependentReview: false`.
- **Academic, qualified human:** **none yet.** No ledger `REVIEW_RECORDED` event exists for this cohort. Human review must use `FIRST_TEN_ACCEPTANCE_RUBRIC_V1.md`, starting with the six correction-notice lessons (ft01, ft02, ft03, ft04, ft06, ft07). Advisory review now also recommends notices for ft05 and ft10.

## Tests bound to `ac196397`

Run from a clean tree at that commit:

```sh
npx vitest run __tests__/library-modernization                      # 6 files, 139 tests passed
npx tsx scripts/render-first-ten-modernization-spec.ts --check       # current
npx tsx scripts/build-first-ten-manifest.ts --check                   # current, sha256 4cb6fb55…
npx tsx scripts/verify-first-ten-source-bindings.ts <extractDir> --check  # 10 bindings verified (needs the gitignored extract)
npx tsx scripts/verify-library-modernization-ledger.ts               # problems: [] (no events appended)
```

A focused `tsc --noEmit` over the new TypeScript files passed. The full repository suite and full `tsc` were not run on this branch.

Content Factory compatibility probe: a read-only run of the factory's own zod schemas at `d1f1826cb`, inside its worktree, passed 8 of 8 checks. Its `git status` was unchanged. The results are recorded in `spec.json` under `factoryCompatibility`.

## Changed files since the 0.1.0 baseline

`spec.json`, `source-bindings.json` (new), `manifest.json` (new), `advisory-reviews/` (20 files, new), the specification and rubric documents, `lib/curriculum/modernization/firstTen.ts`, `scripts/verify-first-ten-source-bindings.ts` (new), `scripts/build-first-ten-manifest.ts` (new), and `__tests__/library-modernization/first-ten-spec.test.ts`. No application, API, schema, migration or production code is touched.

## Blockers

1. **Owner approval** of contract 1.0.0, naming manifest `4cb6fb55…`.
2. **Qualified human reviewers** for all ten lessons, ACADEMIC and ASSESSMENT scopes at minimum, plus a second history expert for ft01–ft03. Not available in this workstream.
3. **Correction-notice decision** for 8 lessons (ft01–ft07 and ft10). No notice has been sent.
4. **Accepted read-only export** in `factory-production-capture/1.0.0` form, with authorization, target/role, visibility and privacy-review references (Content Factory B-CF1). It requires an owner-authorized operator capture. The #195 extract cannot stand in for it, and this workstream will not connect to production.
5. **Official Liberian sources.** No Government of Liberia county-capital list or NEC district count was retrievable. These corrections rest on consistent secondary sources plus the 1986 Constitution.
6. **Content Factory:** unit-blueprint 2.1.0 objective kinds are uncommitted in the factory worktree. The Civics authority mapping needs the factory owner's confirmation. The factory's draft `first-ten-baseline.json` pins 0.1.0 and must be re-pinned to the 1.0.0 bytes.
7. **Assessment V2 and learning loop:** the retention policy `ll-aep-001-retention-pilot@1.0.0` is owned by PR #193 (`feat/assessment-architecture-v2`, head `dd856850`, `lib/assessment/v2/retention.ts`), which is unmerged (see the erratum below). The attempt-bound assistance ledger does not exist yet, so lesson-side evidence stays assisted.
8. **Base PRs:** #191 and #195 are unmerged drafts, and this branch is stacked on them. Pushes stay held under the repository's preview-protection rule.
9. **Auditor calibration (#195):** the mechanical audit reported ft08's problem sets as unkeyed, but all 12 have keys (one leaks into a learner prompt). The audit should be corrected upstream; this contract restates the defect.

## Errata (apply in the next contract version)

These are recorded here rather than in `spec.json`, so that the 1.0.0 contract and manifest hashes offered for approval stay valid. Each will be applied when the contract next changes version.

| # | Field | 1.0.0 says | Correct | Verified |
|---|---|---|---|---|
| E1 | `retentionPolicy.statusSource` | `git:f1db1d26:lib/assessment/v2/retention.ts (feat/learning-loop-integration-v1, unmerged)` | `git:dd8568500:lib/assessment/v2/retention.ts`, PR #193 (`feat/assessment-architecture-v2`, unmerged) | `LL_RETENTION_PILOT_POLICY` (`ll-aep-001-retention-pilot`, status APPROVED) is defined at `dd856850`, an ancestor of the learning-loop head. Reported by the learning-loop owner, 2026-10-17. |

The erratum changes no policy id, version, interval or lesson field, and the learning-loop adapter's pins (`policyRef`, contract versions) are unaffected.

## Consumers pinned to 1.0.0

- Learning loop: `lib/learning-loop/v1/firstTenAdapter.ts` on `feat/learning-loop-integration-v1`. It reads `ac196397` and asserts the spec SHA-256 `648ec61a…`, and fails closed on any other contract version. `READY_FOR_OWNER_APPROVAL` maps to provisional, advisory-only coverage.

Nothing here merges, deploys, publishes curriculum, changes production data, or creates official grades or mastery.
