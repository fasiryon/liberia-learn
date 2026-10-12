# CHA hosted demo identity repair

The canonical CHA demo tenant is the existing **`school-cha`**, code **CHA**,
currently named **Capitol Hill Academy**. Do not migrate its primary key, create
a duplicate tenant or rename the school during this repair.

The repair anchor is exclusively `chaDemoStudentEmail()`: `student1@cha.edu.lr`
unless `E2E_DEMO_STUDENT_EMAIL` is configured. Display names never identify targets.
Showcase authorization still requires STUDENT role, exact configured email,
`CHA-2026-0001`, persisted Student linkage, and the canonical school on both the
session User and persisted Student.user relation. Changing the school constant
does not authorize other school members or authorize by email alone.

## A. USER-ONLY HOSTED SHOWCASE REPAIR

This is the history-preserving path for the current hosted tenant. It changes
only the existing demo User. It does not require a Grade 9 placement or class.

From a checkout containing this change, with installed dependencies and a
generated Prisma client for the deployed schema, use an approved operator shell
with the intended `DATABASE_URL` and approved `DEMO_SEED_PASSWORD` injected
privately. Match the application's `E2E_DEMO_STUDENT_EMAIL` setting, or leave it
unset for the default. Set `NODE_ENV=production` and `DEMO_MODE=true`.

```sh
npm run seed:cha -- --student-user-identity-only
```

On PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`. The new mode
requires an explicit `DEMO_SEED_PASSWORD` even locally: there is no default
password fallback. It does not need a MOE password or Redis credentials. Never
print secrets, put them in command history or commit environment files.

Before writing, one serializable transaction verifies:

- School `school-cha` exists with code `CHA`.
- The exact configured demo User exists, and a Student record exists for that
  same User. Missing records cause failure; no replacement account is created.
- `CHA-2026-0001` is unused or owned by that same User.

The only write is `User.update` by the existing User ID, restoring exact email,
`CHA-2026-0001`, Fatu Kollie, STUDENT, `school-cha`, the approved demo password
hash and `isPlatformAdmin=false`. Prisma's existing unique login-ID constraint
and serializable transaction prevent concurrent duplicate claims. A collision
or serialization error aborts; there is no transfer or automatic retry.

User and Student IDs remain the same. The following stay unchanged:

- Student.currentGrade (currently Grade 7), enrollments and guardian links.
- Placement tests, decisions/reviews, questions, answers and assessment sessions.
- Quiz attempts/details, grades, assignments, homework and submissions.
- Mastery/adaptive mastery, certificates, learning events and progress.
- Class metadata, scheduled work, curriculum governance and lab releases.

This mode does not inspect or overwrite placement history, so an existing
governed placement is not a conflict with a User-only repair. It cannot confer
Grade 9 placement, scoring, mastery or evidence authority.

Unknown command-line arguments and combined repair modes fail before seed
execution. Do not omit the flag: no flags still selects the full legacy seed.

### Operator verification

1. Obtain hosted-write authorization and retain the environment's normal
   rollback snapshot. This documentation does not authorize an execution.
2. Confirm target database, exact configured demo email, existing User/Student
   IDs, school ID/code, and login-ID ownership. Never identify someone by name.
3. Record checksums/counts for the demo Student and learning history before the
   command; run only the User-only command above.
4. Verify the same User/Student IDs, canonical User fields and unchanged Grade 7,
   class/enrollment, placement answers, attempts, mastery, certificates and events.
5. Sign out and sign in again. The seed does not rewrite browser sessions.
6. In Student > Labs verify the four showcase cards, or use the existing server
   readers: `loadShowcaseStudentAuthority(user)` authorizes and
   `loadAuthorizedShowcaseLabs(user)` returns exactly:
   `g4-solid-figures`, `fixture-lever`, `fixture-simple-circuit`,
   `mount-coffee-hydropower`. No legacy labs are granted; releases remain truthful
   and showcase activity remains observation-only.

Reruns preserve learner history. User password hashes may differ because bcrypt
uses fresh salt; the supplied password remains the same. This implementation
mission executes only mocked tests, not a hosted repair or deployment.

## B. FULL DEMO STUDENT NORMALIZATION — NOT APPROVED FOR CURRENT HOSTED TENANT

The existing command retains its prior normalization behavior:

```sh
npm run seed:cha -- --student-identity-only
```

It restores Grade 9, removes other enrollments, ensures `cha-class-grade9a`,
updates the latest unreviewed legacy placement, and clears questions/answers and
other placement fields. It rejects governed placement conflicts. It is retained
for deliberate local/fresh demo setup and is **not** the hosted-safe User-only
repair. The full seed without flags also writes broader demo accounts, content,
exams, certificates and learning events; it is not approved for this hosted repair.

The hosted **`cha-class-grade9a` must not be renamed or reinterpreted**. Despite its
ID, it is a Grade 7 class with established scheduled lessons, submitted quizzes,
teacher work, progress, mastery and certificates. Sole current enrollment by
student1 does not make those records disposable. The latest legacy placement also
contains recorded questions and answers that the old normalization would erase.

## Later Grade 9 demo: a deliberate new surface

The full Fatu Kollie Grade 9 demo remains a separate follow-up. Create a dedicated
class such as **`cha-demo-grade9a` under `school-cha`**, with an authorized own-school
teacher and explicit demo fixtures. Do not hijack `cha-class-grade9a`, redirect its
historical work or regrade old assessments. Design the Grade 9 fixture and
enrollment/scheduling handoff to preserve the existing Student ID, placements,
mastery, certificates and historical access, then validate it separately before
any authorized hosted execution. This change creates no new class or Grade 9 data.
