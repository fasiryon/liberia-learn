import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { authorityBoundary, decide, eligibleRepair } from './core.mjs';
import { GitHub } from './github.mjs';
import { FileLedger } from './ledger.mjs';
import { mergePlan } from './plan.mjs';
import { readiness, checkStatus, codeOwners, recordProposals } from './report.mjs';
import { hygieneReport } from './hygiene.mjs';
import { historicalSnapshots, freshness } from './history.mjs';
import { git, collectLocal, relations } from './localgit.mjs';
import { main } from './cli.mjs';

const policy = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url)));
const history = JSON.parse(readFileSync(new URL('./fixtures/history-190-194.json', import.meta.url)));
const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = policy.repository;
const enabled = () => ({ ...structuredClone(policy), autoMerge: true, autoRepair: true, mergeAppId: 123, permissionsReviewed: true, safetyTestsReviewed: true,
  previewDeploymentPolicyReviewed: true, reviewers: { 'correctness-security': ['security-reviewer'], maintainability: ['maintainer'] } });
const approvals = [{ id: 1, user: { login: 'security-reviewer' }, state: 'APPROVED', commit_id: head }, { id: 2, user: { login: 'maintainer' }, state: 'APPROVED', commit_id: head }];
function snapshot(p = enabled(), files = [{ filename: 'docs/guide.md', status: 'modified', patch: '+Clear wording.', additions: 1, deletions: 1 }]) {
  return { complete: true, deploymentSuppressed: true, protectionStatus: 'fetched',
    pr: { number: 7, head: { sha: head, ref: 'change', repo: { full_name: repository } }, base: { sha: base, ref: 'main', repo: { full_name: repository } },
      changed_files: files.length, user: { login: 'author' }, state: 'open', draft: false, mergeable: true, mergeable_state: 'clean' },
    files, reviews: approvals,
    checks: p.requiredChecks.map((c, i) => ({ id: i + 1, name: c.name, app: { id: c.appId }, head_sha: head, status: 'completed', conclusion: 'success' })),
    protection: { restrictions: { apps: [{ id: p.mergeAppId }], users: [{ login: 'fasiryon' }], teams: [] }, enforce_admins: { enabled: true }, allow_force_pushes: { enabled: false },
      required_pull_request_reviews: { required_approving_review_count: 2, dismiss_stale_reviews: true, require_last_push_approval: true, require_code_owner_reviews: true },
      required_status_checks: { strict: true, checks: p.requiredChecks.map(c => ({ context: c.name, app_id: c.appId })) } } };
}
function temp() {
  const dir = mkdtempSync(join(tmpdir(), 'mergeops-'));
  return { dir, cleanup: () => {
    const target = realpathSync(dir);
    if (dirname(target) !== realpathSync(tmpdir()) || !basename(target).startsWith('mergeops-')) throw Error('unsafe-test-cleanup');
    rmSync(target, { recursive: true, force: true });
  } };
}
const pr = (number, ref, baseRef = 'main', extra = {}) => ({ number, head: { ref, sha: String(number).padStart(40, '0') }, base: { ref: baseRef }, updated_at: '2026-10-18T00:00:00Z', ...extra });

