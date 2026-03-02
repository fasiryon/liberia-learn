# LiberiaLearn — Version History

## v1.0.0 — 2026-03-01

**Initial production release.**

### Summary

| Metric | Value |
|--------|-------|
| Tests passing | 921 |
| Production TypeScript errors | 0 |
| Database migrations | 20 |
| MOE standard codes | 53 |
| Strand catalog entries | 92 |
| Standard coverage | 94% (50/53) |
| Feature flags | 47 |
| API routes | ~80 |

### Blocks Shipped

| Block | Description |
|-------|-------------|
| 1–4 | Core platform: auth, multi-tenancy, audit |
| 5 | Ops intelligence |
| 6 | Governance exports |
| 7A | Mastery engine |
| 7B | Training center |
| 10 | AI endpoints (tutor, teacher assist) |
| 12 | Impact analytics + workflow intelligence |
| 14 | AI factory — curriculum generation |
| 16 | Predictive analytics (dropout risk, curriculum optimization) |
| 19 | Geo intelligence |
| 20 | National insights |
| 21 | Classroom toolkit |
| 22 | Tenant isolation guard + audit hardening |
| 23 | Composite DB indexes |
| 24 | N+1 elimination + query optimization |
| 25 | AI factory standards traceability |
| 26 | Performance hardening |
| 27 | Load acceptance harness |
| 28 | MOE Access Portal (MOE_OFFICIAL role + 5 oversight routes) |
| 29 | Disaster recovery (health check + rollback plan) |
| 30 | Release candidate verification + documentation |
| RR-1 | Enrollment invites |
| RR-2 | Guardian portal |
| RR-3 | Account recovery + AI factory remediation |
| RR-4 | MOE portal flag + allowlist |
| RR-5 | Demo mode |
| 32 (Parts 1–9) | Integrated lesson delivery engine |

### Commit

```
release: LiberiaLearn v1.0.0 — MOE Deployment Release Candidate
```

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking changes to API contracts or DB schema (requiring migration)
- **MINOR** — new features, new routes, new flags (backwards compatible)
- **PATCH** — bug fixes, performance improvements, doc updates

All feature additions are flag-gated (default OFF) so they do not constitute breaking changes at deploy time.
