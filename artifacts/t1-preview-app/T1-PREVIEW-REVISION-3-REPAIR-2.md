# T1 → CoS (for Atlas): Revision 3 repair 2, the scanner-only successor to `0aaa7a9c`

This responds to `ATLAS-T1-REVISION-3-REPAIR-VERDICT-20261103.md`.

| | SHA |
|---|---|
| RED | `de255a7a` |
| **Code successor** | **`d8c10ca81ba5e327ce3686dc0a53019fcc3f4d59`** |
| Docs | the commit adding this file |

The code delta `0aaa7a9c..d8c10ca8` touches only `__tests__/helpers/identityFreezeScanner.ts` and `__tests__/preview-identity-freeze-scanner.test.ts`. No `app/` or `lib/` file changed, so the accepted sanitizer, routes, Prisma guard, smoke, session and worker sources are byte-identical to `0aaa7a9c`. Nothing was pushed, merged or deployed, and no host was contacted.

## Corrections (all three Atlas patterns are corrected, none rejected)

1. **A helper returns before authenticating.** An authority helper now qualifies only if its first dominating awaited authority statement comes before every `return` in its body. Returns inside nested functions are ignored. Any return path that starts earlier disqualifies the helper, including one inside an `if`, a loop or an earlier `try`.
2. **A catch with an early return before its rethrow.** In helper mode a `try` contributes its statements only when its catch contains no `return` anywhere and exits by `throw` on every path. The old `statements.some(...)` rule accepted `if (skip) return null; throw e;`. Handler-mode catches, where return or throw both end the request, are unchanged.
3. **A later alias reassignment.** Each alias name keeps the union of all its bindings, because scope and order are deliberately not modelled. Any identity binding classifies a write through that name. Rebinding to an unresolvable value (`d = pick()`) adds an `IDENTITY_DELEGATE_UNRESOLVED` review. A later non-identity assignment can no longer erase an earlier identity write.

## Evidence

All runs used the CoS atomic slot (`test-slot-lock/slot.mjs`, released records under `released/`), one file per vitest run, `--pool=forks --maxWorkers=1`.

| Run | Result |
|---|---|
| RED at `de255a7a` (code `0aaa7a9c`) | scanner 7 fail / 64 pass. Failures: Atlas's 3 verbatim cases, plus return in an earlier `try`, return in an earlier loop, arrow helper with an early return, and a rebind to an unresolvable value. |
| GREEN at `d8c10ca8` | scanner 71/71, including the real-tree gate |
| Atlas `original-seven-adapted.cjs` + `additional-review.cjs`, **unmodified**, against `d8c10ca8` | **40 tests, 40 pass, 0 fail, 0 skipped** (`r3r2-atlas-runners.tap`). On `0aaa7a9c`, Atlas recorded 37/3. |
| Real tree (`r3-scanner-inventory.json`, regenerated) | 2,094 files, the same 31 provisioning handlers, 0 offenders, 0 unreviewed. The reviewed items are unchanged: two NextAuth handler-object exports and the `guardian-link` dynamic data. |

**Controls that stay accepted:**
- `const u = await requireRole(); if (!u.schoolId) throw ...; return u;`
- `try { return await requireRole(); } catch (e) { log(e); throw e; }`
- `return requireRole()`
- `() => requireRole()`
- a non-identity alias, which stays clean
- both original Atlas controls

## Limits (unchanged, plus one clarification)

Alias analysis is flow-insensitive by design: bindings are unioned per unit. That is conservative, so it can over-report but cannot hide a write.

The other limits are as stated before:
- non-namespace object callbacks;
- callbacks stored in data structures;
- `eval`;
- raw SQL;
- client receiver names outside the recognized or imported set.

Any path that uses one of these needs a source-specific manual review. A clean scan is not a data-flow proof.

Unchanged open items: DB grants, RLS, triggers and real rollback; nested, raw and separate-client writes; statement bounds; SEC-R08; dependency acceptance; combined-source frozen-lock CI and browser runs; founder A2/A3.
