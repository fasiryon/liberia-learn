## Block 5 — Ops Intelligence (Self-Healing A+B)

### Summary
- Deterministic findings engine for ops issues (authoritative)
- OpenAI Responses API explanations (advisory-only, no PII, strict JSON)
- New telemetry + aggregates + admin UI for findings
- Feature flags: OPS_AI_EXPLANATIONS_ENABLED, OPS_AI_MIN_SEVERITY
- Tests + ADR + docs updates

### Risk
Medium

### Rollback
Disable flags; revert PR if needed.
