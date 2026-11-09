# T1 → CoS / Atlas: OneRoster and account-provisioning exposure, repaired for the deployed Preview (2026-11-02)

- **Branch:** `fix/t1-preview-app-readiness`, local and unpushed. Head `5daefe7c`.
- **Untouched:** no T2 seed or operator script, `middleware.ts`, the sealed packages or Production defaults.
- **Not done:** no deploy, merge or hosted account action.
- **Code execution:** stays disabled.
- **PV-01..06 and the smoke suite:** preserved.

## 1. Inventory (complete for `app/api`; enforced by a static test)

An entry point is any route that does one of the following:
- creates an account;
- issues, reveals, sends or resets another account's credentials;
- issues or accepts an invite;
- changes account lifecycle;
- changes privilege;
- calls a library function that does any of these.

| Entry point | Effect | Preview behavior |
|---|---|---|
| `admin/interoperability/oneroster/import` POST | OneRoster import; accounts with temporary passwords (worker `processOneRosterImportBatch`) | **403 frozen first** |
| `admin/import` POST, `admin/import/confirm` POST | bulk roster stage and create (worker `processStudentImportBatch`) | **frozen first** |
| `admin/import/batches/[id]/credentials` GET | reveals generated credentials | **frozen first** |
| `admin/onboarding/import-students`, `import-teachers` POST | onboarding imports | **frozen first** |
| `admin/students` POST, `admin/teachers` POST and PATCH, `admin/guardian-link` POST | create accounts; activate/deactivate teachers | **frozen first** (the GETs are unchanged) |
| `admin/invites` POST, `onboard/invite` POST, `onboard/accept` POST, `rollout/invite/{teacher,student,student/bulk}` POST | issue and accept invites (accept creates the account) | **frozen first** |
| `register/student`, `register/guardian`, `guardian/register` POST | self-registration | **frozen first** |
| `enroll` POST (public) | pending school plus **ADMIN** with a temporary password | **frozen first** |
| `admin/schools/pending` POST | approval activates that ADMIN | **frozen first** |
| `admin/school` PATCH `inviteTeacher` / `deactivateTeacher` | teacher invite/lifecycle | **frozen after the existing auth**; other actions unaffected |
| `admin/students/[id]/generate-reset-code`, `auth/reset-with-code`, `auth/reset-password`, `auth/forgot-password` POST | take over another account's password | **frozen first** |
| `admin/credentials/send` POST | sends login credentials by SMS | **frozen first** |
| `platform/security/accept`, `platform/security/demote`, `admin/security/mfa/recovery/reset` POST | privilege and MFA changes | **frozen first** |

**Allowed by review:**
- `student/change-pin` and `teacher/change-password`: the signed-in user's own credential;
- `auth/[...nextauth]`: Google invite provisioning there is unreachable with no OAuth keys, and the smoke asserts the credentials-only provider.

**Out of scope here, for the B5 inventory (not identity):**
- `admin/students/[id]` PATCH: class moves;
- `admin/school` `createClass`, `moveStudent`, `updateProfile`;
- `admin/enrollment`;
- portfolio and reviewer "credentials", which are not logins.

`worker/` handlers are SQS consumers and are not deployed with the app; the routes that enqueue them are frozen.

## 2. Repair

`lib/preview/identityFreeze.ts` defines `previewIdentityFrozen()`. It applies only when `VERCEL_ENV` is preview or staging, the same predicate as the cron and demo guards. It returns 403 `{code:"PREVIEW_IDENTITY_FROZEN"}` with no-store.

It is the first statement in 29 handlers across 29 routes (27 in `094ff19c`, 2 in `be741cc4`), so it runs before authority, database or provider work. The only exception is the action-based `admin/school`, which checks after its existing authentication.

All 29 touched routes now carry `route-policy` directives.

## 3. RED/GREEN trail

| Commit | Change |
|---|---|
| `0112c4db` RED | Direct handler calls on 28 handlers as a same-school admin, foreign-school admin, platform admin, student and anonymous caller: **140 failures** (each reached authority or data). 31 controls pass: Production, local, own-credential. |
| `094ff19c` fix | 27 routes plus the helper. GREEN 171/171. |
| `2e3dd4a1` RED | Second pass: `enroll`; `admin/school` invite/deactivate; a **static completeness guard**. Every route that writes identity data, or imports an account-creating library function (resolved per function through private helpers), must call the freeze unless allowlisted. A non-vacuous control proves it detects direct and library-call provisioners. Offenders at RED: `admin/school`, `enroll`. |
| `e355621b` | Test typing only. |
| `be741cc4` fix | `enroll` and `admin/school`. GREEN 176/176. |
| `11507d13` RED → `5daefe7c` fix | Hosted smoke. Adds a **read-only** probe: GET credential reveal as the school admin must return `PREVIEW_IDENTITY_FROZEN`. The suite still never POSTs to a provisioning route. |

**Evidence:**
- Focused sweep at `5daefe7c`: **124 files, 1,641 passed, 0 failed**, 16 skips (pre-existing, in the existing route tests).
- The 20 existing test files for the touched routes pass unchanged (183 tests).
- Scoped tsc: exit 0. eslint: exit 0. `audit:api-routes`: PASS (137 declared).
- `git merge-tree` with CoS `217405a0`: CLEAN, no common files.

## 4. Requirements mapping

1. **Every relevant entry point identified:** yes. §1 lists them, and the static test keeps the list complete.
2. **Failing tests for direct API access:** yes; handlers are called directly, not through navigation.
3. **Fail closed on the hosted Preview:** yes; the freeze comes before authority, the database and any provider.
4. **Production preserved:** yes. 28 Production controls and a local control pass, and existing route tests are unchanged.
5. **No alternate route:** yes. The static guard covers direct writes and library calls; the worker is not deployed; Google is unregistered.
6. **Wrong-role, same-school and cross-school callers denied:** student, same-school admin, foreign-school admin, platform admin and anonymous callers all receive 403 with no data access.
7. **Coordinate the Preview mutation-route inventory with Atlas:** see §5.
8. **No T2 changes:** no T2 files touched.

## 5. For Atlas

- **Please review:** `094ff19c`, `be741cc4`, the static guard in `2e3dd4a1`, and `5daefe7c`.
- **Allowlist decisions to confirm:**
  - own-credential changes stay allowed;
  - `admin/school` freezes after authentication.
- **Related finding for B2/B5:** the installed Prisma 6.19 client has **no `$use`**. `lib/db.ts`'s `$use` audit-immutability and timeout middleware is therefore **inert**. Only the delegate wrapper on `prisma.auditLog` remains, and it does not cover `$transaction` clients. Audit immutability needs DB triggers (Atlas B2) or a `$extends` rewrite. I have not changed this, pending your direction.
- **B5 still needs a decision on the non-identity mutations listed in §1.**
