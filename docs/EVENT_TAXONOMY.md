# Event Taxonomy

> Governed measurement authority: P7-A events and metrics are defined in
> `lib/measurement/governedMeasurement.ts` and documented in
> `docs/P7A_GOVERNED_MEASUREMENT_FOUNDATION.md`. This legacy inventory is not
> authority for governed product metrics.

## Purpose
`LearningEvent` is the append-only event backbone for analytics, replay safety, and provenance.

## Event Shape
- actor:
  - `actorType`
  - `actorId`
  - `actorRole`
- target:
  - `targetType`
  - `targetId`
- identity:
  - `eventType`
  - `source`
  - `status`
- timing:
  - `occurredAt`
  - `originalOccurredAt`
  - `syncReceivedAt`
- replay:
  - `clientEventId`
  - `dedupeKey`
  - `replayOfEventId`
  - `replaySequence`
  - `isReplay`
- curriculum and version context:
  - `contentId`
  - `lessonId`
  - `unitId`
  - `termId`
  - `subject`
  - `grade`
  - `curriculumVersion`
  - `promptVersion`
  - `assessmentVersion`
  - `calculationVersion`

## Current Event Families
- student activity:
  - `lesson.complete`
  - `student.passport.viewed`
- offline sync:
  - `offline.sync.student_progress.accepted`
  - `offline.sync.attendance.accepted`
  - `offline.sync.submission.accepted`
  - `offline.sync.conflict`
  - `offline.sync.replay_deduped`
- interventions:
  - `intervention.chain.opened`
  - `intervention.chain.stage_changed`
  - `intervention.chain.closed`
- AI:
  - `ai.interaction`
- reporting:
  - `teacher.weekly_report.viewed`
  - `moe.dashboard.viewed`

## Event Rules
- Events are written with `logLearningEvent()`.
- Event payloads are additive and append-only.
- Replay-safe events should carry both `clientEventId` and `dedupeKey`.
- Offline events preserve original client timestamps.
- Privacy-sensitive free text belongs in application flow, not event metadata.
