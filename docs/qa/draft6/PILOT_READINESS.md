# Draft.6 review and pilot readiness

All six candidates remain exactly `4.0.0-draft.6`. The founder reports conditional AI academic acceptance for geometry, fractions, multiplication, science and English. This does not assert human subject-expert review, MOE/ontology approval, rights clearance or release authorization. Civics requires real-map integration and verification. No candidate is officially publishable on the evidence available here.

| Lesson | Grade | Package SHA-256 | Academic status | Controlled pilot | Official publication |
| --- | --- | --- | --- | --- | --- |
| g7-math-area-perimeter | 7 | `86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254` | Conditional AI acceptance | Inactive, remaining gates | Blocked |
| g7-math-fractions | 7 | `ffaafcbb124def71114178a07736acf7c3609aa1debf36e413b4bdf1a5aae69a` | Conditional AI acceptance | Inactive, remaining gates | Blocked |
| math-multiplication-models | 5 | `7a469baccfb5d7d1e932942baf013e1848579c4efa9077a949dcebb7542d75ce` | Conditional AI acceptance | Inactive, remaining gates | Blocked, synthetic source binding also pending |
| g7-science-states-of-matter | 7 | `7863152eba2e51b818a1b304fa0b240f7b0ac0d2656406947488fbc93ae912f9` | Conditional AI acceptance | Inactive, remaining gates | Blocked |
| g7-english-reading-evidence | 7 | `fa54d6f4d508a81020bcf18c906a948a8c1c0e74ec1f384aa9c088acb289be19` | Conditional AI acceptance | Inactive, remaining gates | Blocked |
| g7-civics-counties-capitals | 7 | `2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb` | Map integration and academic verification pending | Excluded in code | Blocked |

The [original RELEASE_HANDOFF.md](RELEASE_HANDOFF.md), candidate files and all hashes are preserved. The original portable ZIP is 918,711 bytes with 80 entries, SHA-256 `8cae4476353404577225f4f18c70ab4731450b39ba3cb9e87290855861440625`. CRC, every archived entry digest and matching repository bytes were verified again. It contains complete scenes, formative questions/options/keys, expected reasoning, misconception feedback, diagrams/SVG source, objectives/task bindings, source mappings/references, licences/attributions and package/file hashes. It excludes protected independent Assessment V2 keys. Rights references are documentation, not rights clearance. An identical copy is at `C:/liberia-learn/artifacts/draft6-academic-review/4.0.0-draft.6-academic-review.zip` for the founder to attach.

## Reusable factory verification

The corrections reside in executable versioned factory modules, not edits to the six JSON packages alone. `buildDraft6` calls the reusable reference builder with DRAFT6_PROFILE and the versioned `authorLesson` recipe; `authorLesson` calls `validateAcademicCandidate` before returning. Package building runs those validators again, exports objective/task coverage and written-response guidance, and hashes every output. The authoring modules generate the representations, tasks, diagrams and reviewer export. `rational.ts` separates exact rational equality from explicitly requested rounding.

The existing 31 draft.6 regression tests rebuild every package byte for byte, rebuild draft.4/draft.5 to prove compatibility, verify input pins, rerun without changing mtimes, and mutate generated candidates to prove rejection of bad physics, missing state properties/freezing practice, copied guided examples, omitted multiplication cross-products, invented quotations and conflated direct/consequence evidence. This is evidence for these versioned recipes and demonstrated regression patterns. It is not proof of unrestricted subject generation or academic correctness for arbitrary new lessons. No generation logic or package correction was changed during this pilot task, and no draft.7 was generated.

## Pilot URLs

These are prepared relative paths, not activated public links:

- `/learn/preview/factory@4.0.0-draft.6@g7-math-area-perimeter`
- `/learn/preview/factory@4.0.0-draft.6@g7-math-fractions`
- `/learn/preview/factory@4.0.0-draft.6@math-multiplication-models`
- `/learn/preview/factory@4.0.0-draft.6@g7-science-states-of-matter`
- `/learn/preview/factory@4.0.0-draft.6@g7-english-reading-evidence`

Civics selections always fail pilot admission. The corresponding read-only API is `/api/student/learning-preview/[key]`. Both HTTP boundaries normalize one remaining URL-encoding layer after Next routing, then enforce the canonical exact grammar. Next may already have normalized a layer; encoded wire spellings still bind the identical version and package hash. Unknown versions, unresolved escapes, malformed keys and package tampering have no fallback.

## Remaining release gates

Local validation on the final implementation:

- Full unit run: 825 test files passed, three skipped; 8,444 tests passed, 30 skipped. The opt-in real DB suite ran separately.
- `validate:changed` passed: 29 new focused assertions, 154 related assertions, API route-policy audit and TypeScript.
- Factory-focused suite: 161 tests passed, including the 31 immutable draft.6 generation/regression tests and the real isolated DB suite.
- Production build exited 0. Both preview routes trace all 61 draft.6 files. The Windows standalone-copy warning remains a clean-packaging gate.
- Renderer chunk CI gate passed. OS-vault security tests passed four tests with two Windows symlink cases skipped. Full browser fixtures passed, including accessibility and fullscreen navigation. Desktop/mobile PWA CI tests passed all 14 tests on the final build.
- Authenticated Chromium against the verified isolated database passed with the real player. Practice remained on generated-2 through offline recovery. Encoded HTTP selections retained the same exact identity; malformed/unknown-version selections and Civics were denied. Revocation returned 404 and removed the open player in 1,412 ms. No page errors, write requests or official-record changes were observed. This is runtime evidence for Geometry; per-lesson runtime/accessibility review for the other eligible hashes is still required.
- The original ZIP and all receipt-bound draft.6 files passed raw-byte checks again. No package or original handoff diff exists.

Machine evidence is [PILOT_VALIDATION.json](PILOT_VALIDATION.json). Reproduction scripts and local logs/screenshots are identified there and in the runbook. Hosted CI was not triggered because pushing is not authorized.

The recommendation is HOLD for activation. Complete the [runbook checklist](CONTROLLED_PILOT_RUNBOOK.md) and record genuine exact-package pilot authorizations, review references, current cohorts and finite windows before requesting founder activation. Claude Code acknowledged the supplied interface in an [actual read-only AI review](CLAUDE_PILOT_REVIEW.md); the concrete progress, derived-validation and heartbeat findings were addressed. Final frontend-owner integration and runtime/accessibility review remain pending. The [coordination handoff](../../architecture/content-factory/DRAFT6_PILOT_CLAUDE_COORDINATION.md) is also copied to the existing shared coordination directory. No human approval is inferred from that response.

The dependency audit reports 124 findings: seven critical, 85 high, 30 moderate and two low. No dependency manifest or lockfile was changed. These findings require security disposition before activation. Windows production compilation completed with a standalone symlink-copy warning caused by the existing node_modules junction; clean Linux packaging/hosted CI remains a gate unless independently verified. Local test results must not be represented as a hosted CI pass.

Official publication additionally retains the original per-package blockers: exact-revision qualified human review, MOE objective/ontology release binding, applicable legacy comparison, rights review, governed independent assessment reconciliation, evidence/retention policy and full accessibility/runtime certification. The pilot creates none of those events and weakens none of those checks. Fractions typed-rational integration remains outside this PR; Civics' accessible geographic delivery remains outside it as well.
