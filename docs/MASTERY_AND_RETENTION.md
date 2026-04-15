# Mastery And Retention

## Mastery Model
- `StudentMasteryProfile` holds current operational profile state.
- `MasterySnapshot` captures append-only historical state over time.
- `DerivedStudentProgress` stores append-only computed progress derived from snapshots, attempts, and chain context.

## Snapshot Rules
- New mastery state is appended with `appendMasterySnapshot()`.
- Each snapshot links backward with `previousSnapshotId`.
- Snapshot writes do not update prior rows.

## Derived Progress Rules
- `appendDerivedStudentProgress()` creates a new derived row.
- Derived progress may reference:
  - `sourceAttemptId`
  - `sourceSnapshotId`
  - `sourceChainId`
- Derived progress also records:
  - open intervention chain count
  - misconception count

## Intervention Coupling
- Open intervention chain counts are reflected in derived progress.
- Student passport subject summaries surface intervention pressure by subject.

## Retention
- Retention uses recent `DerivedStudentProgress` activity as the active-student signal.
- School-scoped retention must filter active rows by `schoolId`.
- Aggregate retention outputs are safe for summaries; they do not require individual student rows.
