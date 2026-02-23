# ADR 0001 — Offline Sync Protocol and Conflict Rules

## Status
Accepted

## Context
LiberiaLearn must operate in low bandwidth and intermittent connectivity environments. Teachers and students must be able to complete daily actions without reliable internet.

## Decision
We adopt an offline-first sync protocol with:
- queued local actions
- deterministic conflict resolution rules
- visible sync status in the UI
- telemetry for sync failures and conflicts

Any change to sync payload shapes, conflict rules, or retry behavior is treated as a protocol version change and must follow Version Governance.

## Consequences
- Increased engineering complexity, but required for Liberia’s operating conditions
- Requires explicit observability and UX clarity ("saved vs pending sync")
- Protocol versioning discipline is mandatory

## Alternatives Considered
- Online-only operation (rejected: unreliable connectivity)
- Best-effort sync without conflict rules (rejected: data corruption risk)