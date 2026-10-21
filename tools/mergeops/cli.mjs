import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GitHub } from './github.mjs';
import { FileLedger } from './ledger.mjs';
import { lifecycle, eventTargets } from './controller.mjs';
import { buildUsage } from './budget.mjs';
import { digest, redact } from './core.mjs';
import { mergePlan } from './plan.mjs';
import { readiness, recordProposals, markdown } from './report.mjs';
import { hygieneReport } from './hygiene.mjs';
import { historicalSnapshots, freshness } from './history.mjs';
import { collectLocal, relations, git } from './localgit.mjs';

const option = (args, name) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
// Read-only reporting: writes only local report files and an append-only proposal ledger.
async function publish(report, dir) {
  mkdirSync(dir, { recursive: true });
  const proposalsWritten = await recordProposals(new FileLedger(resolve(dir, 'audit.jsonl')), report);
  writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(dir, 'report.md'), markdown(report) + '\n');
  console.log(markdown(report));
  console.log(`\n${proposalsWritten} new proposal record(s) appended to ${resolve(dir, 'audit.jsonl')}`);
  return report;
}
export function assemble({ mode, policy, snapshots, prs, rels = [], mergedRefs = [], idle = new Set(), codeowners, notes = [], hygiene = null, inputs, generatedAt = new Date().toISOString() }) {
  const first = snapshots.map(s => readiness(s, policy, { codeowners }));
  const plan = mergePlan(prs, { base: policy.base, repository: policy.repository, relations: rels, mergedRefs, idle, evaluated: new Set(snapshots.map(s => s.pr.number)),
    ready: new Set(first.filter(r => r.status === 'ready-for-human-merge').map(r => r.number)) });
  const open = new Set(prs.map(p => p.number));
  // Cycle members and parked PRs are never ready: their dependencies were not resolved.
  const unresolved = n => plan.cycles.includes(n) ? ['dependency-cycle'] : plan.parked.some(p => p.number === n) ? ['parked-idle-owner-decision'] : [];
  const evaluated = snapshots.map(s => readiness(s, policy, { codeowners, extraBlockers: unresolved(s.pr.number),
    openDependencies: (plan.order.find(o => o.number === s.pr.number)?.dependsOn ?? []).filter(n => open.has(n)) }));
  return { mode, repository: policy.repository, generatedAt, automation: { autoMerge: policy.autoMerge, autoRepair: policy.autoRepair },
    readiness: evaluated.map(({ decision, ...r }) => ({ ...r, classificationReasons: decision.classification.reasons.length })), plan, hygiene, notes, inputs };
}
function localHygiene(policy, openPrs, staleDays) {
  const local = collectLocal(process.cwd(), `origin/${policy.base}`);
  return hygieneReport({ ...local, openPrs, now: new Date().toISOString(), staleDays });
}

