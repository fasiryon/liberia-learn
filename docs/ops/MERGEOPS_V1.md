# MergeOps V1

Status: review-ready implementation; autonomous repair and merge are OFF.
No GitHub App was installed, hosted service started, database changed, or deployment requested.

## Discovery and scope

Baseline: `a1508ceaf7d89a338de624e9f63c9c4c592ca28c` on `origin/main`.
The shared checkout contained unrelated student-experience work; this implementation
uses `.task-worktrees/mergeops-v1` and `feat/mergeops-v1`.

Existing systems reused:

- `CI / build`: API policy audit, types, Vitest, OS vault tests, Next build and browser fixtures.
- CI now explicitly uses read-only permissions, no persisted checkout credentials and full Git history, so the existing API audit's historical baseline is available. Runtime Gate also uses read-only permissions and no persisted credentials.
- `Runtime Gate 1 / runtime-gate`: existing permission/final-gate tests. V1 adds its missing PR trigger; previously it ran only after a push to main despite being documented as required before merge.
- GitGuardian checks and the existing Codex GitHub review integration. Neither a bot comment nor a successful check substitutes for two independent exact-head approvals.
- `lib/autonomous/workflowStateManager.ts`: `createWorkflowRun` and `recordWorkflowCheckpoint`. `tools/mergeops/missionBridge.mjs` imports verified ledger entries through these existing writers, using stable idempotency keys. It requires separately authorized application execution and is not run by CI.
- Existing agent invocation/cost infrastructure is retained. No duplicate agent runtime, educational event writer, database table, migration, or provider dependency is added.
- The OS vault daemon provides bounded context assembly, not engineering delivery or merge authority. No engineering mission ledger was found.

Live read-only discovery on 2026-10-15 found no repository rulesets. Classic
`branches/main/protection` returned 403 through the connector. Protection is
therefore **unverified**, not assumed absent or configured. The old PR Triage
workflow only emits a disabled message. ECS deployment is manually dispatched;
Vercel's Git integration already creates previews independently of Actions.

V1 intentionally defines low risk as a small, complete documentation/test-only
diff. Application code, tenancy, authentication, student evidence, grading,
curriculum, migrations, flags, dependencies, secrets, workflows, deployment and
MergeOps policy changes escalate. Rename/deletion, missing patches, oversized
diffs and unknown paths escalate too. This is conservative scope, not a claim
that regexes prove application correctness.

## Entry points and trust boundaries

`tools/mergeops/core.mjs` implements independent deterministic security/correctness
and maintainability scans. Semantic approval comes from two distinct configured
GitHub reviewers, each reviewing the exact head SHA. Existing Codex review can be
one source after its identity and role are reviewed. Reviewer lists are empty
by default. PR authors cannot approve their own changes; dismissed/stale approvals
and change requests block merging. Adapter findings can advise but cannot waive a gate.

`mergeops.yml` observes PR opening, updates, closure and CI completion using
read-only `GITHUB_TOKEN`. It checks out **main**, never PR content, installs no
packages and executes no downloaded artifact. The introduction PR cannot execute
the controller from main until it has been merged; the workflow explicitly skips
that first observation. Reports are retained as GitHub artifacts for 90 days.
`mergeops-safety.yml` tests PR code in a separate ordinary `pull_request` workflow
without secrets or write permissions. Existing required checks stay mandatory.

`node tools/mergeops/app.mjs` is the optional App webhook host. Do not start it or
provision its ingress until separately authorized. It binds loopback; an operator
must provide authenticated TLS ingress, monitoring and redelivery. The host
verifies raw-body HMAC SHA-256, installation identity and repository, bounds input,
serializes local requests, and returns failure for redelivery if busy. Signed
`pull_request`, `pull_request_review`, `check_run` and `workflow_run` events refresh
live PR evidence. GitHub has no dedicated conflict event; every refresh checks
mergeability and holds unknown/conflicting states. PR bodies, diffs, logs and
plugin output are data, never controller instructions.

