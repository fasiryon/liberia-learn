// Read-only merge planning. The order is a recommendation for humans; it never authorizes a merge.
// Relations come from trusted evidence (local Git or captured fixtures), never from PR text.
export function mergePlan(all, { base = 'main', repository = null, relations = [], mergedRefs = [], ready = new Set(), idle = new Set(), evaluated = null } = {}) {
  // Idle PRs are parked for an owner decision; their old history must not dictate the order of active work.
  const parked = all.filter(p => idle.has(p.number)).map(p => ({ number: p.number, reason: 'idle-owner-decision' }));
  const prs = all.filter(p => !idle.has(p.number));
  // Only same-repository heads can be a base; a fork branch with the same name is unrelated.
  const sameRepo = p => !repository || !p.head.repo || p.head.repo.full_name === repository;
  const byHead = new Map(prs.filter(sameRepo).map(p => [p.head.ref, p]));
  const nodes = new Map(prs.map(p => [p.number, { number: p.number, dependsOn: new Set(), coupled: new Set(), notes: [] }]));
  for (const p of prs) {
    if (p.base.ref === base) continue;
    const node = nodes.get(p.number), parent = byHead.get(p.base.ref);
    if (parent) { node.dependsOn.add(parent.number); node.notes.push(`stacked-on:#${parent.number}`); }
    else node.notes.push(mergedRefs.includes(p.base.ref) ? `retarget-required:${p.base.ref}-already-merged` : `unknown-base:${p.base.ref}`);
  }
  for (const r of relations) {
    const a = nodes.get(r.a), b = nodes.get(r.b);
    if (!a || !b || a === b) continue;
    if (r.sharedCommits > 0) {
      // Shared unmerged history couples the PRs. Land the one with less unique history first; the other is revalidated.
      const [first, second] = (r.uniqueA ?? 0) < (r.uniqueB ?? 0) || ((r.uniqueA ?? 0) === (r.uniqueB ?? 0) && a.number < b.number) ? [a, b] : [b, a];
      second.dependsOn.add(first.number);
      second.notes.push(`shared-history:#${first.number}:${r.sharedCommits}-commits`);
    }
    if (r.overlappingFiles > 0) { a.coupled.add(b.number); b.coupled.add(a.number); }
  }
  // Kahn's algorithm. Ties: PRs without other blockers first, then oldest PR number.
  const pending = new Map([...nodes].map(([n, node]) => [n, new Set([...node.dependsOn].filter(d => nodes.has(d)))]));
  const order = [], landed = [];
  while (pending.size) {
    const free = [...pending].filter(([, deps]) => !deps.size).map(([n]) => n)
      .sort((x, y) => Number(!ready.has(x)) - Number(!ready.has(y)) || x - y);
    if (!free.length) break;
    const next = free[0], node = nodes.get(next);
    order.push({ position: order.length + 1, number: next, dependsOn: [...node.dependsOn].sort((x, y) => x - y),
      revalidateAfter: landed.filter(n => node.coupled.has(n) || node.dependsOn.has(n)),
      notes: evaluated && !evaluated.has(next) ? [...node.notes, 'not-evaluated:readiness-unknown'] : node.notes });
    landed.push(next);
    pending.delete(next);
    for (const deps of pending.values()) deps.delete(next);
  }
  const cycles = [...pending.keys()].sort((x, y) => x - y);
  return { base, authority: 'recommendation-only', order, cycles, parked,
    // Every later PR is behind main once an earlier one lands; strict protection requires fresh exact-head CI.
    rule: 'After each merge, every remaining PR must be updated to the new base and pass exact-head CI and reviews again.' };
}
