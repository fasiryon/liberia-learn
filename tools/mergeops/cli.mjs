import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GitHub } from './github.mjs';
import { FileLedger } from './ledger.mjs';
import { lifecycle, eventTargets } from './controller.mjs';
import { buildUsage } from './budget.mjs';
import { digest } from './core.mjs';

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
  if (args[0] !== 'observe') throw Error('usage: node tools/mergeops/cli.mjs observe | budget <export.json> <YYYY-MM>');
  // This entry point is permanently read-only, even if a PR changes an env var.
  const github = new GitHub(policy.repository, process.env.GH_TOKEN);
  const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const event = process.env.GITHUB_EVENT_NAME === 'pull_request_target' ? 'pull_request' : process.env.GITHUB_EVENT_NAME;
  const targets = eventTargets(event, payload, policy.repository);
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
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('MergeOps failed closed; no write authority is available in observe mode.'); process.exitCode = 1; });
