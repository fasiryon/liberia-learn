# Independent review: Preview identity freeze and audit integrity

Reviewed code `5daefe7ce484182f10fa412fa50e0e9e474f7f7b`, delivered head `8c5ac01f0649d34064799bafd97fda0c5e35326e`, against CoS security integration `217405a0`. T1's working source matched the code head when checked. This review is independent of T1's authorship. Acceptance of T2-authored bootstrap changes remains a separate Atlas decision.

**Identity freeze: REVISE. Credential-change policy: REVISE, freeze self-service changes in Preview. admin/school: REVISE for error disclosure; its normal authorization and pre-mutation ordering pass. Audit integrity: P1 hosted-release blocker until database enforcement is proven.** No merge, deployment, migration, hosted connection or served-code edit was performed in this review.

## Findings

### P1: the completeness guard does not enforce the claimed entry-point coverage

`__tests__/preview-identity-freeze.test.ts` uses a regular expression for identity writes, recognizes top-level function declarations for library provisioners, follows private calls only inside the same file, and finally accepts any route source containing the string `previewIdentityFrozen(`. It does not prove the guard protects each mutating HTTP handler or dominates the write.

The author's exact scanner callback and its actual allowlist were extracted from the pinned Git blob and executed against an in-memory synthetic source tree. The normal unguarded direct writer was rejected, establishing a working positive control. Seven valid entry-point forms escaped detection:

- Whitespace between model and method.
- Computed model access.
- An exported arrow-function provisioner.
- A namespace-imported provisioner.
- An account-creating helper reached across another file.
- A freeze string present only in a comment.
- A real freeze call present only in a different HTTP handler in the same route file.

No synthetic provisioner was executed and no T1 source was mutated. Evidence is `completeness-results.json`; `completeness-mutations.cjs` reproduces it. These are scanner completeness failures, not a claim that each hypothetical shape already exists as an exploitable route. They prevent the requested guarantee that newly introduced entry points will be detected.

T1 should use syntax-aware per-handler checks and resolved calls across exports/imports, including arrow exports, aliases, namespaces and private helpers. Unknown relevant call paths must require review. A mere helper import or comment cannot satisfy the guard. Retain these adversarial cases as detector regressions. Independent inventory and database denial of account-provisioning writes remain required; route count alone is insufficient.

### P2: two self-service credential routes still mutate the controlled Preview identities

`student/change-pin` POST accepts a signed-in student's matching 4–6 digit PIN and updates User.hashedPwd. `teacher/change-password` PATCH verifies the current password and updates hashedPwd/passwordChangedAt. Neither calls the Preview freeze. Independent direct-handler tests with valid synthetic actors returned 200 and reached the user write in both cases.

Policy decision A: **REVISE.** Restrict both routes during deployed Preview/staging and use the separately authorized operator credential lifecycle. Put the freeze before authority/database work, test direct requests for all actor types, and retain unchanged Production/local controls. The existing operator seed does not require a reviewer to change their credential to enter the demonstration. This restriction must not alter ordinary school/student credential functionality outside Preview.

The NextAuth allowlist also depends on verified absence of OAuth provisioning credentials. That is an environment gate, not proof supplied by this route patch. Require the protected hosted provider check before acceptance.

### P2: admin/school can disclose a raw authentication/freshness exception before the freeze

The PATCH handler calls requireSchoolAdmin, parses/validates the action, then freezes inviteTeacher/deactivateTeacher before either school service is invoked. Normal anonymous/student calls are rejected; both same-school and foreign-school ADMIN calls are frozen before service work. Reading the signed-in principal for authentication is not itself an unauthorized cross-school data access. No pre-freeze identity mutation was found in that path.

However, the catch block returns `err?.message` unchanged. requireUser performs a database freshness read and rethrows infrastructure failures for privileged accounts. Consequently a signed-in ADMIN request can fail before reaching the freeze and receive a raw database/authorization exception. An independent injected synthetic freshness-error probe returned that exact private marker to the caller with status 500. This establishes an error-disclosure channel; it does not claim that a real secret was exposed.

Policy decision B: **REVISE.** Authentication-first ordering can remain, but Preview error responses must expose only safe fixed authorization codes and a generic infrastructure failure. Keep legitimate 401/403 distinctions and unaffected class/profile operations. A Preview-only safe catch preserves the requirement that Production behavior remain unchanged. Test infrastructure failure and missing/invalid sessions as well as successful authentication. Moving a narrow identity-action freeze earlier is another option for T1, but do not bypass authentication for ordinary school actions.

### P1: Prisma middleware is absent; the root delegate wrapper is incomplete

The actual installed client is Prisma 6.19.2 and `typeof prisma.$use` is undefined. Both `$use` branches in lib/db.ts therefore skip registration. This affects the audit-mutation middleware and its promised query timeout. The four root audit delegate wrappers remain active when ENABLE_AUDIT_IMMUTABILITY is enabled, which is the default.

Using unchanged T1 lib/db.ts and only READ ONLY transactions on the existing localhost scratch database, the independent probe confirmed:

- Root direct auditLog.update throws the application immutability error.
- Interactive transactions expose a separate audit delegate without the wrapper marker.
- Transaction update, deleteMany and upsert, plus raw UPDATE, reach PostgreSQL and are refused by the transaction's read-only protection instead of the application guard. The probe checks PostgreSQL read-only error evidence; all transactions rolled back and no row changed.

