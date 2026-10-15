import { decide, diagnose, digest, eligibleRepair, redact, isSha } from './core.mjs';
import { fixtureRecipe, fixtureRepair, publishRepair } from './repair.mjs';
import { adapterReport } from './adapters.mjs';

export async function lifecycle({ github, ledger, number, head, delivery, policy, dryRun = true, log = '', writer, merger, advisoryReports = [] }) {
  const snapshot = await github.snapshot(number, policy);
  const decision = decide(snapshot, head, policy);
  const reports = advisoryReports.map(report => adapterReport(report, policy, head));
  if (reports.some(report => report.findings.length)) { decision.action = 'hold'; decision.blocks.push('adapter-findings'); }
  const diagnosis = diagnose(log);
  const base = { mission: `${policy.repository}#${number}`, head, base: snapshot.pr.base.sha, delivery, at: new Date().toISOString(), reviewCostUSD: reports.reduce((n, r) => n + r.costUSD, 0), buildCostUSD: null };
  const record = (type, details, id = `${delivery}:${type}`) => ledger.transact({ ...base, id, type, details });
  await record('decision', { decision, diagnosis, advisoryReports: reports, diffHash: digest(snapshot.files), diff: redact(snapshot.files),
    evidence: { checks: snapshot.checks.map(c => ({ id: c.id, name: c.name, sha: c.head_sha, status: c.status, conclusion: c.conclusion, appId: c.app?.id })), reviews: snapshot.reviews.map(r => ({ id: r.id, actor: r.user.login, state: r.state, sha: r.commit_id })), protection: snapshot.protection }, dryRun });
  if (snapshot.pr.head.sha !== head || !snapshot.complete) return decision;
  if (snapshot.pr.merged && isSha(snapshot.pr.merge_commit_sha)) {
    await record('merge-observed', { commit: snapshot.pr.merge_commit_sha, head }, `merge-observed:${snapshot.pr.merge_commit_sha}`);
    return decision;
  }
  if (diagnosis.recipe) {
    const test = await github.text(fixtureRecipe.testPath, head);
    const source = await github.text(fixtureRecipe.sourcePath, fixtureRecipe.sourceSha);
    const proposal = fixtureRepair(test, source, head);
    await record('repair-proposed', proposal);
    if (!dryRun && writer && eligibleRepair(snapshot, diagnosis, 0, policy)) {
      const reserved = await ledger.transact({ ...base, id: `repair:${head}`, type: 'repair-attempt', details: { recipe: proposal.recipe } }, records =>
        eligibleRepair(snapshot, diagnosis, records.filter(r => r.type === 'repair-attempt').length, policy) &&
        !records.some(r => r.type === 'merge-intent'));
      if (reserved) {
        try {
          // Fetch again after reserving, including security checks and the entire diff.
          const fresh = await github.snapshot(number, policy);
          if (fresh.pr.head.sha !== head || !eligibleRepair(fresh, diagnosis, 0, policy)) throw Error('repair-evidence-changed');
          const result = await publishRepair(writer, proposal, number);
          await record('repair-published', result);
          return { ...decision, repair: result };
        } catch (error) {
          await record('repair-failed', { reason: error.message });
          throw error;
        }
      }
    }
  }
  if (decision.action !== 'merge' || dryRun || !merger) return decision;
  const reserved = await ledger.transact({ ...base, id: `merge:${head}`, type: 'merge-intent', details: { head } }, records =>
    !records.some(r => r.type === 'repair-attempt' && r.head === head));
  if (!reserved) return { ...decision, action: 'hold', blocks: ['merge-already-reserved-reconcile-before-retry'] };
  try {
    // No PR-supplied instructions, labels, artifacts, or cached approval can authorize this call.
    const fresh = await github.snapshot(number, policy);
    const recheck = decide(fresh, head, policy);
    if (fresh.pr.base.sha !== snapshot.pr.base.sha || recheck.action !== 'merge') throw Error('merge-evidence-changed');
    const result = await merger.request('PUT', `/pulls/${number}/merge`, { sha: head, merge_method: 'squash' });
    if (!result.merged) throw Error('github-refused-merge');
    await record('merged', { commit: result.sha, head });
    return { ...decision, commit: result.sha };
  } catch (error) {
    await record('merge-failed', { reason: error.message });
    throw error;
  }
}

export function eventTargets(event, payload, repository) {
  if (payload.repository?.full_name !== repository) throw Error('event-repository');
  if (event === 'pull_request' && ['opened', 'reopened', 'synchronize', 'ready_for_review', 'edited', 'closed'].includes(payload.action)) return [{ number: payload.pull_request.number, head: payload.pull_request.head.sha }];
  if (event === 'pull_request_review' && ['submitted', 'dismissed'].includes(payload.action)) return [{ number: payload.pull_request.number, head: payload.pull_request.head.sha }];
  if (event === 'check_run' && payload.action === 'completed') return (payload.check_run.pull_requests ?? []).map(pr => ({ number: pr.number, head: payload.check_run.head_sha }));
  if (event === 'workflow_run' && payload.action === 'completed' && payload.workflow_run.head_repository?.full_name === repository) return (payload.workflow_run.pull_requests ?? []).map(pr => ({ number: pr.number, head: payload.workflow_run.head_sha }));
  return [];
}
