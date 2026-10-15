import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installationClient } from './github.mjs';
import { GitLedger } from './ledger.mjs';
import { lifecycle } from './controller.mjs';
import { webhookServer } from './webhook.mjs';

const readPermissions = { contents: 'read', pull_requests: 'read', checks: 'read', actions: 'read', administration: 'read' };
export async function appRun(target, policy, env = process.env, mint = installationClient) {
  if (String(target.payload.installation?.id) !== env.MERGEOPS_INSTALLATION_ID) throw Error('installation-mismatch');
  const sessions = [];
  const session = async (prefix, permissions) => {
    const result = await mint({ repository: policy.repository, appId: env[`${prefix}_APP_ID`], installationId: env[`${prefix}_INSTALLATION_ID`],
      privateKey: readFileSync(env[`${prefix}_KEY_FILE`], 'utf8'), permissions });
    sessions.push(result); return result.client;
  };
  try {
    const github = await session('MERGEOPS', readPermissions);
    // State writer is distinct from merge authority; scopes are minted per operation.
    const stateWriter = await session('MERGEOPS_STATE', { contents: 'write' });
    const ledger = new GitLedger(stateWriter, target.number); await ledger.initialize();
    let log = '';
    if (target.event === 'workflow_run' && target.payload.workflow_run.conclusion === 'failure') {
      const jobs = await github.pages(`/actions/runs/${target.payload.workflow_run.id}/jobs`, 'jobs');
      for (const job of jobs.filter(j => j.conclusion === 'failure').slice(0, 3)) log += await github.logs(job.id);
    }
    let writer, merger;
    const reviewed = policy.permissionsReviewed === true && policy.safetyTestsReviewed === true;
    if (reviewed && policy.autoRepair === true) writer = await session('MERGEOPS_REPAIR', { contents: 'write', pull_requests: 'write' });
    if (reviewed && policy.autoMerge === true) {
      if (Number(env.MERGEOPS_MERGE_APP_ID) !== policy.mergeAppId) throw Error('merge-app-identity');
      merger = await session('MERGEOPS_MERGE', { contents: 'write', pull_requests: 'write' });
    }
    return await lifecycle({ github, ledger, number: target.number, head: target.head, delivery: target.delivery, policy,
      dryRun: !reviewed || (!policy.autoMerge && !policy.autoRepair), log, writer, merger });
  } finally {
    const results = await Promise.allSettled(sessions.map(s => s.revoke()));
    if (results.some(r => r.status === 'rejected')) console.error('MergeOps token revocation failed; investigate App session audit.');
  }
}
export function serve(env = process.env) {
  const policy = JSON.parse(readFileSync(new URL('./policy.json', import.meta.url), 'utf8'));
  if (!env.MERGEOPS_WEBHOOK_SECRET || !env.MERGEOPS_INSTALLATION_ID) throw Error('webhook-config-required');
  const server = webhookServer({ secret: env.MERGEOPS_WEBHOOK_SECRET, installationId: env.MERGEOPS_INSTALLATION_ID, policy, run: target => appRun(target, policy, env) });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  // TLS termination and private ingress are operator responsibilities. No automatic hosting.
  return server.listen(Number(env.MERGEOPS_PORT ?? 8787), '127.0.0.1');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) serve();
