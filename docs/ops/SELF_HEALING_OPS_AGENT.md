# Self-Healing Ops Agent (Fix-It AI) — National Safe Design

## Goal
Detect issues early, propose safe fixes, and accelerate recovery without risking security.

## Stage 1 — AI Incident Analyst (Start Here)
- detect anomaly patterns (errors/latency/SMS failures/sync conflicts/UX drop-offs)
- generate Incident Cards (summary, scope, suspected root cause)
- open GitHub issues automatically
- draft PRs with suggested patches
- run tests and smoke checks before recommending merge

## Stage 2 — Safe Auto-Mitigation
- toggle feature flags / degraded mode
- adjust throttles and quiet hours policies
- never modifies data model, auth, or tenant boundaries

## Stage 3 — Assisted Patch Engine (Human-Merged)
- generates code changes and tests
- requires review + merge

## Hard Prohibitions
- no autonomous production deploys
- no autonomous DB migrations
- no autonomous auth/tenant/permissions edits
- no autonomous bulk data deletion

## Required Outputs
Each incident must produce:
- Incident Card
- Proposed actions (immediate + follow-up)
- PR (when applicable)
- Post-incident report template