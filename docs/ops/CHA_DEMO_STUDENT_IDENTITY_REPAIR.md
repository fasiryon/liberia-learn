# Repair an existing CHA demo student identity

This procedure is for an authorized operator after the repair code is available
in the hosted environment. It has not been executed against hosted data as part
of this change.

The old CHA seed updated only `hashedPwd` for an existing student email, left
`Student.currentGrade` unchanged when a placement row existed, and preserved that
obsolete placement. The repair anchors exclusively on `chaDemoStudentEmail()`:
`student1@cha.edu.lr` unless the application uses `E2E_DEMO_STUDENT_EMAIL`.
Display names are never lookup keys.

## Exact repair command

From the repository root, with installed dependencies and the deployed schema's
generated Prisma client, use an approved operator shell with secrets injected by
the environment's secret manager. Confirm `DATABASE_URL` points to the intended
hosted demo database. Set `NODE_ENV=production` and `DEMO_MODE=true`, provide the
approved `DEMO_SEED_PASSWORD`, and use exactly the same
`E2E_DEMO_STUDENT_EMAIL` as the running application (or leave it unset if the app
uses the default). Do not put passwords or connection strings in command history.

```sh
npm run seed:cha -- --student-identity-only
```

On PowerShell use `npm.cmd run seed:cha -- --student-identity-only` if execution
policy blocks `npm.ps1`. Identity-only mode does not require a MOE password or Redis
credentials and does not reseed other users, lessons, curriculum approvals,
exams, certificates, learning events, assessments or lab releases. Do not omit
the flag for this repair: the full CHA seed intentionally reseeds broader demo
data, including passwords for other demo accounts.

## Operator procedure

1. Obtain authorization for the hosted database write and retain the environment's
   normal backup/rollback snapshot. This document is a procedure, not authorization.
2. Verify the exact configured email identifies the intended **demo** account;
   record its existing User ID and Student ID. The old name/grade may be Pewu
   Gongloe / Grade 7. Do not substitute another student based on their name.
3. Verify the existing school ID is `cha-high-academy` with code `CHA`, and class
   `cha-class-grade9a` belongs to that school. Identity-only mode stops if either
   is missing or inconsistent; it does not create schools/classes or a replacement
   User when the exact email is absent.
4. Check `CHA-2026-0001` is not owned by another User. A uniqueness collision stops
   the transaction; never transfer that login ID from an unrelated account.
5. Inspect the demo student's latest placement. The repair updates an unreviewed
   legacy/demo fixture in place; it refuses an assessment-session-backed placement,
   official PlacementDecision, PlacementReview or human-reviewed result. Resolve
   such authority conflicts separately with the authorized owner, without deleting
   decision/review/session records merely to force this seed through.
6. Run the command above once. User, Student, placement and enrollment changes
   commit together in a serializable transaction. A failure rolls all of those
   identity changes back. Full seed school/class/account changes are outside that
   transaction, which is why identity-only mode is the hosted repair procedure.
7. Verify the same User ID/Student ID remain, with these fields:

   | Record | Expected state |
   | --- | --- |
   | User | exact configured email; `CHA-2026-0001`; Fatu Kollie; STUDENT; `cha-high-academy`; approved demo password hash; `isPlatformAdmin=false` |
   | Student | `currentGrade=9` |
   | Enrollment | exactly `cha-class-grade9a` for this demo Student; obsolete/foreign enrollments removed; other students untouched |
   | Latest placement | same existing placement ID when repairing; Grade 9, `G7_9`, Junior Secondary; canonical demo score 14/18 and analysis; `source=seed:cha-demo` |

   The synthetic placement is explicitly demo provenance, not a new human placement
   decision. Stale unreviewed teacher-grade metadata and old answers/questions/
   details are cleared. Older placement history is retained. If no placement exists,
   the seed creates the same canonical demo fixture used for a fresh demo account.
8. Sign out and sign in again. Existing sessions can retain stale school/role
   identity and are not rewritten by the seed. In the fresh session verify
   `loadShowcaseStudentAuthority(user)` succeeds and the Labs showcase section
   lists exactly: `g4-solid-figures`, `fixture-lever`, `fixture-simple-circuit`,
   `mount-coffee-hydropower`. Legacy labs are not added by showcase access;
   authorization and unreleased lab metadata remain unchanged.

Rerunning the identity-only command converges on the same identities, placement
and enrollment. Password hashes may differ because bcrypt uses a fresh salt, while
the configured password remains the same. No live repair or live authorization
result is claimed by the local mocked regression tests.
