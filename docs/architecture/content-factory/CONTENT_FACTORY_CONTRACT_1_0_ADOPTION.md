# Explicit first-ten contract 1.0.0 adoption

This patch adopts the user-designated contract at `ac196397cb13bd6866879c9f5c24503e5195c61d`. It changes factory intake metadata and validation, not the contract, lesson content, publication state or educational authority.

The immutable contract mirror is `curriculum/factory-v2/contracts/1.0.0/`. Its raw manifest SHA-256 is `4cb6fb5588f5f840fe8b702f181a051a5838b093c1db82b0ea14d9c4b64ea549`; spec SHA-256 is `648ec61a72e2ddff147444dadae75aff321866cfc660498a792b6a3b48e7a28b`. The adoption generator verifies all 29 original manifest-pinned Git objects before writing the mirror. Runtime intake verifies the manifest, spec, source bindings, baseline and E1 against fixed pins. The E1 handoff document is preserved byte-for-byte at `d640b6fcb9e102b0a06a9d49a136a0aca6948a8f`; the policy ID, version and intervals are unchanged. This does not activate retention or offline independent mastery.

All ten logical IDs, database IDs, revisions, revision numbers, snapshot hashes, subjects, grades and ordering are unchanged. Historical 0.1.0 baseline/adoption/requirements/template bytes are archived under `curriculum/factory-v2/contracts/0.1.0/`; the original baseline hash remains `df374decf615a66d2fc5a92b0530b9bb798a9d1d17190f414b2668144e272b8a`.

Factory intake and authored-subset transport versions advance to 2.0.0. New empty authoring templates use candidate version 0.2.0 and cohort commit ac196397. Their requirement lists are derived from the exact 1.0.0 specification. This is an explicit adoption, not an in-place edit to either contract version or an existing immutable candidate slot.

Existing restricted authored inputs still name cohort 9628d97f. They deliberately fail the new cohort gate. The authoring owner must produce separately versioned 1.0.0-cohort inputs, preserving the original files and review history, and check their content against the new requirements. Merely changing the cohort field is insufficient. All bodies, assessments, keys, rubrics, visuals, references and bindings must be reviewed against the adopted contract. No restricted authored input was read or rewritten by the adoption generator.

The three selected lessons remain Civics `wk_mca7a_fri_p4`, Science `wk_mca7a_fri_p3` and Math `lesson_mca_1`. The other seven remain unselected. Governed runtime bindings and the Civics SVG adapter remain required. This patch does not waive runtime, normalized-inventory, independent review or qualified-human approval gates and does not generate candidates.

The Content Factory owner must supply the three immutable review-package paths and package/manifest hashes only after the real runtimes and new authored inputs satisfy the gates. Also supply exact runtime IDs/versions/hashes, learner-only projections, preview registration and unchanged-rerun receipts. Public handoff metadata must exclude protected keys, rubrics and learner data. No paths or hashes have been invented.

`scripts/adopt-first-ten-contract-v1.cjs` reproduces metadata adoption from fixed Git objects; `scripts/content-factory-v2-refresh-v1-templates.ts` regenerates only empty templates. The normal CLI reads the checked local contract mirror, so a shallow checkout does not require an unadvertised Git object or permit an arbitrary `--spec` to replace the pin. Existing source and dependency-count verification still applies to the read-only export.

Academic outcome remains **BLOCKED FOR ACADEMIC APPROVAL**. Adoption grants no approval, release, publication, score, grade or mastery.
