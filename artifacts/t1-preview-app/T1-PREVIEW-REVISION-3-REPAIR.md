# T1 → CoS (for Atlas): Revision 3 repair, the successor to `e13c53cc`

This repair responds to `ATLAS-T1-REVISION-3-VERDICT-20261103.md` and is a narrow delta. These files are byte-identical to `e13c53cc`:
- the Prisma `$extends` guard (`lib/db.ts`, `lib/db-guards.ts`);
- the hosted smoke runner and its library;
- the session policy;
- the worker / LL Code files;
- the identity-freeze placements.

No push, merge, deploy, host contact, Vercel change, secret change or database change was made.

| | SHA |
|---|---|
| RED (Atlas reproductions) | `8d6b5734` |
| **Code successor** | **`0aaa7a9c`** |
| Docs/evidence | the commit adding this file |

Atlas: please review **`0aaa7a9c`**. The delta to review is `e13c53cc..0aaa7a9c`: the scanner, the two scanner and route test files, and 21 route files whose only change is a catch-block insert plus one import.

## RED before GREEN for the five Atlas failures

Atlas's cases were copied verbatim into vitest, plus neighbouring forms. All runs were focused, one file at a time, under the CoS test slot. The slot records are `TEST-SLOT-RELEASED-T1-R3R-*`; the first record notes an aborted start, because Vitest 4 rejects `--poolOptions`.

| Atlas failure | RED at `8d6b5734` (code `e13c53cc`) | GREEN at `0aaa7a9c` |
|---|---|---|
| 1 Delegate alias `const users=prisma.user` | no handler, no offender, no review | provisioning handler + `MISSING_DOMINATING_GUARD` |
| 2 `const unused=requireRole` accepted as authority | clean | `GUARD_BEFORE_AUTHORITY` |
| 3 Guard in try with swallowed failure | clean | `UNSUPPORTED_GUARD_PLACEMENT` |
| 4 transfer Preview auth error | raw marker, 500 | `{"error":"Internal error","code":"INTERNAL_ERROR"}` 500; 401/403 fixed codes |
| 5 teacher/change-password Preview auth error | raw marker, 500 | same as 4 |
| Control: ordinary writer refused | PASS | PASS |
| Control: awaited authority + guard accepted | PASS | PASS |

**Suite totals:**

| Suite | RED | GREEN |
|---|---|---|
| Scanner | 21 fail / 38 pass | 59/59 |
| Route (r3) | 28 fail / 150 pass | 178/178 |
| Legacy freeze | — | 172/172 |

**Atlas's own runner.** I copied `t1-r3-independent.cjs` (sha256 prefix `8d5a0598`) to `artifacts/t1-preview-app/r3r-atlas-cases-copy.cjs`. The only change is two loader lines: the two routes now import `@/lib/preview/safeError`, which itself imports `@/lib/previewSideEffects`, and the copy loads the real modules through Atlas's own `load()`. Test bodies are unchanged.

At `0aaa7a9c`: **7 pass / 0 fail / 0 skipped** (`r3r-atlas-cases-copy.tap`). Atlas's unmodified file would stop at "unreviewed dependency @/lib/preview/safeError" for the two route probes.

## Scanner: updated coverage and limitations

1. **Aliases** resolve to their model:
   - `const x = R.m`;
   - `const x = R["m"]`;
   - `const {m} = R`;
   - `const {m: x} = R`;
   - `x = R.m`.

   **Fail closed:** an identity delegate of a Prisma-like receiver used as a value is `IDENTITY_DELEGATE_UNRESOLVED`. That covers a delegate passed as an argument, returned, or stored in an object, and a computed alias such as `prisma[name]`. Prisma-like receivers are `prisma`, `rdsPrisma`, `tx`, `db`, `client`, `prismaClient`, `trx`, or any binding imported from `lib/db`.
2. **Authority** requires a completed `await <authority call>` in a dominating statement before the guard. Accepted forms are an expression statement or a `const/let` initializer. The callee must be one of:
   - a seed: `requireUser/Role/PlatformAdmin/PrivilegedStepUp/Session`, or `requireMoePlatformAdmin`;
   - an imported, local or namespace helper whose own body has such a call. A helper's catch must always throw; a helper may also `return <authority call>` or have an arrow body that is an authority call.

   **Not authority:**
   - references;
   - un-awaited calls;
   - calls in branches;
   - calls in a try whose catch falls through;
   - helpers that reference or swallow authority;
   - `getServerSession` alone (removed as a seed: it returns null rather than throwing).