No PR checkout or process runs in the privileged controller. The repair engine
performs data-only transformations using GitHub blobs; no shell, Git hook,
package lifecycle, test, or generated code executes with App credentials.
Standard CI runs candidate code separately on ephemeral GitHub runners, without
App keys or deployment secrets. Do not use shared/self-hosted runners for this lane.

## Repair and merge state machine

1. Fetch live metadata, every changed-file/review/check page, protection and Vercel configuration. Re-read PR head/base; incomplete evidence fails closed.
2. Hash and redact diffs; record the decision, checks, reviewer IDs, protection evidence and cost in the ledger before any external mutation.
3. Parse failed job logs from GitHub; bounded signed downloads do not receive the App bearer token. Unknown failures and security/migration failures require human investigation.
4. The only executable recipe is `textbook-fixture-v1`: replace one exact historical `git show` call, remove its child-process import, and check in the exact source from pinned commit `2bf94c11df127292a1863b75cc338a462204d0a2`. Every output byte and both allowed paths are reconstructed and compared before publication. No general LLM-generated patch is executable.
5. Repair requires explicit enablement, reviewed safety/permissions/deployment settings, a complete low-risk same-repository PR and passing mandatory security evidence. Reserve an attempt durably first. Maximum two attempts per original PR, including failures, across all heads; maximum one per head. Re-delivery never resets the counter.
6. Build a commit parented by the exact PR head, create a new `mergeops-repair-*` branch and open a replacement PR against main. The original branch is untouched. No force update is used. Normal PR CI and reviews rerun on the new head; no checks are rewritten or waived. The original PR remains held for human supersession/closure. Before branch creation, committed Vercel configuration must suppress repair previews with no positive override.
7. Merge only a low-risk PR with all exact-head checks green from their configured App IDs, both independent approvals, code-owner approval, strict/up-to-date branch protection, stale-review dismissal, last-push approval, no bypass allowances, and verified restricted merge authority. High-risk PRs always require founder handling through the protected normal review/merge process; founder approval never overrides failed checks or a migration gate. V1 does not automatically merge high-risk PRs even after approval.
8. Before merge, reserve intent, refetch the entire evidence set and reject changed head/base. Call GitHub's merge API with `sha` and record the returned merge commit. A failed or ambiguous merge is not automatically retried. A later closed-PR event records the observed merge commit for crash reconciliation. Reconcile reserved-but-unfinished operations before any manual retry; never delete reservations to reset limits.

## GitHub App permission configuration — review required

Create/install nothing as part of this PR. Proposed deployment uses separate App
identities so reviewers, ledger writers and repair workers cannot act as merger.
Installation tokens are repository-scoped, minted per role, short-lived, never
written to Git configuration, and revoked in `finally`. The App private key stays
on the trusted controller host; no key is passed to candidate code.

| Role / environment prefix | Repository permissions | Authority |
| --- | --- | --- |
| Observer `MERGEOPS` | contents, pull requests, checks, actions, administration: read | Protection/diff/CI inspection; no mutation |
| Ledger `MERGEOPS_STATE` | contents: write | Only protected `mergeops-ledger/**` refs; deny pushing main |
| Repair `MERGEOPS_REPAIR` | contents, pull requests: write | Isolated repair refs and PR creation; deny pushing main |
| Merger `MERGEOPS_MERGE` | contents, pull requests: write | Protected main only after all gates; no bypass status |

Each prefix needs `_APP_ID`, `_INSTALLATION_ID`, `_KEY_FILE` (protected absolute
key path). Observer additionally needs `MERGEOPS_WEBHOOK_SECRET`; optional
`MERGEOPS_PORT` defaults to 8787. Do not use PATs. The read-only Actions observer
uses the workflow's scoped GitHub token, not an App key. Grant no workflow write,
check/status write, deployments, secrets, or administration write permission.

Before enablement, an administrator must review/install the Apps separately and:

- Protect main against force/deletion and bypass, including administrators and all Apps. Require strict current-base checks, at least two approvals, stale dismissal, last-push approval and CODEOWNERS. Main's push restrictions must contain only the configured merger App and explicitly listed founders; no teams or other Apps.
- Bind required checks to their producer App IDs. The expected contexts are `build`, `runtime-gate`, `safety` (GitHub Actions App 15368) and `GitGuardian Security Checks` (46505). Verify actual check identities before configuring; no skipped/neutral results count as success. Additional protected-branch contexts are also enforced. Unbound status contexts fail closed.
- Protect state refs from human/repair/merger overwrite or deletion; allow only the state App to append. Review GitHub rulesets for repair-ref restrictions and forbidden main pushes. Do not grant these actors bypass rights.
- Set actual reviewer identities, merger App ID and reviewed flags in a founder-reviewed policy PR. CODEOWNERS requests founder review for policy/workflow/Vercel changes; protection must enforce it. A code agent cannot approve its own policy revision.
- Review and suppress all automatic deployment integrations before enabling auto-merge. V1 requires `vercel.json` to contain `git.deploymentEnabled: false` plus explicit deployment-policy review. The current PR suppresses only MergeOps branch patterns, so merging main remains blocked even if somebody merely flips `autoMerge`.

The program never changes branch protection, App permissions, deployment settings
or its own policy. `autoMerge`, `autoRepair`, `permissionsReviewed`,
`safetyTestsReviewed` and `previewDeploymentPolicyReviewed` start false.

## Durable mission ledger

Each PR uses an orphan Git state branch `mergeops-ledger/pr-N`, containing only
`ledger.jsonl` and deployment-disabled `vercel.json`. Records contain decision,
redacted diff and digest, head/base, delivery ID, evidence, proposals, attempts,
costs and merge commits. Every record hashes its predecessor. Git updates are
non-force fast-forwards: concurrent sibling updates fail rather than lose a
reservation. Missing state/protection/ledger access blocks mutation. Provisioning
this state branch is an App-host operation, not a CI side effect in this PR.

Local replay uses an exclusive lock, append and fsync. A stale local lock needs
operator reconciliation; it is never silently stolen. The Git state branch is
the durable operational source; 90-day Actions artifacts are a dry-run handoff,
not permanent mission storage. Keep protected refs backed up. At the bounded
Contents API size limit, stop and archive/rotate through an operator-reviewed
procedure; do not truncate history. A hash chain detects edits but is not a
substitute for protected refs or independent backup.

The bridge accepts verified records and injected existing workflow writers:
`importMission(records, { createWorkflowRun, recordWorkflowCheckpoint })`.
This creates an approval-required engineering workflow and idempotent checkpoints,
without claiming educational authority or adding learner events itself.
No application/database credentials are available to the Actions observer.

## Vercel budgets and deployment policy

`budget.mjs` counts unique deployment IDs and attributes **measured** CPU minutes
by project/PR/exact SHA/month. It rejects conflicting records. Missing CPU data
is reported as unknown, never estimated from GitHub duration or treated as zero.
Monthly limits default to zero/unconfigured, blocking preview approval. CLI
output and durable alert records fire at configured fractions (50/80/100%). No
paid tier, build machine, concurrency, billing setting or Vercel token is changed.

Import a trusted operator export, not PR-supplied artifacts:

```json
[{"id":"deployment-id","project":"project-id","pr":190,"sha":"<40-character SHA>","createdAt":"2026-10-15T12:00:00Z","cpuMinutes":null,"evidenceUrl":"https://vercel.com/team/project/deployment-id"}]
```

`cpuMinutes` must be Vercel's measured value; null means unavailable. The CLI
persists the input/report and deduplicated monthly alerts in
`artifacts/mergeops-budget/usage.jsonl`. Run from a durable trusted workspace or
archive these records to protected mission storage. Live usage is **not collected
or certified by this PR**. No fabricated monthly total or dollar spend is reported.
The current adapter consumes exports; it does not silently infer an evolving
Vercel REST response schema or create a paid telemetry service.

