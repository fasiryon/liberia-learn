# P2-B AI SME Production Cutover Record

Date: 2026-08-14 UTC
Production: `bnphuinpvgpmebcsvmsp`

## Implementation

- Added explicit `AIReviewAgent` machine identity. No `User`, `ReviewerProfile`, or human credential is created for an AI model.
- Added immutable `CurriculumAIReviewAssessment` records with agent/provider/model/prompt/policy/rubric/revision/provenance/correlation snapshots.
- Added explicit AI actor semantics and `AI_PLATFORM_REVIEW` approval basis. AI can only create internal `PLATFORM` outcomes.
- Added independent subject SME, curriculum SME, and adjudicator configurations. AI never represents MOE, SCHOOL, WAEC, or human qualification.
- Added P2-B AI review execution through the existing task queue and routed AI provider/interaction logging path.
- Critical tasks fail closed. Provider fallback, invalid JSON, low confidence, and disagreement cannot approve content.

## Migration

- Staging migration applied and verified: `20260814_000002_p2b_ai_sme_review`.
- Migration SHA-256: `137F10D177DEAB4A4367A383B43A5CFD493111BB361AD815139047CB5D597725`.
- Production migration applied over the verified session pooler after a fresh recovery point.
- Production recovery point: `2026-08-14T21:28:49Z`, SHA-256 `DA01A7167548684DF64BEA4D2D00405E704A0AF7B02386072D26558C7D699744`, disposable PostgreSQL 17 restore PASS.
- Human P2-B migration ledger remains canonical; no destructive DDL or P2-A history rewrite.

## Validation

- Staging human P2-B regression: all 33 scenarios PASS after the AI schema change.
- Staging AI fixture: two independent AI assessments created with immutable lineage; provider fallback produced confidence 0 and `ESCALATE`; no approval or P2-A event was created.
- Production deployment with the AI code: Ready deployment `dpl_AfLEWMKKL1MBGTJjgDApwwwfrR9c`, health HTTP 200.
- Production machine agents provisioned: subject SME, curriculum SME, adjudicator, all enabled in the database. No human credentials created.
- Production canary: exact current revision, STANDARD PLATFORM task, two independent assessments, fail-closed `ESCALATED`, no decision/governance event.

## Activation result

- Production human P2-B operations remain disabled.
- The independent AI flag was returned to `false` after activation deployment attempts encountered repeated Vercel API `ECONNRESET` failures before a new deployment could be created.
- Active production alias remains the Ready build with AI activation off. No learner-facing AI review approval was enabled.
- MOE, SCHOOL, and WAEC authority remain human/external-only and honest.

## Final status

**NO-GO for PLATFORM AI activation pending a successful Vercel deployment of the already validated build.** The schema, machine identity, lineage, fail-closed execution, staging regression, production migration, and production safety canary are complete. Retry deployment only after Vercel API connectivity is stable; then verify AI flag, route health, and one controlled canary before enabling ordinary PLATFORM AI review.