export async function main(args = process.argv.slice(2)) {
  const policy = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'));
  if (args[0] === 'budget') {
    const rows = JSON.parse(readFileSync(args[1], 'utf8'));
    const usage = buildUsage(rows, args[2], policy.budget);
    const dir = resolve('artifacts/mergeops-budget'); mkdirSync(dir, { recursive: true });
    const ledger = new FileLedger(resolve(dir, 'usage.jsonl'));
    await ledger.transact({ id: `usage:${args[2]}:${digest(rows)}`, type: 'build-usage', at: new Date().toISOString(), details: { usage, measurements: rows } });
    for (const alert of usage.alerts) await ledger.transact({ id: `alert:${args[2]}:${alert}`, type: 'budget-alert', at: new Date().toISOString(), details: { month: args[2], alert } });
    console.log(JSON.stringify(usage, null, 2));
    return usage;
  }
  if (args[0] === 'history') {
    // Offline replay of captured merged-PR evidence. No network access.
    const fixture = JSON.parse(readFileSync(args[1], 'utf8'));
    const snapshots = historicalSnapshots(fixture);
    const fresh = freshness(fixture, policy.requiredChecks.map(c => c.name));
    const notes = [fixture.provenance.note, ...fresh.filter(f => !f.freshCi).map(f => `#${f.number}: last required CI ${f.lastRequiredCiAt ?? 'never'}; base advanced by ${f.baseAdvancedBy.map(n => `#${n}`).join(', ') || 'nothing'} before merge at ${f.mergedAt}; strict protection would have required a fresh exact-head run.`)];
    return publish({ ...assemble({ mode: 'history', policy, snapshots, prs: snapshots.map(s => s.pr), rels: fixture.relations,
      codeowners: fixture.codeowners, notes, inputs: { fixture: digest(fixture) }, generatedAt: fixture.provenance.capturedAt }), freshness: fresh },
      resolve(option(args, 'out') ?? 'artifacts/mergeops-demo-v1/history'));
  }
  if (args[0] === 'report' || args[0] === 'hygiene') {
    // Without GH_TOKEN this is unauthenticated public read access; with it, only the token's read scope is used.
    const github = new GitHub(policy.repository, process.env.GH_TOKEN || undefined);
    const notes = [];
    const open = await github.pages('/pulls?state=open');
    const staleDays = Number(option(args, 'stale-days') ?? 14);
    if (!Number.isInteger(staleDays) || staleDays < 1) throw Error('--stale-days must be a positive integer');
    if (args[0] === 'hygiene') {
      return publish({ mode: 'hygiene', repository: policy.repository, generatedAt: new Date().toISOString(), automation: { autoMerge: policy.autoMerge, autoRepair: policy.autoRepair },
        readiness: [], plan: mergePlan([]), hygiene: localHygiene(policy, open, staleDays), notes, inputs: { open: open.map(p => [p.number, p.head.sha]) } },
        resolve(option(args, 'out') ?? 'artifacts/mergeops-demo-v1/hygiene'));
    }
    const wanted = option(args, 'pr')?.split(',').map(Number);
    const snapshots = [];
    for (const p of wanted ? open.filter(p => wanted.includes(p.number)) : open) {
      try { snapshots.push(await github.snapshot(p.number, policy)); }
      catch (error) { notes.push(`#${p.number}: evaluation stopped (${redact(error.message)}); no decision recorded, nothing retried.`); }
    }
    // CODEOWNERS always comes from the protected base branch, never from a (possibly stacked) PR branch.
    const mainSha = (await github.request('GET', `/commits/${encodeURIComponent(policy.base)}`)).sha;
    let codeowners = '';
    try { codeowners = await github.text('.github/CODEOWNERS', mainSha); }
    catch (error) { notes.push(`CODEOWNERS unavailable on ${policy.base} (${redact(error.message)}); owner requirements not derived.`); }
    let rels = [];
    const mergedRefs = [];
    const idle = new Set(open.filter(p => !(Date.now() - Date.parse(p.updated_at) <= staleDays * 86400000)).map(p => p.number));
    try {
      const baseSha = git(process.cwd(), ['rev-list', '-n', '1', `origin/${policy.base}`]).trim();
      // A stale local base would make merged commits look like shared unmerged history.
      if (baseSha !== mainSha) throw Error(`local origin/${policy.base} ${baseSha.slice(0, 12)} differs from GitHub ${mainSha.slice(0, 12)}; git fetch first`);
      const found = relations(process.cwd(), baseSha, open.filter(p => !idle.has(p.number)));
      rels = found.relations;
      if (found.missing.length) notes.push(`Heads not present locally (git fetch first): ${found.missing.map(n => `#${n}`).join(', ')}; their shared-history relations are unknown.`);
      const sameRepoHead = ref => open.some(o => o.head.ref === ref && o.head.repo?.full_name === policy.repository);
      for (const p of open.filter(p => p.base.ref !== policy.base && !sameRepoHead(p.base.ref))) {
        try { git(process.cwd(), ['merge-base', '--is-ancestor', `origin/${p.base.ref}`, `origin/${policy.base}`]); mergedRefs.push(p.base.ref); } catch { /* base unknown or unmerged */ }
      }
    } catch (error) { notes.push(`Local Git relations unavailable (${redact(error.message)}).`); }
    if (!process.env.GH_TOKEN) notes.push('Unauthenticated public read: branch protection is not readable, so every evaluated PR carries protection-unverified.');
    const report = assemble({ mode: 'live', policy, snapshots, prs: open, rels, mergedRefs, idle, codeowners, notes,
      hygiene: args.includes('--hygiene') ? localHygiene(policy, open, staleDays) : null, inputs: { open: open.map(p => [p.number, p.head.sha]) } });
    report.discovered = open.map(p => ({ number: p.number, head: p.head.sha, headRef: p.head.ref, base: p.base.ref, draft: p.draft, updatedAt: p.updated_at, evaluated: snapshots.some(s => s.pr.number === p.number) }));
    return publish(report, resolve(option(args, 'out') ?? 'artifacts/mergeops-demo-v1/live'));
  }
  if (args[0] !== 'observe') throw Error('usage: node tools/mergeops/cli.mjs observe | report [--pr 1,2] [--hygiene] | history <fixture.json> | hygiene | budget <export.json> <YYYY-MM>');
  // This entry point is permanently read-only, even if a PR changes an env var.
  const github = new GitHub(policy.repository, process.env.GH_TOKEN);
  const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const event = process.env.GITHUB_EVENT_NAME === 'pull_request_target' ? 'pull_request' : process.env.GITHUB_EVENT_NAME;
  let targets = eventTargets(event, payload, policy.repository, policy.base);
  if (targets[0]?.refreshOpen) targets = (await github.pages(`/pulls?state=open&base=${encodeURIComponent(policy.base)}`)).map(pr => ({ number: pr.number, head: pr.head.sha }));
  const output = resolve('artifacts/mergeops'); mkdirSync(output, { recursive: true });
  const results = [];
  for (const target of targets) {
    const ledger = new FileLedger(resolve(output, `pr-${target.number}.jsonl`));
    const delivery = `actions-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
    let log = '';
    if (event === 'workflow_run' && payload.workflow_run.conclusion === 'failure') {
      const jobs = await github.pages(`/actions/runs/${payload.workflow_run.id}/jobs`, 'jobs');
      for (const job of jobs.filter(j => j.conclusion === 'failure').slice(0, 3)) log += await github.logs(job.id);
    }
    results.push(await lifecycle({ github, ledger, ...target, policy, delivery, log, dryRun: true }));
  }
  writeFileSync(resolve(output, 'decisions.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results.map(r => ({ action: r.action, blocks: r.blocks, head: r.head })), null, 2));
  return results;
}
// Fail closed with a redacted reason so permission failures are diagnosable without leaking credentials.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`MergeOps failed closed (${redact(String(error?.message ?? error))}); no write authority is available in this mode.`); process.exitCode = 1; });
