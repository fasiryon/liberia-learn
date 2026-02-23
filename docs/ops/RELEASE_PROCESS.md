# Release Process (V1)

## Release Cadence
- Patch releases as needed (hotfix)
- Minor releases on a scheduled cadence (e.g., weekly/biweekly)
- Major releases only when version boundaries change (see version governance)

## Gates (Must Pass)
- tests green
- build/typecheck green
- migration checks (if any)
- telemetry changes reviewed
- rollback plan documented

## Rollback Rules
- critical issues: flip flags first
- rollback release if tenant boundary, auth, or data integrity is at risk