`audit-client-results.json` records those results without raw driver messages, SQL or connection strings. Other uncovered shapes follow directly from source: root upsert and updateManyAndReturn are outside the four-method wrapper; nested audit writes through another model, raw SQL and separate Prisma clients are not protected by that wrapper. Array transactions built from an already wrapped root update throw before the array is submitted, while interactive transaction clients bypass it. With the feature flag off, even the four root methods have no application guard. Audit INSERT/create is legitimate append behavior, not an immutability violation.

Existing audit-immutability tests exercise a mocked root delegate and statically inspect migration text. They do not prove transaction coverage, active middleware, trigger installation or runtime grants. A green result there cannot certify database audit integrity.

## Actual database state and the deployment plan

Hosted Preview state is **UNKNOWN, not inspected**. A2 was not authorized and this review made no hosted connection. Repository migration text contains two AuditLog UPDATE/DELETE triggers and ten P2-A history/provenance triggers. RLS enablement, FORCE RLS, policy correctness, installed trigger definitions/enabled state, object ownership and grants in the intended hosted schema have no executed evidence here.

The current T2 setup uses Prisma db push, not migrate deploy. Schema push creates neither those custom triggers/functions nor the repository's SQL RLS/policies or migration history. Running it as preview_app also makes that role own its newly created objects. A non-superuser owner can alter the schema or disable guards; ENABLE RLS alone does not constrain an owner without FORCE, and owner privileges are not removed by ordinary GRANT revocation. Thus the current setup plan does not establish the required protections.

Earlier T2 scratch evidence installed audit/P2-A triggers manually in a disposable local instance and tested real trigger refusal. That demonstrates compatibility only. It is not hosted installation evidence. T2's new read-only preflight deliberately blocks unapproved ownership/RLS/grants/trigger state; independent acceptance of that preflight is still pending.

Restricted grants are adequate defense only if the actual runtime role cannot own/inherit owners, bypass RLS, change replication mode, create/alter schemas, or UPDATE/DELETE/TRUNCATE/alter AuditLog through any direct or inherited path. Verify anon/authenticated/service_role/PUBLIC and default grants as well. Forced RLS and audited policy predicates complement those restrictions. RLS alone cannot prove append-only history, and row triggers do not by themselves block TRUNCATE. Do not hand the app an owner/service-role credential to make tests pass.

## Smallest correction plan

1. T1 freezes the two own-credential handlers in deployed Preview and sanitizes admin/school's pre-freeze error path. Production/local behavior stays unchanged.
2. T1 replaces the scanner's substring/regex acceptance with per-handler syntax/call-path checks and adds the seven independent mutation cases. Unknown paths require explicit review.
3. CoS/Atlas approve a separate owner/bootstrap/runtime permission plan and a read-only metadata contract. Prove the exact required audit/provenance triggers, safe definitions, RLS/policies and restricted role grants in the intended schema under future authorized database work. No migration is approved by this plan.
4. If an application audit guard remains, T1 should use the supported Prisma query-extension API for explicit operations on root and transaction clients. It must cover upsert/updateManyAndReturn and be tested on the installed version. Document that raw SQL, nested writes and alternate clients still require database enforcement. Do not present an extension as a substitute for triggers/grants.
5. Remove or replace the inert timeout promise separately with supported bounded query/transaction behavior. The absence of a timeout is established; no broad timeout rewrite is requested in this review.

## Integration and combined CI requirements

Source-only composition analysis used an uncommitted merge-tree object, not a branch merge. `integration-source-results.json` records its identity. All 25 application paths changed by 217405a0 relative to the validated 26026ca6 base are byte-identical to the security port in that composition. T1's changed application paths do not overlap them. This count is a diff against 26026ca6, not the older 31-file comparison against the original Atlas branch. No accepted security repair was overwritten.

For all 29 identity-freeze route files, removing only the new no-op guard/import and comments gives syntax-equivalent Production handler bodies to the base. The author suite independently reran 176/176 cases, including its Production/local controls. The separate independent suite passed seven probes reproducing the two credential writes, normal admin/school authorization/freeze and its raw-error disclosure. These passes mean the findings were reproduced, not that the application is accepted. The author's scanner passes its current inventory but fails seven adversarial completeness controls.

After revisions and independent review, CoS should run one matrix on the exact combined source:

- Full compiler/build/unit/route/vault/chunk/coverage gates, including the new detector and direct-handler regressions. Preserve Production/local behavior checks and missing/invalid-session/freshness-error cases.
- The existing seven accepted security harness groups from 217405a0: SEC-R01, R02, R03, R07, AT-R-WAEC, AT-ADJ-01 and AT-ADJ-02. No historical pass substitutes for their combined-source execution.
- Existing six-case school-day browser journey and safe evidence retention; the per-test symlink refusal result; PV-01..06, worker fail-closed and exact URL tests.
- Database integration using an actual restricted role and the accepted grants/RLS/triggers, with root/interactive/nested/raw audit mutation refusals, permitted append, trigger/privilege tamper denial and rollback. Include seed duplicate/partial-failure and re-anchor repeat/new approval/concurrency tests. Mock wrappers alone are insufficient.
- Later, separately authorized protected hosted checks for credentials-only providers, frozen direct APIs and approved callback/cookie origins. No fixture-only password disclosure is permitted to manufacture a smoke result.

No full CI/browser job, hosted migration, Production change, merge or deployment was performed here. Overall identity-freeze acceptance remains **REVISE**; hosted release acceptance remains **BLOCKED**.
