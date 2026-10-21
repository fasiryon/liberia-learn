// Stale worktree, branch and PR reporting. Every output is a proposal for a human; nothing is removed.
const DAY = 86400000;
export function hygieneReport({ worktrees = [], branches = [], merged = [], openPrs = [], now, staleDays = 14, protectedRefs = ['main', 'origin/main'] }) {
  const at = Date.parse(now);
  if (!Number.isFinite(at)) throw Error('invalid-now');
  if (!Number.isFinite(staleDays) || staleDays < 1) throw Error('invalid-stale-days');
  // Open PR heads and the bases of stacked PRs are both in use; deleting a base retargets or closes its PR.
  const prHeads = new Set(openPrs.flatMap(p => [p.head.ref, p.base.ref]));
  const mergedSet = new Set(merged);
  const age = iso => Math.floor((at - Date.parse(iso)) / DAY);
  const branchRows = branches.map(b => {
    const name = b.remote ? b.ref.replace(/^origin\//, '') : b.ref;
    const days = age(b.committedAt);
    const category = protectedRefs.includes(b.ref) ? 'protected'
      : prHeads.has(name) ? (days > staleDays ? 'open-pr-stale' : 'open-pr')
      : mergedSet.has(b.ref) ? 'merged'
      : b.gone ? 'upstream-gone'
      : days > staleDays ? 'stale-no-pr' : 'active';
    return { ref: b.ref, remote: b.remote, sha: b.sha, ageDays: days, category };
  });
  const branchCategory = new Map(branchRows.filter(b => !b.remote).map(b => [b.ref, b.category]));
  const worktreeRows = worktrees.map(w => {
    // Uncommitted work belongs to its owner (another agent may share the repository); never propose removal.
    const category = w.primary ? 'primary-checkout'
      : w.prunable ? 'missing-directory'
      : w.locked ? 'locked'
      : w.dirty === null ? 'unreadable'
      : w.dirty > 0 ? 'dirty-owner-review'
      : w.localSecrets > 0 ? 'local-env-owner-review'
      : w.junctionTarget ? 'junction-target'
      : w.detached ? 'detached-clean'
      : branchCategory.get(w.branch) === 'merged' ? 'merged-clean'
      : 'in-use';
    return { path: w.path, branch: w.branch, head: w.head, dirty: w.dirty, category };
  });
  const proposals = [
    ...worktreeRows.filter(w => ['merged-clean', 'detached-clean', 'missing-directory'].includes(w.category))
      .map(w => ({ kind: w.category === 'missing-directory' ? 'prune-worktree-record' : 'remove-worktree', target: w.path, reason: w.category })),
    ...worktreeRows.filter(w => w.category === 'dirty-owner-review').map(w => ({ kind: 'ask-owner', target: w.path, reason: `${w.dirty}-uncommitted-paths` })),
    ...worktreeRows.filter(w => w.category === 'local-env-owner-review').map(w => ({ kind: 'ask-owner', target: w.path, reason: 'ignored-local-env-files' })),
    // A branch checked out in any worktree (by local or origin/ name) is in use, merged or not.
    ...branchRows.filter(b => b.category === 'merged' && !worktreeRows.some(w => w.branch && (w.branch === b.ref || `origin/${w.branch}` === b.ref)))
      .map(b => ({ kind: b.remote ? 'delete-remote-branch' : 'delete-merged-branch', target: b.ref, reason: 'merged-into-base' })),
    ...branchRows.filter(b => ['stale-no-pr', 'upstream-gone'].includes(b.category)).map(b => ({ kind: 'ask-owner', target: b.ref, reason: `${b.category}:${b.ageDays}d` })),
    ...openPrs.filter(p => age(p.updated_at) > staleDays).map(p => ({ kind: 'ask-owner', target: `#${p.number}`, reason: `open-pr-idle:${age(p.updated_at)}d` })),
  ].map(p => ({ ...p, requiresHuman: true, executed: false }));
  const count = rows => rows.reduce((m, r) => ({ ...m, [r.category]: (m[r.category] ?? 0) + 1 }), {});
  return { staleDays, summary: { worktrees: count(worktreeRows), branches: count(branchRows) }, worktrees: worktreeRows, branches: branchRows, proposals };
}