// Authority boundary
for (const path of ['curriculum/v2/g7/candidates/math.json', 'public/curriculum-candidates/g7-native-v1/a.svg', 'curriculum/review/g7-native-v1/release-binding.json',
  'curriculum/releases/k12-scope.json', 'lib/learning-authority/releases/grade4Math2026_2.ts', 'lib/academic-records/v2/promotion.ts', 'lib/academics/report.ts',
  'app/api/admin/promotions/promote/route.ts', 'docs/report-card-guide.md']) {
  test(`outside MergeOps authority: ${path}`, () => {
    const files = [{ filename: path, status: 'modified', patch: '+x', additions: 1, deletions: 0 }];
    assert.ok(authorityBoundary(files).length);
    const decision = decide(snapshot(enabled(), files), head, enabled());
    assert.equal(decision.action, 'hold');
    assert.ok(decision.blocks.some(b => b.startsWith('outside-authority:')));
  });
}
test('authority-bearing release keys in a low-risk path are outside authority, and repair is never eligible', () => {
  const files = [{ filename: 'docs/guide.md', status: 'modified', patch: '+set releaseId to the new edition', additions: 1, deletions: 0 }];
  assert.deepEqual(authorityBoundary(files), ['academic-release']);
  assert.ok(decide(snapshot(enabled(), files), head, enabled()).blocks.includes('outside-authority:academic-release'));
  const renamed = [{ filename: 'docs/x.md', previous_filename: 'lib/academic-records/v2/x.md', status: 'modified', patch: '+x' }];
  assert.deepEqual(authorityBoundary(renamed), ['student-records']);
  const s = snapshot(enabled(), renamed);
  assert.equal(eligibleRepair(s, { recipe: 'textbook-fixture-v1' }, 0, enabled()), false);
});
test('authority boundary cannot be cleared by policy flags, approvals or green checks', () => {
  const p = { ...enabled(), adapters: { pstack: true, ponytail: true } };
  const files = [{ filename: 'curriculum/releases/k12-scope.json', status: 'modified', patch: '+x', additions: 1, deletions: 0 }];
  const s = snapshot(p, files);
  s.reviews = [...approvals, { id: 3, user: { login: 'fasiryon' }, state: 'APPROVED', commit_id: head }];
  assert.ok(decide(s, head, p).blocks.includes('outside-authority:academic-release'));
});

// CI success is never human approval
test('green exact-head CI with no reviews is awaiting review, never ready, and automation holds', () => {
  const s = snapshot(enabled()); s.reviews = [];
  const r = readiness(s, enabled());
  assert.ok(r.ci.every(c => c.state === 'success'));
  assert.equal(r.status, 'awaiting-review');
  assert.equal(decide(s, head, enabled()).action, 'hold');
  assert.ok(decide(s, head, enabled()).blocks.includes('independent-reviews-required'));
});
test('bot comments, stale approvals and author self-approval do not count as reviews', () => {
  const s = snapshot(enabled());
  s.reviews = [{ id: 1, user: { login: 'chatgpt-codex-connector[bot]' }, state: 'COMMENTED', commit_id: head },
    { id: 2, user: { login: 'security-reviewer' }, state: 'APPROVED', commit_id: 'c'.repeat(40) },
    { id: 3, user: { login: 'author' }, state: 'APPROVED', commit_id: head }];
  const p = enabled(); p.reviewers.maintainability.push('author');
  const r = readiness(s, p);
  assert.equal(r.status, 'awaiting-review');
  assert.match(r.requirements[0], /stale approvals: 1/);
});
test('readiness is ready-for-human-merge only with complete evidence; automation remains disabled', () => {
  const r = readiness(snapshot(enabled()), enabled());
  assert.equal(r.status, 'ready-for-human-merge');
  assert.equal(r.automation, 'disabled');
  const dflt = readiness(snapshot(policy), policy);
  assert.notEqual(dflt.status, 'ready-for-human-merge');
  assert.ok(dflt.repositoryGaps.includes('merge-disabled'));
});
test('exact-head CI tracking distinguishes missing, pending, failed, wrong-App and other-SHA runs', () => {
  const s = snapshot(enabled());
  s.checks = [{ id: 1, name: 'build', app: { id: 15368 }, head_sha: head, status: 'in_progress', conclusion: null },
    { id: 2, name: 'runtime-gate', app: { id: 15368 }, head_sha: head, status: 'completed', conclusion: 'failure' },
    { id: 3, name: 'safety', app: { id: 999 }, head_sha: head, status: 'completed', conclusion: 'success' },
    { id: 4, name: 'GitGuardian Security Checks', app: { id: 46505 }, head_sha: 'c'.repeat(40), status: 'completed', conclusion: 'success' }];
  assert.deepEqual(checkStatus(s, policy, head).map(c => c.state), ['pending', 'failed:failure', 'wrong-app', 'missing']);
  const r = readiness(s, enabled());
  assert.equal(r.status, 'blocked');
  assert.ok(['check:build', 'check:runtime-gate', 'check:safety', 'check:GitGuardian Security Checks'].every(b => r.blockers.includes(b)));
});
test('CODEOWNERS requirements follow anchored paths with last match winning', () => {
  const text = '# c\n/.github/ @fasiryon\n/tools/mergeops/ @fasiryon\n/docs/ops/MERGEOPS_V1.md @ops @fasiryon\n';
  assert.deepEqual(codeOwners(text, ['tools/mergeops/core.mjs']), ['@fasiryon']);
  assert.deepEqual(codeOwners(text, ['docs/ops/MERGEOPS_V1.md']), ['@fasiryon', '@ops']);
  assert.deepEqual(codeOwners(text, ['app/page.tsx', 'tools/mergeopsx/a']), []);
});

