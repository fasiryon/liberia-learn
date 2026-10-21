// Historical replay: rebuild each merged PR as it stood just before merging, from captured evidence only.
// Evidence that GitHub no longer exposes (mergeability, protection, patches) stays unknown and fails closed.
export function historicalSnapshots(fixture) {
  const repo = { full_name: fixture.repository };
  return fixture.prs.map(p => ({
    complete: false, deploymentSuppressed: false, protection: null, protectionStatus: 'not-captured-historically',
    pr: { number: p.number, title: p.title, state: 'open', draft: false, mergeable: null, mergeable_state: 'unknown', user: { login: p.author },
      changed_files: p.files.length, head: { sha: p.headSha, ref: p.headRef, repo }, base: { sha: p.baseSha, ref: p.baseRef, repo } },
    files: p.files.map(([filename, additions, deletions]) => ({ filename, status: 'modified', additions, deletions })),
    reviews: p.reviews, checks: p.checks,
  }));
}
// Did the base advance between a PR's last required CI run and its merge? Strict protection requires a fresh run.
export function freshness(fixture, requiredNames) {
  const merges = fixture.prs.map(p => ({ number: p.number, at: Date.parse(p.mergedAt) }));
  return fixture.prs.map(p => {
    const times = p.checks.filter(c => requiredNames.includes(c.name) && c.completed_at).map(c => Date.parse(c.completed_at));
    const ciAt = times.length ? Math.max(...times) : null;
    const advancedBy = merges.filter(m => m.number !== p.number && m.at < Date.parse(p.mergedAt) && (ciAt === null || m.at > ciAt)).map(m => m.number);
    return { number: p.number, lastRequiredCiAt: ciAt && new Date(ciAt).toISOString(), mergedAt: p.mergedAt, baseAdvancedBy: advancedBy, freshCi: ciAt !== null && !advancedBy.length };
  });
}
