# LiberiaLearn — Offline Sync Conflict Resolution

## Overview
LiberiaLearn supports offline learning with background sync when connectivity returns. This document defines exactly how conflicts are resolved.

## Data Types and Resolution Strategy

### Server Wins (authoritative)
- Quiz scores and grades
- Certificate issuance
- Intervention status changes
- Teacher-assigned due dates

Rationale: These affect academic record. Server state is always authoritative. Client cannot override.

### Client Merge (additive)
- Lesson progress events (completion, time spent)
- AI tutor interaction logs
- Lesson mode preference (read/slides/listen)
- Lab interaction events

Rationale: These are append-only logs. Client events are merged into server timeline. No data is lost.

### Conflict Detection
- Every offline event includes `clientEventId` (UUID v4)
- `clientEventId` is checked for duplicates on sync
- Duplicate `clientEventId` = idempotent no-op
- Timestamp from client device is stored alongside server receipt timestamp

### Sync Failure Handling
- Retry up to 3 times with exponential backoff
- After 3 failures: event moves to dead letter queue
- Dead letter queue reviewed by admin
- Student sees "Some activity may not have synced" notification if dead letter queue has items

### Known Edge Cases
- Student submits quiz offline, teacher grades before sync
  → Server quiz score wins, client attempt logged as secondary attempt
- Student completes lesson offline twice (device clock wrong)
  → Both events logged, latest timestamp wins for progress display, both count toward streak