// Dependency ordering
test('stacked PRs follow their parent; merged and unknown bases need retargeting', () => {
  const plan = mergePlan([pr(3, 'child', 'parent'), pr(2, 'parent'), pr(4, 'orphan', 'gone-branch'), pr(5, 'late', 'merged-branch')], { mergedRefs: ['merged-branch'] });
  const order = plan.order.map(o => o.number);
  assert.ok(order.indexOf(2) < order.indexOf(3));
  assert.deepEqual(plan.order.find(o => o.number === 3).dependsOn, [2]);
  assert.ok(plan.order.find(o => o.number === 4).notes.includes('unknown-base:gone-branch'));
  assert.ok(plan.order.find(o => o.number === 5).notes.includes('retarget-required:merged-branch-already-merged'));
  assert.equal(plan.authority, 'recommendation-only');
});
test('shared history orders the PR with less unique history first; overlap requires revalidation', () => {
  const plan = mergePlan([pr(191, 'b'), pr(190, 'a'), pr(193, 'c'), pr(194, 'd')], { relations: [
    { a: 190, b: 191, sharedCommits: 15, uniqueA: 3, uniqueB: 16, overlappingFiles: 311 }, { a: 193, b: 194, sharedCommits: 0, uniqueA: 14, uniqueB: 9, overlappingFiles: 1 }] });
  assert.deepEqual(plan.order.map(o => o.number), [190, 191, 193, 194]);
  assert.deepEqual(plan.order.find(o => o.number === 191).revalidateAfter, [190]);
  assert.deepEqual(plan.order.find(o => o.number === 194).revalidateAfter, [193]);
  assert.match(plan.rule, /exact-head CI/);
});
test('ready PRs are recommended first among independent PRs; cycles and idle PRs are not ordered', () => {
  assert.deepEqual(mergePlan([pr(1, 'a'), pr(2, 'b')], { ready: new Set([2]) }).order.map(o => o.number), [2, 1]);
  const cycle = mergePlan([pr(1, 'a', 'b'), pr(2, 'b', 'a'), pr(3, 'c')]);
  assert.deepEqual(cycle.cycles, [1, 2]);
  assert.deepEqual(cycle.order.map(o => o.number), [3]);
  const idle = mergePlan([pr(1, 'old'), pr(2, 'new')], { idle: new Set([1]), relations: [{ a: 1, b: 2, sharedCommits: 9, uniqueA: 1, uniqueB: 5 }] });
  assert.deepEqual(idle.order.map(o => o.number), [2]);
  assert.deepEqual(idle.parked, [{ number: 1, reason: 'idle-owner-decision' }]);
});

