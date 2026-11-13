# SEC-R02 independent implementation review

Verdict: PASS for the examined static code-side authority repair. The current student sync branch cannot create or replace canonical attendance, and it retains an explicit operation conflict for the existing outbox path. This is not a merge, deployment or production FIXED decision. CoS exact-commit review and final test evidence remain required.

Reviewed RED commit `b0cb79156be10407ea6e4095eb18580466a67028` against the dirty implementation diff. The primary executor reports RED 5 failures and 4 passes; GREEN, related checks and TypeScript are running separately. I did not run tests, heavy jobs, providers, database queries, source edits or commits.

## Code findings

- `app/api/student/sync/route.ts` removes the `resolveAttendance` import and the whole attendance read/last-write-wins/upsert branch. For effective entity attendance it now appends an explicit `conflict` with `attendance_requires_teacher_review` and continues processing the batch. No `AttendanceRecord` read or write remains in that branch, so neither a newer timestamp, a missing existing mark nor an attacker-selected meeting/student can gain canonical write authority there.
- The route retains the existing STUDENT session gate, protocol parsing, learner binding, content checks, replay handling, per-operation result shape and final diagnostics. Returning HTTP 200 with a per-operation conflict is compatible with the current sync batch API. Earlier validation may still reject malformed or unauthorized operations rather than returning this conflict, which is safe.
- `resolveAttendance` now always returns conflict with the same authority-review hint. It retains its exported name and return union for compatibility while removing any interpretation of client time as official authority. Its prior runtime caller is removed by this repair. The existing exact-hint expectation in `__tests__/offline-sync-policies.test.ts` was updated, addressing the prior proposal review's compatibility concern.
- The application diff changes no neighboring assignment submission, homework submission, assessment attempt, lesson progress, lab or learning-observation writer. The mixed-batch test exercises a real supported learning observation alongside the attendance conflict, demonstrating that this branch does not terminate the whole request.
- Staff attendance routes and guardian read paths are unchanged. This repair makes no new claim about staff-route authorization and does not create or change official records on the guardian path.

## Meaningful regression evidence

The revised `attendance-authority.test.ts` checks real route execution under mocked dependencies, HTTP 200, zero synced attendance operations, exact operation identity/category, explicit conflict/hint and no mocked canonical upsert for both legacy and protocol-v1 inputs. It also checks a new-record attempt and a future-timestamp resolver call. These explicit result checks resolve the earlier risk that an unrelated HTTP 500 or malformed fixture could pass simply because no upsert ran.

The mixed-batch case requires one conflict and one synced observation and verifies a raw learning-observation event is recorded. This is a useful workflow-preservation control; it is not exhaustive evidence for every unchanged entity category. Different-student, foreign-school and older-timestamp no-write controls remain useful containment checks, but after unconditional denial they no longer independently validate the removed checks.

`attendance-outbox.test.ts` runs the real `flushSubmissionQueue` with a typed canonical OfflineOperation and synthetic response. It verifies the authority conflict becomes `markSyncConflict`, preserves the client payload in that call, and calls neither success acknowledgement nor terminal failure. Storage functions themselves are mocked, so this proves queue-dispatch behavior, not browser persistence, conflict UI visibility or durable retention after restart. Existing offline storage suites should remain green; any end-to-end UI claim needs its own evidence.

## Review and operations boundaries

No teacher review task is created. The hint means a teacher must resolve the conflict through an authorized existing or separately developed workflow; it does not mean a review has been submitted, assigned or completed. The inline comment correctly describes keeping the device operation for explicit human resolution. Do not present the operation as uploaded official attendance.

The repair does not reconstruct or revert prior accepted student-authored attendance. Such historical correction needs a separately authorized provenance investigation and school review, never automatic timestamp-based reversal. Old accepted-operation replay receipts may still short-circuit through preexisting replay handling; that does not introduce a new canonical attendance write.

The preserved WIP merge-tree result supplied by the primary executor records one sync conflict and 21 overall conflicts. I did not reapply, pop or modify that WIP. These results describe branch integration constraints; they are not a reason to mutate another agent's files or a declaration that the entire WIP can merge cleanly.

No blocking bypass of the repaired attendance branch was found. Record final GREEN/related/TypeScript results, log hashes, and the final repair SHA in the CoS handoff. Keep the finding OPEN until acceptance and keep deployed posture UNKNOWN until separately authorized verification.

## Version binding

Reviewed source HEAD `b0cb79156be10407ea6e4095eb18580466a67028` with current working-tree implementation. SHA256 bindings:

- `app/api/student/sync/route.ts`: `160ce5655fb61e4b274ece27a782747f1558e3395e33ad4d636e63a7f447aeb7`.
- `lib/offline-sync/policies.ts`: `c563a7c90d94cbc9f474ea9e0c02defdf3dbd9ea8c298e3d0d3e32d3ac8a78d4`.
- `__tests__/offline-sync-policies.test.ts`: `e4cd90e8f100014d133235cc005af1c2d36558b40fdad09a16f18c3869cc28d0`.
- `docs/audits/project-atlas-20261023/post-audit/tests/attendance-authority.test.ts`: `45f0b35036715c760819d916d81905ffc8619c94b12d3e2312fc500bd852d94d`.
- `docs/audits/project-atlas-20261023/post-audit/tests/attendance-outbox.test.ts`: `93d3226fca0627be46ae1c9244769b7ae756ebf41e12cb124dfabb237055b5f4`.
