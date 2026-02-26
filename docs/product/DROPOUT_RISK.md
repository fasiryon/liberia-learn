# Dropout Risk Scoring (Block 16)

This module provides deterministic, explainable dropout risk scores using leading indicators:
- Attendance proxy (recent attendance rate)
- Evidence velocity drop (submission slowdown)
- Mastery decline (current vs baseline + decay signals)
- AI reliance increase (requires prior rate history; defaults to neutral when missing)
- Assignment completion rate

## Outputs
- `totalRiskScore` (0..100)
- `riskBand`: `LOW` | `MEDIUM` | `HIGH`
- `reasons` for explainability

## Governance
- Feature-flagged via `ENABLE_DROPOUT_RISK` (default OFF).
- Admin dashboard view is aggregate-only by grade band; no student identifiers.
- Teacher view is limited to the teacher's own classes.

## AI Signal (Optional)
An optional AI signal can be added to the score only when `AI_DROPOUT_RISK_ENABLED=true`.
If used, routes must emit audit + telemetry events. By default, AI signal is unused.