// Hygiene
test('hygiene proposes only; dirty worktrees, open-PR branches and main are never removal candidates', () => {
  const report = hygieneReport({ now: '2026-10-19T00:00:00Z', staleDays: 14,
    worktrees: [{ path: '/r', branch: 'main', head }, { path: '/w/dirty', branch: 'merged-a', head, dirty: 3 }, { path: '/w/clean', branch: 'merged-b', head, dirty: 0 },
      { path: '/w/pr', branch: 'open-a', head, dirty: 0 }, { path: '/w/gone', branch: null, head, prunable: true, dirty: null }].map(w => ({ dirty: 0, ...w })),
    branches: [{ ref: 'main', sha: head, committedAt: '2026-01-01T00:00:00Z' }, { ref: 'merged-a', sha: head, committedAt: '2026-10-18T00:00:00Z' },
      { ref: 'merged-b', sha: head, committedAt: '2026-10-18T00:00:00Z' }, { ref: 'open-a', sha: head, committedAt: '2026-01-01T00:00:00Z' },
      { ref: 'old', sha: head, committedAt: '2026-01-01T00:00:00Z' }, { ref: 'origin/merged-c', remote: true, sha: head, committedAt: '2026-10-18T00:00:00Z' }],
    merged: ['main', 'merged-a', 'merged-b', 'origin/merged-c'], openPrs: [pr(9, 'open-a', 'main', { updated_at: '2026-01-01T00:00:00Z' })] });
  const targets = report.proposals.map(p => `${p.kind}:${p.target}`);
  assert.ok(targets.includes('remove-worktree:/w/clean'));
  assert.ok(targets.includes('prune-worktree-record:/w/gone'));
  assert.ok(targets.includes('ask-owner:/w/dirty'));
  assert.ok(targets.includes('delete-remote-branch:origin/merged-c'));
  assert.ok(targets.includes('ask-owner:old'));
  assert.ok(targets.includes('ask-owner:#9'));
  assert.ok(!targets.some(t => /(?:remove|delete).*(?:dirty|main|open-a|merged-a)$/.test(t)));
  assert.equal(report.branches.find(b => b.ref === 'open-a').category, 'open-pr-stale');
  assert.ok(report.proposals.every(p => p.requiresHuman === true && p.executed === false));
});
test('local Git runner refuses every mutating or output-redirecting command', () => {
  for (const args of [['branch', '-D', 'x'], ['worktree', 'remove', 'x'], ['worktree', 'prune'], ['push'], ['fetch'], ['reset', '--hard'], ['gc'],
    ['diff', '--output=x'], ['diff', '--outp=x'], ['diff', '--ext-diff'], ['diff', '--no-index', '/etc/passwd', 'x'], ['status', '--porcelain', '-c'],
    ['rev-list', '--all', '--objects'], ['cat-file', 'blob', 'HEAD'], ['config', 'x', 'y']]) assert.throws(() => git('.', args), /git-not-read-only/);
});
test('hygiene never proposes removing the primary, locked, env-holding or junction-target worktrees, or open PR bases', () => {
  const report = hygieneReport({ now: '2026-10-19T00:00:00Z', staleDays: 14,
    worktrees: [{ path: '/r', branch: null, detached: true, head, dirty: 0, primary: true }, { path: '/w/locked', branch: null, detached: true, head, dirty: 0, locked: true },
      { path: '/w/env', branch: 'merged-a', head, dirty: 0, localSecrets: 1 }, { path: '/w/modules', branch: 'merged-b', head, dirty: 0, junctionTarget: true }],
    branches: [{ ref: 'merged-a', sha: head, committedAt: '2026-10-18T00:00:00Z' }, { ref: 'merged-b', sha: head, committedAt: '2026-10-18T00:00:00Z' },
      { ref: 'origin/stack-base', remote: true, sha: head, committedAt: '2026-10-18T00:00:00Z' }, { ref: 'origin/merged-a', remote: true, sha: head, committedAt: '2026-10-18T00:00:00Z' }],
    merged: ['merged-a', 'merged-b', 'origin/stack-base', 'origin/merged-a'], openPrs: [pr(195, 'child', 'stack-base')] });
  assert.deepEqual(report.worktrees.map(w => w.category), ['primary-checkout', 'locked', 'local-env-owner-review', 'junction-target']);
  assert.deepEqual(report.proposals.map(p => `${p.kind}:${p.target}`), ['ask-owner:/w/env']);
  assert.throws(() => hygieneReport({ now: '2026-10-19T00:00:00Z', staleDays: NaN }), /invalid-stale-days/);
});
test('cycle members and parked PRs are blocked; fork heads cannot become a stacked base; unevaluated PRs are marked', () => {
  const plan = mergePlan([pr(1, 'a', 'b'), pr(2, 'b', 'a')], { evaluated: new Set([1]) });
  assert.deepEqual(plan.cycles, [1, 2]);
  const fork = { ...pr(9, 'stack-base'), head: { ref: 'stack-base', sha: '9'.repeat(40), repo: { full_name: 'attacker/fork' } } };
  const forked = mergePlan([fork, pr(8, 'child', 'stack-base')], { repository, mergedRefs: ['stack-base'], evaluated: new Set([8]) });
  const child = forked.order.find(o => o.number === 8);
  assert.deepEqual(child.dependsOn, []);
  assert.ok(child.notes.includes('retarget-required:stack-base-already-merged'));
  assert.ok(forked.order.find(o => o.number === 9).notes.includes('not-evaluated:readiness-unknown'));
  const s = snapshot(enabled()); s.pr.number = 1;
  assert.equal(readiness(s, enabled(), { extraBlockers: ['dependency-cycle'] }).status, 'blocked');
});
test('author self-approval alone never satisfies the second review', () => {
  const s = snapshot(enabled());
  s.pr.user.login = 'maintainer';
  assert.equal(readiness(s, enabled()).status, 'awaiting-review');
  assert.ok(decide(s, head, enabled()).blocks.includes('independent-reviews-required'));
});
test('collectLocal and relations read a real repository without changing it', () => {
  const { dir, cleanup } = temp();
  try {
    const repo = join(dir, 'repo'), run = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', windowsHide: true }).trim();
    execFileSync('git', ['init', '-q', '-b', 'main', repo], { windowsHide: true });
    for (const k of [['user.email', 't@example.test'], ['user.name', 'T'], ['commit.gpgsign', 'false']]) run('config', ...k);
    writeFileSync(join(repo, 'a.txt'), '1'); run('add', 'a.txt'); run('commit', '-qm', 'base');
    run('branch', 'origin-main-mirror'); run('update-ref', 'refs/remotes/origin/main', 'HEAD');
    run('checkout', '-qb', 'one'); writeFileSync(join(repo, 'b.txt'), '1'); run('add', 'b.txt'); run('commit', '-qm', 'shared');
    run('checkout', '-qb', 'two'); writeFileSync(join(repo, 'c.txt'), '1'); run('add', 'c.txt'); run('commit', '-qm', 'two');
    run('checkout', '-q', 'one'); writeFileSync(join(repo, 'd.txt'), '1'); run('add', 'd.txt'); run('commit', '-qm', 'one');
    run('worktree', 'add', '-q', join(dir, 'wt'), 'two'); writeFileSync(join(dir, 'wt', 'untracked.txt'), 'x');
    const before = run('for-each-ref'), status = run('status', '--porcelain');
    const local = collectLocal(repo, 'origin/main');
    assert.equal(local.worktrees.find(w => w.branch === 'two').dirty, 1);
    assert.ok(local.merged.includes('origin-main-mirror'));
    const rel = relations(repo, run('rev-parse', 'origin/main'), [{ number: 1, head: { sha: run('rev-parse', 'one') } }, { number: 2, head: { sha: run('rev-parse', 'two') } }, { number: 3, head: { sha: 'f'.repeat(40) } }]);
    assert.deepEqual(rel.relations, [{ a: 1, b: 2, sharedCommits: 1, uniqueA: 1, uniqueB: 1, overlappingFiles: 1 }]);
    assert.deepEqual(rel.missing, [3]);
    assert.equal(run('for-each-ref'), before);
    assert.equal(run('status', '--porcelain'), status);
    assert.ok(existsSync(join(dir, 'wt', 'untracked.txt')));
  } finally { cleanup(); }
});

