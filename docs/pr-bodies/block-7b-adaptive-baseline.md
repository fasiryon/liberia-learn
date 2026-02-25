## Block 7B — Adaptive Baseline (C) + Baseline Capture

### Summary
- Deterministic adaptive baseline engine (dynamic difficulty)
- Strand coverage enforcement, baseline confidence
- Baseline APIs + persistence into mastery profiles
- Minimal student UI hook (feature-flagged)
- Telemetry + tests + docs + ADR

### Feature Flags
- NEXT_PUBLIC_ENABLE_BASELINE_ASSESSMENTS (default off)

### Risk
High (new assessment flow)

### Rollback
Disable flag immediately; revert PR if needed.
