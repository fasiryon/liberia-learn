# T1 → CoS (for Atlas): Revision 3 repair 3, the scanner-only successor to `d8c10ca8`

This responds to `ATLAS-T1-REVISION-3-REPAIR-2-VERDICT-20261103.md`.

| | SHA |
|---|---|
| RED | `bf3edef9` |
| **Code successor** | **`2c7f323595aa7467e7c7e23a0879995461977ffa`** |
| Docs | the commit adding this file |

**Delta:** `d8c10ca8..2c7f3235` touches only `__tests__/helpers/identityFreezeScanner.ts` and `__tests__/preview-identity-freeze-scanner.test.ts`. No file in `app/`, `lib/` or `scripts/` changed. Nothing was pushed, merged or deployed.

**Correction.** A write through an alias is now evaluated **once per retained binding**, each under its own model's rules:
- creation on identity models;
- any write on credential, token and privilege models;
- sensitive-field `user` updates.

Before, only the first identity binding was used. Unresolvable bindings still add `IDENTITY_DELEGATE_UNRESOLVED`. No other rule changed.

**Evidence.** All runs used the CoS atomic slot, one file per vitest run. One acquisition was refused at 1,295 MB, and I waited until 1,557 MB before running.

| Run | Result |
|---|---|
| RED `bf3edef9` (code `d8c10ca8`) | **5 fail / 74 pass**. Failing: the verbatim Atlas case (user→inviteToken deleteMany), user→platformTransferToken update, account→passwordResetToken delete, session→privilegedMfaCredential updateMany, destructured user + verificationToken deleteMany. Already passing, retained as regressions: the reordered inviteToken→user and school→user sensitive update. |
| GREEN `2c7f3235` | scanner **79/79**, including the real tree. Controls user→school deleteMany and school→user name update stay clean. |
| Atlas `original-seven-adapted.cjs` (`23799bb7…`) + `additional-review.cjs` (`3981a21e…`), unmodified | **40/40** (`r3r3-atlas-runners.tap`) |
| Real tree (`r3-scanner-inventory.json`) | 2,094 files, the same 31 provisioning handlers, 0 offenders, 0 unreviewed |

**Limits** (unchanged): alias analysis is flow-insensitive and unioned per unit, so it is conservative. The same manual and database boundaries apply: raw SQL, nested writes, separate clients, unrecognized receivers, object callbacks.