3. **Dominance:** the guard pair must be a statement of the handler body, or of a top-level try whose catch always returns or throws (every path; `if` needs both branches) and whose `finally` contains no return. A freeze call anywhere else is `UNSUPPORTED_GUARD_PLACEMENT`. That includes branches, a missing return, a fall-through catch, a returning finally and expression bodies.
4. **Unresolved shapes:** an exported HTTP handler that does not resolve to a function is `UNRESOLVED_HANDLER_EXPORT`, even when no write is visible.
   - Resolved: `export const GET = POST`, and wrappers whose argument is an inline or local function.
   - Explicit reviews on the real tree (both recorded with rationale in the test): the NextAuth `handler` object GET/POST, which leads to the reviewed non-propagating `lib/auth.ts#authOptions`; and the earlier `admin/guardian-link` dynamic-data review.

**Real tree** (`r3-scanner-inventory.json`, regenerated at `0aaa7a9c`): 2,094 files, the same 31 provisioning handlers as before, 0 offenders, 0 unreviewed.

**Still not resolved, by design:**
- calls through properties of non-namespace objects other than identity delegates;
- callbacks held in data structures;
- `eval`;
- raw SQL;
- a Prisma client bound to a receiver name outside the list above and not imported from `lib/db`;
- position-based checks inside the guarded sequence (any write or body read textually before the guard is an offender).

The scanner's job is to make unsupported shapes visible as offenders or REVIEW items; it does not prove data flow. Credential reveal/delivery and school lifecycle remain direct-test inventories (Atlas ruling 6), and all three participate through the r3 direct-handler suite.

## Fixed-error behavior

Changed handlers (22), each getting `previewSafeErrorResponse(err)` as the first statement of its top-level catch:
- the two Atlas cases: transfer POST and teacher/change-password PATCH;
- every other revised protected freeze-entry handler with the same raw-message catch, found by the new Preview/staging sweep: `admin/import`, `import/batches/[id]/credentials`, `onboarding/import-students`, `onboarding/import-teachers`, `admin/students` POST, `admin/teachers` POST/PATCH, `admin/guardian-link`, `admin/invites`, `onboard/invite`, `rollout/invite/{teacher,student,student/bulk}`, `admin/credentials/send`, `admin/schools/pending` POST, `platform/security/{accept,demote}`, `admin/security/mfa/recovery/reset`, `guardian/link`, `admin/students/[id]` PATCH.

Already safe in the sweep, so unchanged: OneRoster, `import/confirm`, `generate-reset-code`, `change-pin`, `admin/school` (already sanitized), and `admin/enrollment` (`handleApiError`).

| Preview/staging outcome | Body |
|---|---|
| 400 | `{error:"Bad request",code:"BAD_REQUEST"}` |
| 401 | `{error:"Unauthorized",code:"UNAUTHORIZED"}` |
| 403 | `{error:"Forbidden",code:"FORBIDDEN"}` |
| 404 | `{error:"Not found",code:"NOT_FOUND"}` |
| anything else | 500 `{error:"Internal error",code:"INTERNAL_ERROR"}` |

All responses carry `Cache-Control: private, no-store`. Denials a route returns directly, without throwing, are unchanged. Production and local return `null` from the helper, so existing text is unchanged; a test asserts the marker still appears in Production. That matches the ruling, which asks for no Production rewrite.

**Ordering is unchanged.** The routes still authenticate first, then freeze, then read the body. Authentication may perform its own freshness reads; the contract is no body, credential lookup or credential write before the freeze. It is not "zero DB work before auth".

## Focused regression (`r3r-focused-evidence.txt`)

- 26 existing test files for the changed routes all pass, including hosted-smoke 44/44.
- Route-policy audit PASS: 143 changed routes declared.
- No files changed in the Prisma guard, smoke, session or worker surfaces, so their suites were not rerun.

## Still open (unchanged by this repair)

- **Database-level acceptance**, owned by T2 and CoS:
  - RLS and grants;
  - immutable-history triggers;
  - denial of raw SQL, nested writes and separate clients;
  - real rollback;
  - statement timeout.
- **Release blockers:** SEC-R08, dependency acceptance, exact combined-source CI and browser runs, and founder A2/A3.
- **Validation limit:** the installed package is 6.19.2 while the generated client reports 6.19.3.
