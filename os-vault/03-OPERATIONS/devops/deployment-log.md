# Deployment Log

> Log every production deployment here. Format: Date | Version | Description | Status

## Format
```
## YYYY-MM-DD — [version or branch] — [description]
**Status:** Success / Partial / Rolled back
**Deploy method:** Vercel auto-deploy (git push) / Manual CLI
**Test count:** [N] tests passing at deploy time
**Notable:** [anything worth knowing — new migrations, flags changed, etc.]
```

---

## 2026-03-01 — v1.0.0 — Initial Production Release
**Status:** Success
**Deploy method:** Git push → Vercel
**Test count:** 921 tests
**Notable:** First production release. Includes MOE portal (5 routes), disaster recovery scripts,
30 engineering blocks. Migrations: 20260228_block26_perf_indexes + 20260301_000001_moe_official_role applied.

---

## 2026-03-XX — Post-v1.0.0 Hardening Commits
**Status:** Success (multiple incremental deploys)
**Deploy method:** Git push → Vercel (auto-deploy)
**Test count:** 2712+ tests at sprint 5 school events milestone (2026-05-12)
**Notable:** RR-1 through RR-7, Sprint 15–16C, Phase 5.1–5.3.1, trust indicators sprint, pre-reviewer audit fix sprint.

---

[Add new entries above this line as deploys happen]
