import { decide, digest } from './core.mjs';

// Blocks caused by MergeOps' own disabled automation or unverified repository configuration.
// They never make a PR "not ready" for its human owner, and humans never clear them by approving a PR.
const automationBlocks = /^(?:merge-disabled|merge-authority-unverified|deployment-policy-unverified|protection-unverified|policy-check-unprotected:)/;
const hardBlocks = /^(?:stale-head|repository-or-base|not-clean-mergeable|incomplete-evidence|changes-requested|check:)/;

export function checkStatus(snapshot, policy, head) {
  return policy.requiredChecks.map(rule => {
    const runs = snapshot.checks.filter(c => c.name === rule.name && c.head_sha === head);
    const bound = runs.filter(c => c.app?.id === rule.appId).sort((a, b) => b.id - a.id)[0];
    const state = bound ? (bound.status !== 'completed' ? 'pending' : bound.conclusion === 'success' ? 'success' : `failed:${bound.conclusion}`)
      : runs.length ? 'wrong-app' : 'missing';
    return { name: rule.name, appId: rule.appId, state, completedAt: bound?.completed_at ?? null };
  });
}
// GitHub CODEOWNERS subset used by this repository: anchored paths and directories; the last match wins.
export function codeOwners(text, paths) {
  const rules = (text ?? '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/))
    .map(([pattern, ...owners]) => ({ prefix: pattern.replace(/^\//, ''), dir: pattern.endsWith('/'), owners }));
  const owners = new Set();
  for (const path of paths) {
    const match = rules.filter(r => r.dir ? path.startsWith(r.prefix) : path === r.prefix || path.startsWith(`${r.prefix}/`)).at(-1);
    match?.owners.forEach(o => owners.add(o));
  }
  return [...owners].sort();
}
export function readiness(snapshot, policy, { codeowners = '', openDependencies = [], extraBlockers = [] } = {}) {
  const head = snapshot.pr.head.sha;
  const decision = decide(snapshot, head, policy);
  const ci = checkStatus(snapshot, policy, head);
  const configured = new Set(Object.values(policy.reviewers ?? {}).flat());
  const latest = new Map([...snapshot.reviews].sort((a, b) => a.id - b.id).filter(r => r.state !== 'COMMENTED').map(r => [r.user.login, r]));
  const approvals = [...latest.values()].filter(r => r.state === 'APPROVED');
  const requirements = [];
  if (decision.blocks.includes('independent-reviews-required')) {
    requirements.push(`two independent approvals of exact head ${head.slice(0, 12)} from configured reviewers (configured: ${configured.size}; current-head approvals: ${approvals.filter(r => r.commit_id === head).length}; stale approvals: ${approvals.filter(r => r.commit_id !== head).length})`);
  }
  const owners = codeOwners(codeowners, snapshot.files.map(f => f.filename));
  if (owners.length) requirements.push(`CODEOWNERS approval: ${owners.join(', ')}`);
  if (decision.blocks.includes('founder-approval-required')) requirements.push(`founder review through the protected normal process (high risk: ${summarize(decision.classification.reasons)})`);
  for (const b of decision.blocks.filter(b => b.startsWith('outside-authority:'))) requirements.push(`${b.slice(18)} owner process; outside MergeOps authority, never auto-merged or repaired`);
  if (decision.blocks.includes('analysis-findings')) requirements.push('resolve deterministic analysis findings');
  const blockers = [...decision.blocks.filter(b => hardBlocks.test(b)), ...openDependencies.map(n => `depends-on-open:#${n}`), ...extraBlockers];
  return { number: snapshot.pr.number, head, base: snapshot.pr.base.ref, title: snapshot.pr.title ?? null, mergeableState: `${snapshot.pr.mergeable_state ?? 'unknown'}${snapshot.pr.draft ? ', draft' : ''}`,
    status: blockers.length ? 'blocked' : requirements.length ? 'awaiting-review' : 'ready-for-human-merge',
    automation: 'disabled', blockers, requirements, ci,
    repositoryGaps: decision.blocks.filter(b => automationBlocks.test(b)),
    protectionStatus: snapshot.protectionStatus ?? (snapshot.protection ? 'fetched' : 'unavailable'),
    risk: decision.classification.risk, decision };
}
export function summarize(reasons) {
  const counts = {};
  for (const r of reasons) { const k = r.split(':')[0]; counts[k] = (counts[k] ?? 0) + 1; }
  return Object.entries(counts).map(([k, n]) => `${k}×${n}`).join(', ') || 'none';
}
// Each proposal is a separate hash-chained record so the audit shows exactly what was recommended and why.
export async function recordProposals(ledger, report) {
  const run = `${report.mode}:${digest(report.inputs).slice(0, 16)}`;
  const at = report.generatedAt, proposals = [];
  for (const r of report.readiness) proposals.push({ key: `readiness:${r.number}:${r.head}`, type: 'readiness-proposal', head: r.head, details: { number: r.number, status: r.status, blockers: r.blockers, requirements: r.requirements, ci: r.ci, repositoryGaps: r.repositoryGaps } });
  for (const o of report.plan.order) proposals.push({ key: `order:${o.position}:${o.number}`, type: 'merge-order-proposal', details: o });
  for (const [i, p] of (report.hygiene?.proposals ?? []).entries()) proposals.push({ key: `hygiene:${i}:${p.target}`, type: 'hygiene-proposal', details: p });
  let written = 0;
  // The content digest is part of the id: identical reruns deduplicate, but a changed outcome on the same head is always recorded.
  for (const { key, ...p } of proposals) if (await ledger.transact({ ...p, id: `${run}:${key}:${digest(p.details).slice(0, 16)}`, mission: report.repository, at, proposedOnly: true, executed: false })) written++;
  return written;
}
export function markdown(report) {
  const rows = report.readiness.map(r => `| #${r.number} | \`${r.head.slice(0, 8)}\` | ${r.status} (GitHub: ${r.mergeableState}) | ${r.ci.map(c => `${c.name}: ${c.state}`).join('<br>')} | ${[...r.blockers, ...r.requirements].join('<br>') || '—'} |`);
  const order = report.plan.order.map(o => `${o.position}. #${o.number}${o.dependsOn.length ? ` (after ${o.dependsOn.map(n => `#${n}`).join(', ')})` : ''}${o.revalidateAfter.length ? ` — revalidate after ${o.revalidateAfter.map(n => `#${n}`).join(', ')}` : ''}${o.notes.length ? ` — ${o.notes.join('; ')}` : ''}`);
  return [`# MergeOps ${report.mode} report`, '', `Generated ${report.generatedAt} · repository ${report.repository} · automation: merge ${report.automation.autoMerge ? 'ON' : 'OFF'}, repair ${report.automation.autoRepair ? 'ON' : 'OFF'} · nothing was merged, repaired, deleted or deployed.`, '',
    '## Readiness', '', '| PR | Head | Status | Required checks (exact head) | Blockers and review requirements |', '| --- | --- | --- | --- | --- |', ...rows, '',
    '## Recommended merge order (recommendation only)', '', ...order, ...(report.plan.cycles.length ? ['', `Dependency cycle, needs a human: ${report.plan.cycles.map(n => `#${n}`).join(', ')}`] : []),
    ...(report.plan.parked?.length ? ['', `Parked, idle beyond the staleness window (owner decision, not ordered): ${report.plan.parked.map(p => `#${p.number}`).join(', ')}`] : []), '', report.plan.rule, '',
    ...(report.hygiene ? ['## Workspace hygiene (proposals only; nothing removed)', '', `Worktrees: ${JSON.stringify(report.hygiene.summary.worktrees)} · branches: ${JSON.stringify(report.hygiene.summary.branches)}`, '',
      ...report.hygiene.proposals.map(p => `- ${p.kind}: \`${p.target}\` (${p.reason})`), ''] : []),
    ...(report.notes?.length ? ['## Evidence notes', '', ...report.notes.map(n => `- ${n}`), ''] : [])].join('\n');
}