// Permission failures and audit
test('unauthenticated reads send no credentials; protection permission failures are recorded and block', async () => {
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push(init.headers);
    const path = new URL(url).pathname;
    if (path.endsWith('/protection')) return new Response('{"message":"Requires authentication"}', { status: 401 });
    if (path.endsWith('/pulls/7')) return Response.json(snapshot(policy).pr);
    if (path.includes('/contents/vercel.json')) return Response.json({ type: 'file', encoding: 'base64', size: 10, content: Buffer.from('{}').toString('base64') });
    if (path.endsWith('/check-runs')) return Response.json({ check_runs: [] });
    if (path.endsWith('/files')) return Response.json(snapshot(policy).files);
    return Response.json([]);
  };
  const s = await new GitHub(repository, undefined, fetcher).snapshot(7, policy);
  assert.ok(seen.every(h => !('Authorization' in h)));
  assert.equal(s.protectionStatus, 'unavailable:401');
  assert.ok(decide(s, head, policy).blocks.includes('protection-unverified'));
  const failing = new GitHub(repository, 'ghs_secret', async url => new URL(url).pathname.endsWith('/protection') ? new Response('', { status: 500 }) : fetcher(url, { headers: {} }));
  await assert.rejects(failing.snapshot(7, policy), /github:GET:500/);
});
test('every proposal is recorded once as proposed-only, hash-chained audit evidence', async () => {
  const { dir, cleanup } = temp();
  try {
    const ledger = new FileLedger(join(dir, 'audit.jsonl'));
    const r = readiness(snapshot(policy), policy);
    const report = { mode: 'test', repository, generatedAt: '2026-10-19T00:00:00Z', inputs: { a: 1 }, readiness: [r],
      plan: mergePlan([pr(7, 'change')]), hygiene: { proposals: [{ kind: 'ask-owner', target: '#1', reason: 'idle', requiresHuman: true, executed: false }] } };
    assert.equal(await recordProposals(ledger, report), 3);
    assert.equal(await recordProposals(ledger, report), 0);
    const records = ledger.read();
    assert.deepEqual(records.map(x => x.type), ['readiness-proposal', 'merge-order-proposal', 'hygiene-proposal']);
    assert.ok(records.every(x => x.proposedOnly === true && x.executed === false && x.hash));
    // Same inputs and head, but a check finished: the changed readiness must still be recorded.
    const later = snapshot(policy); later.checks[0].status = 'in_progress';
    assert.equal(await recordProposals(ledger, { ...report, readiness: [readiness(later, policy)] }), 1);
    assert.equal(ledger.read().length, 4);
  } finally { cleanup(); }
});