The committed Vercel branch rules prevent automation-branch previews. The optional
`node tools/mergeops/ignore-build.mjs` is an Ignored Build Step supplied for separate
operator activation: zero skips, one builds. It skips automation/docs/test-only
changes, missing history/evidence, over-budget previews and anything lacking
exact-head approval. A protected `MERGEOPS_PREVIEW_EVIDENCE` file carries the
operator-generated usage/approval report; do not allow PRs to choose that file.
It is not wired into the current project's production build path. It also skips
non-preview environments; production deployment requires a separate authorized
release path. A global team budget needs one serialized reservation authority
before previews are enabled; V1 does not claim that an exported usage snapshot
prevents concurrent unrelated projects from overspending a team allowance.

## Optional plugin evaluation

Installed local packages inspected: PStack `pstack-plugin/0.2.0`, Ponytail
`engineering-suite-ponytail/2.0.0`. PStack is a curated skills-only port from
`cursor/plugins/pstack`; its idempotency principle informed durable reservations.
Ponytail is a bundled maintainability/over-engineering review workflow. It is
not a correctness/security review. Neither package provides a hosted reviewer,
sandbox, App credential or merge service. No runtime dependency or automatic
plugin updater is introduced. Thermos was unavailable and is omitted, not installed.

`adapters.mjs` accepts bounded advisory reports for explicitly enabled PStack or
Ponytail, with exact head, package hash, role, findings and measured review cost.
An installed plugin is not automatically enabled. Run any future adapter in an
isolated read-only executor, pin and review its package, redact its inputs and
record the report/cost in the mission ledger. Plugin output cannot add write
paths, approve its own PR, change policy or suppress security findings. V1 does
not invoke a paid model or pretend deterministic scans are independent LLM reviews.

## Validation and replay

```powershell
node --test tools/mergeops/*.node-test.mjs
node tools/mergeops/demo.mjs
npm.cmd run validate:changed
node tools/mergeops/cli.mjs budget trusted-vercel-export.json 2026-10
```

`fixtures/pr190.json` records the real earlier failing
[run 38770187062](https://github.com/fasiryon/liberia-learn/actions/runs/38770187062),
job 116543652921, head `3a493ebd81acc9ce90799234f65bb8ce92bab197` and the exact
historical test/source. A real temporary shallow clone reproduces unavailable
history, then verifies the recipe reads the exact checked-in source. The full
PR contains application/authority changes and is not declared repair-eligible.
The replay isolates a fixture-only diff to exercise the safe repair contract.
Later head `fcccde613f10aae947e0daf0d18baf3ec7aab5b1` already checks in the fixture;
its [run 38771835378](https://github.com/fasiryon/liberia-learn/actions/runs/38771835378)
failed a separate browser gutter assertion. No claim that the original fixture
failure is still outstanding, and no unrelated UI repair is attempted.

`fixtures/pr188.json` preserves the real schema-first merge warning and migration
identity. Replay escalates the migration even with simulated green CI and founder
approval; separate tests ensure failed mandatory security cannot be overridden.
PR #188 is already merged historically. This replay does not certify or mutate
its hosted migration state.

Safety coverage includes stale head/base/reviews/checks, identity spoofing,
pending reruns, unknown protection, bypass permissions, malicious PR instructions,
forks/conflicts, missing patches, bounded repairs, forbidden writes, repeated
events, cross-head attempt limits, ledger failures/concurrency/tampering, HMAC,
secret redaction, measured usage attribution and zero dry-run deployment/write
calls. Merge and repair API side effects are tested with in-memory transports;
they are not live GitHub operations. App installation and permission review are
operator gates, not claimed as tested against a live installation.

Next handoff: review the PR's safety results, permission separation, deployment
policy and the actual branch-protection configuration. Keep all enablement flags
off until that review and separate installation/operation authorization.

## Protocol sources

- [GitHub App permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)
- [GitHub exact-head merge API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)
- [Vercel Git deployment rules](https://vercel.com/docs/project-configuration/git-configuration)
- [Vercel Ignored Build Step semantics](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel)
- [Vercel measured build CPU minutes](https://vercel.com/changelog/deployments-now-show-billable-duration-and-cpu-minutes)
