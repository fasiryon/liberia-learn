# V4 R7 factory loading repair

Implementation commits: `d0428bed8e558e783c1c4dae1cda12e694c8a788` and `ecc454e58eac759c98b7a672ddf4583a58743558`, on `fix/v4-r7-factory-review`, based on `6ea703fcb`. T1 owns the companion UI in `aac0dbe3d` and its narrowing fix `d8711e5fa`. Chief of Staff owns the joined snapshot and independent tests. This session did not merge, push, deploy, publish content or modify student records.

The review loader accepts exact keys `factory@<version>@<lesson-key>`. Bare lesson keys remain hand-authored draft.1 references. Unsupported versions, unknown keys, traversal, missing files, invalid schemas, corrupt receipts, altered package bytes and mismatched projections reject without substitution. Receipt pins live outside the packages in `curriculum/factory-v4/review-pins.json`. Every manifest, package digest and file hash is checked before candidate parsing. UTF-8 must round-trip to the original bytes, including line endings. The loader checks blueprint/artifact bindings, the factory event chain and the sidecar's block digests, then uses the existing candidate parser, V4 standard, registry, player transformation and tool mapping. Reviewer provenance stays outside the player.

Changes are limited to factory generation, curriculum preview loading, tests, driver repair, new draft.5 packages and this evidence. The original recipe, reference-input manifest, frozen registry/candidate/instruction contracts, archived prompts and all 49 draft.4 files remain unchanged. `generation.ts` and `referenceBatch.ts` accept an explicit versioned recipe/input profile; their default still reproduces draft.4. Draft.5 has a separate recipe and source manifest. Its own player version is draft.5; draft.4 keeps its inherited draft.1 player stamp for immutability.

Geometry draft.5 uses a guided 8 m base, 3 m perpendicular height and 5/5 m sides, distinct from the worked 6/4/5/5 example. Its area is 12 square metres and perimeter 18 metres. An existing CHECK block and a written FREE_RESPONSE capture why the units differ. Actions and guidance name the actual measurements. Specific response patterns diagnose use of the sloping side for height, treating an interior height as a boundary, omitting half the triangle or half the rectangle boundary, and exchanging area and perimeter. A plausible fencing distractor replaces the old 'method is correct' option. The registry's automatic diagnoses retain precedence over authored matches; the browser also proves the authored slope-as-height feedback.