// Historical fixtures #190, #191, #193, #194
test('historical replay fails closed on unrecoverable evidence and never reports a PR ready', () => {
  const snapshots = historicalSnapshots(history);
  assert.deepEqual(snapshots.map(s => s.pr.number), [190, 191, 193, 194]);
  for (const s of snapshots) {
    const r = readiness(s, policy, { codeowners: history.codeowners });
    assert.equal(r.status, 'blocked');
    assert.ok(r.blockers.includes('incomplete-evidence') && r.blockers.includes('not-clean-mergeable'));
    assert.deepEqual(r.ci.filter(c => c.state === 'missing').map(c => c.name), ['runtime-gate', 'safety']);
    assert.ok(r.ci.filter(c => ['build', 'GitGuardian Security Checks'].includes(c.name)).every(c => c.state === 'success'));
    assert.match(r.requirements[0], /current-head approvals: 0/);
  }
  const domains = Object.fromEntries(snapshots.map(s => [s.pr.number, decide(s, s.pr.head.sha, policy).blocks.filter(b => b.startsWith('outside-authority:')).sort()]));
  assert.deepEqual(domains[191], ['outside-authority:academic-release', 'outside-authority:candidate-content']);
  assert.deepEqual(domains[193], ['outside-authority:student-records']);
  assert.deepEqual(domains[194], ['outside-authority:student-records']);
});
test('historical CI freshness and dependency order match the recorded merges', () => {
  const fresh = Object.fromEntries(freshness(history, policy.requiredChecks.map(c => c.name)).map(f => [f.number, f]));
  assert.equal(fresh[190].freshCi, true);
  assert.deepEqual(fresh[191].baseAdvancedBy, [190]);
  assert.deepEqual(fresh[194].baseAdvancedBy, [190, 191, 193]);
  const plan = mergePlan(historicalSnapshots(history).map(s => s.pr), { relations: history.relations });
  assert.deepEqual(plan.order.map(o => o.number), [190, 191, 193, 194]);
  assert.deepEqual(plan.order[1].dependsOn, [190]);
});
test('history CLI runs offline, writes audit evidence and performs no network call', async () => {
  const { dir, cleanup } = temp();
  const original = globalThis.fetch, log = console.log;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('network-forbidden'); };
  console.log = () => {};
  try {
    const report = await main(['history', new URL('./fixtures/history-190-194.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), '--out', dir]);
    assert.equal(calls, 0);
    assert.deepEqual(report.readiness.map(r => r.status), ['blocked', 'blocked', 'blocked', 'blocked']);
    assert.equal(new FileLedger(join(dir, 'audit.jsonl')).read().length, 8);
    assert.match(readFileSync(join(dir, 'report.md'), 'utf8'), /nothing was merged, repaired, deleted or deployed/);
  } finally { globalThis.fetch = original; console.log = log; cleanup(); }
});
