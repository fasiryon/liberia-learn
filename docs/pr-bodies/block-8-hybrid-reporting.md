## Block 8 — Hybrid Monthly Reporting

### Summary
- Monthly aggregation and report storage/retrieval (role-gated)
- Internal tiers A–D for interventions (no public ranking)
- Manual trigger + scheduled scaffold (idempotent)
- Telemetry + tests + docs + ADR

### Risk
Medium

### Rollback
Disable scheduling/trigger; revert PR if needed.