Civics draft.5 teaches a county-capital register. It contains no MAP_EXPLORER or geographic tile claims. Objectives and activities explicitly distinguish administrative names from geographic location, boundaries or road routes. All fifteen repository county-capital pairs are retained. Their names agree with the [UK PCGN government administrative-divisions paper](https://assets.publishing.service.gov.uk/media/5a81506ee5274a2e87dbcf2e/Liberia_Administrative_Divisions.pdf), pages 1â€“5, March 2015. This supplementary check is not qualified academic approval or a current Liberia-government attestation. No third-party map or artwork was reused; rights and curriculum review remain open.

Exact file, canonical candidate, canonical projection, manifest, package and receipt hashes for all eight factory selections are recorded in [v4-r7-validation.json](evidence/v4-r7-validation.json). Canonical JSON hashes differ intentionally from hashes of formatted JSON files.

| draft.5 candidate | candidate.json SHA-256 | Package hash |
| --- | --- | --- |
| `g7-math-area-perimeter` | `042aa2a6252258158b9ef4088f095cea23c5f2123027e7e938d1c0e78d9ab17b` | `7dedcc121174a439db4e3f3d38e04e3b705ff6362647f4afa59afd30ba2d0770` |
| `g7-civics-counties-capitals` | `6670ea90bb3d2d4d4dae6f46c85c5de8b4c9b9a51a9a48e4f74cd67c245b686b` | `1da85c7ac63953499cf3f6500cc7f3c34691c1e266d9fee71937c490c17074d9` |

Review routes, on a local development server with LAB_REVIEW_HARNESS=1 and an authorized synthetic reviewer:

- `/lab-review/v4-lessons`
- `/lab-review/v4-lessons/factory@4.0.0-draft.5@g7-math-area-perimeter`
- `/lab-review/v4-lessons/factory@4.0.0-draft.5@g7-civics-counties-capitals`
- `/lab-review/v4-lessons/factory@4.0.0-draft.4@<lesson-key>` for each of the original six packages
- `/lab-review/v4-lessons/<lesson-key>` for separate hand-authored reference fixtures

Local evidence at `C:/liberia-learn/.task-worktrees/v4-r7`:

- `npx vitest run __tests__/content-factory-v4`: 101 passed. Includes tamper/missing-file/version/source tests, raw line-ending tamper regression, exact projection comparison, content feedback, paper alternatives, protected-answer canaries, deterministic builds and retained mtimes.
- `npm run validate:changed -- --base 6ea703fcb --no-types`: passed, including 101 changed tests and 96 related tests. Full type validation requires the T1 companion and is recorded separately below.
- ESLint on changed TypeScript: zero errors. The generator entry was also checked with `--no-ignore`.
- Default draft.4 regenerated outputs match all committed bytes. A separate comparison against Git objects at `198edc566` confirms all 49 raw files are identical.
- `node scripts/content-factory-v4-browser.cjs --candidate-version=4.0.0-draft.4`: native exit 0; 7 runs, 46 scenes, zero page errors, writes, axe violations or reported overflow. Eleven axe checks remain incomplete for manual review.
- The equivalent draft.5 run: native exit 0; 3 runs, 20 scenes, zero page errors, writes, axe violations or reported overflow. Four manual checks remain.
- `--candidate-version=4.0.0-draft.5 --offline-after-load`: native exit 0; both lessons and phone geometry complete after the browser goes offline. The specific geometry misconception feedback assertion passes. This proves playback of already loaded lesson data; it does not certify cold service-worker installation.
- The normal tsx CLI encountered Windows sandbox `uv_os_get_passwd ENOMEM`. Bundling `scripts/content-factory-v4-draft5.ts` with installed esbuild and executing the Node bundle exits 0 and preserves the packages. No provider/network/database call is part of generation.

Joined TypeScript passes at `75f866065e14423b0df916c4db7162cabe0ffad0`, including both follow-up fixes. Log: `C:/liberia-learn/.task-worktrees/v4-final/artifacts/v4-final/tsc-75f866065.log`, exit 0.

Chief of Staff's independent actual-Next-route tests pass at `d0e434bbc350488c723a56b0c8098bd9b658f596`: draft.4 completes 11 runs / 74 scenes; draft.5 completes 7 runs / 48 scenes. Both have zero recorded browser writes, page errors, axe violations, overflow, block errors, payload canaries, non-empty governed items or database write statements. Gallery labels and invalid-selection rejection are checked on the actual route. Answers come from the selected shipped projection, and the page must present the corresponding generated scenes and accept those answers. The loader regression independently proves its returned object equals that projection; the T1 route passes that object directly to LessonPlayerV2. This provides the factory ? Next page ? actual player proof rather than substituting a Vite-only result.

Important test condition: these complete-route runs allow service workers and hide the single app-wide PWA lifecycle toast through test CSS. The earlier unsuppressed run failed at narrow widths because the fixed toast intercepted the second worked-example button. The reviewer bar and player sizing were not the cause. No force clicks or assertion weakening were used. The existing app-wide toast problem remains a known PWA issue; the responsive result does not certify that element. Source evidence and exact artifact hashes are recorded in the JSON ledger.

Production build passes at exact joined commit `75f866065e14423b0df916c4db7162cabe0ffad0`: `npm run build`, native exit 0. Prisma generation, compilation, lint/types, all 392 static pages and route tracing completed. It used no `.env.local`, one build CPU, no font mock and unreachable localhost database URLs. Log: `C:/liberia-learn/.task-worktrees/v4-r7-build/artifacts-r7-production-build.log`.

The compiled `next start` was tested on port 3221 with `NODE_ENV=production` and `LAB_REVIEW_HARNESS=1`. Both the index and exact draft.5 geometry route return 404 with no player marker, with and without a signed synthetic MOE_OFFICIAL reviewer cookie. The checker exits 0 and stops its own server. Evidence: `C:/liberia-learn/.task-worktrees/v4-r7-build/artifacts-r7-production-404.json`.

Build warnings are retained: existing lint/dependency/optional-service warnings, dynamic-route static-render bailout logging, and Windows EPERM copying the shared node_modules junction into standalone output. The standard build exits 0 and compiled next start works; this does not certify deployment of the incomplete Windows standalone copy. No packaging workaround or production configuration change was made.

Chief of Staff's independent full Vitest run at `d0e434bbc350488c723a56b0c8098bd9b658f596` also passes: 820 files and 8,395 tests passed; 2 files and 19 tests skipped; native exit 0. Log: `C:/liberia-learn/.task-worktrees/v4-final/artifacts/v4-final/vitest-full-d0e434bbc.log`. Their independent build rerun remains their own release-readiness step, and is not replaced by this report.

Safety boundaries: production and Vercel review gating stay unchanged. The package/loader/player path is file-only, but the existing root ConsentGate performs a consent SELECT for signed-in users. Real-route QA therefore uses only a throwaway local Postgres table and synthetic reviewer token. Never use the root `.env.local` production connection for these tests. The existing root next/font also attempts a Google Fonts build/dev fetch; complete-route evidence must disclose it. No factory code introduces a network or database dependency.

All packages remain reviewer-only DRAFT and REVISION_REQUIRED. Governed assessment resources, MOE binding, ontology release, qualified review, source-rights clearance and authorized restricted-key comparisons remain release blockers. The learner projection contains no governed assessment items; protected assessment forms cannot be inferred or fabricated to close those blockers.
