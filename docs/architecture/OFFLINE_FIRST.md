# Offline-First Architecture

## Goal
Teachers and students can perform key actions with intermittent connectivity.

## Requirements
- Offline banner and sync status visible to user
- Actions queue locally and sync later
- Conflict resolution is deterministic and testable
- "Last sync time" displayed and logged

## Sync Observability
Log and track:
- failed sync attempts
- conflict events
- retry loops
- queue depth (if applicable)

## UX Requirements
Users must never wonder:
"Did my work save?"

## Definition of Done
- Core actions work offline
- Conflicts are resolvable without data loss
- Sync failures are visible and actionable