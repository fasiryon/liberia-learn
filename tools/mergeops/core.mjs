import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /authorization|password|secret|private.?key|api.?key|access.?key|(?:^|[_-])token(?:$|[_-])/i.test(key) ? '[REDACTED]' : redact(item)]));
  if (typeof value !== 'string') return value;
  return value.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED KEY]')
    .replace(/\b(?:gh[pousr]_[\w]+|github_pat_[\w]+|sk-[\w-]{8,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/g, '[REDACTED]')
    .replace(/(\b[A-Za-z_]*(?:authorization|password|secret|api[_-]?key|access[_-]?key|token)[A-Za-z_]*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|(?:Bearer\s+)?[^\s"',;}]+)/gi, '$1[REDACTED]')
    .replace(/([a-z]+:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@');
}
export function validPath(path) {
  return typeof path === 'string' && /^[a-zA-Z0-9_./@()[\]-]+$/.test(path) &&
    !path.startsWith('/') && !path.split('/').some(p => !p || p === '.' || p === '..');
}
const sensitivePath = /(?:^|\/)(?:prisma|supabase|infra|\.github|\.vercel|security|auth|grading|governance|curriculum|autonomous|agents|mergeops)(?:\/|\.)|(?:auth|permission|tenant|school|student|grade|mastery|evidence|flag|deploy|migration|secret|middleware|serverFlags|next\.config|vercel\.json|package(?:-lock)?\.json|AGENTS\.md)/i;
const sensitiveText = /\b(?:schoolId|tenantId|requireRole|assertPermission|authOptions|LearningEvent|score|mastery|grade|completion|evidence|DATABASE_URL|NEXT_PUBLIC_|process\.env|ALTER\s+TABLE|DROP\s+TABLE|ENABLE_[A-Z_]+)\b/i;
export function classify(files, policy) {
  const reasons = [];
  if (!Array.isArray(files) || !files.length) return { risk: 'high', reasons: ['empty-or-incomplete-diff'] };
  if (JSON.stringify(files).length > 100000) reasons.push('diff-byte-budget');
  if (files.length > policy.maxFiles || files.reduce((n, f) => n + (f.additions ?? 0) + (f.deletions ?? 0), 0) > policy.maxChangedLines) reasons.push('diff-budget');
  for (const f of files) {
    for (const path of [f.filename, f.previous_filename].filter(Boolean)) {
      if (!validPath(path) || sensitivePath.test(path)) reasons.push(`protected:${path}`);
    }
    if (typeof f.patch !== 'string' || ['removed', 'renamed'].includes(f.status)) reasons.push(`incomplete-or-structural:${f.filename}`);
    if (sensitiveText.test(f.patch ?? '')) reasons.push(`authority:${f.filename}`);
    // Positive low-risk scope. Unknown application changes always escalate.
    if (!/^(?:docs\/[\w/-]+\.md|__tests__\/(?:fixtures\/[\w.-]+|[\w.-]+\.test\.[jt]sx?))$/.test(f.filename)) reasons.push(`unclassified:${f.filename}`);
  }
  return { risk: reasons.length ? 'high' : 'low', reasons: [...new Set(reasons)] };
}
// Independent, deterministic diff analyses; they do not claim semantic approval.
export function analyze(files) {
  const correctness = [], maintainability = [];
  for (const f of files) {
    const added = (f.patch ?? '').split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
    if (/\b(?:eval|execSync|execFileSync|spawnSync|new Function)\b|(?:it|test|describe)\.skip|@ts-ignore|eslint-disable/.test(added)) correctness.push({ path: f.filename, rule: 'execution-or-check-suppression' });
    if (redact(added) !== added) correctness.push({ path: f.filename, rule: 'potential-secret' });
    if (added.split('\n').some(l => l.length > 240) || /\bTODO\b|\bas any\b/.test(added)) maintainability.push({ path: f.filename, rule: 'complexity-or-deferred-work' });
  }
  return [
    { role: 'correctness-security', source: 'deterministic-v1', findings: correctness },
    { role: 'maintainability', source: 'deterministic-v1', findings: maintainability },
  ];
}
export function diagnose(log) {
  const clean = log.replace(/\x1b\[[0-9;]*m/g, '');
  if (/fatal: invalid object name '2bf94c11'/.test(clean) && /Command failed: git show 2bf94c11:app\/student\/textbooks\/page\.tsx/.test(clean)) {
    return { kind: 'historical-fixture-shallow-checkout', recipe: 'textbook-fixture-v1', rootCause: 'Test reads a historical commit unavailable in a shallow clone.' };
  }
  if (/migration|RLS|GitGuardian|secret detected|security check/i.test(clean)) return { kind: 'security-or-migration', recipe: null, rootCause: 'Requires human security or schema review.' };
  return { kind: 'unknown', recipe: null, rootCause: 'No approved bounded recipe.' };
}
export function reviewEvidence(snapshot, policy) {
  const latest = new Map();
  for (const review of [...snapshot.reviews].sort((a,b) => a.id - b.id)) {
    if (review.state !== 'COMMENTED') latest.set(review.user.login, review);
  }
  const roles = ['correctness-security', 'maintainability'];
  const candidates = roles.map(role => [...latest.values()].filter(r => Array.isArray(policy.reviewers?.[role]) &&
    policy.reviewers[role].includes(r.user.login) && r.user.login !== snapshot.pr.user.login && r.commit_id === snapshot.pr.head.sha && r.state === 'APPROVED'));
  const first = candidates[0].find(a => candidates[1].some(b => b.user.login !== a.user.login));
  const second = first && candidates[1].find(b => b.user.login !== first.user.login);
  return first && second ? [first, second].map((r, i) => ({ role: roles[i], actor: r.user.login, id: r.id })) : null;
}
export function decide(snapshot, expectedSha, policy) {
  const { pr, files, checks, protection } = snapshot;
  const blocks = [];
  const classification = classify(files, policy);
  const analyses = analyze(files);
  if (!isSha(expectedSha) || pr.head.sha !== expectedSha) blocks.push('stale-head');
  if (pr.base.ref !== policy.base || pr.head.repo?.full_name !== policy.repository || pr.base.repo?.full_name !== policy.repository) blocks.push('repository-or-base');
  if (pr.state !== 'open' || pr.draft || pr.mergeable !== true || pr.mergeable_state !== 'clean') blocks.push('not-clean-mergeable');
  if (!snapshot.complete) blocks.push('incomplete-evidence');
  if (snapshot.deploymentSuppressed !== true || policy.previewDeploymentPolicyReviewed !== true) blocks.push('deployment-policy-unverified');
  if (classification.risk !== 'low') blocks.push('founder-approval-required');
  if (analyses.some(a => a.findings.length)) blocks.push('analysis-findings');
  if (!reviewEvidence(snapshot, policy)) blocks.push('independent-reviews-required');
  const latestReviews = new Map();
  for (const r of [...snapshot.reviews].sort((a,b) => a.id - b.id)) if (r.state !== 'COMMENTED') latestReviews.set(r.user.login, r);
  if ([...latestReviews.values()].some(r => r.state === 'CHANGES_REQUESTED')) blocks.push('changes-requested');
  const required = protection?.required_status_checks;
  const reviews = protection?.required_pull_request_reviews;
  if (!protection?.enforce_admins?.enabled || !required?.strict || !reviews?.dismiss_stale_reviews ||
      !reviews?.require_last_push_approval || !reviews?.require_code_owner_reviews || reviews?.required_approving_review_count < 2 ||
      Object.values(reviews?.bypass_pull_request_allowances ?? {}).some(actors => !Array.isArray(actors) || actors.length > 0) ||
      protection?.allow_force_pushes?.enabled || !Array.isArray(required?.checks) || !required.checks.length) blocks.push('protection-unverified');
  const restrictions = protection?.restrictions;
  if (!Number.isSafeInteger(policy.mergeAppId) || restrictions?.apps?.length !== 1 || restrictions.apps[0].id !== policy.mergeAppId ||
      !Array.isArray(restrictions?.users) || restrictions.users.some(u => !policy.founders.includes(u.login)) ||
      !Array.isArray(restrictions?.teams) || restrictions.teams.length > 0) blocks.push('merge-authority-unverified');
  const allRequired = [...policy.requiredChecks, ...(required?.checks ?? []).map(c => ({ name: c.context, appId: c.app_id }))];
  for (const rule of policy.requiredChecks) {
    if (!required?.checks?.some(c => c.context === rule.name && c.app_id === rule.appId)) blocks.push(`policy-check-unprotected:${rule.name}`);
  }
  for (const rule of allRequired) {
    // An unbound context or a same-name check from another App cannot authorize merge.
    const match = checks.filter(c => c.name === rule.name && c.app?.id === rule.appId && c.head_sha === expectedSha).sort((a,b) => b.id - a.id)[0];
    if (!rule.appId || !match || match.status !== 'completed' || match.conclusion !== 'success') blocks.push(`check:${rule.name}`);
  }
  if (policy.autoMerge !== true || policy.permissionsReviewed !== true || policy.safetyTestsReviewed !== true) blocks.push('merge-disabled');
  return { action: blocks.length ? 'hold' : 'merge', blocks: [...new Set(blocks)], classification, analyses, head: expectedSha };
}
export function eligibleRepair(snapshot, diagnosis, attempts, policy) {
  return policy.autoRepair === true && policy.permissionsReviewed === true && policy.safetyTestsReviewed === true &&
    policy.previewDeploymentPolicyReviewed === true && snapshot.complete && snapshot.pr.state === 'open' &&
    snapshot.pr.base.ref === policy.base && snapshot.pr.head.repo?.full_name === policy.repository &&
    snapshot.pr.base.repo?.full_name === policy.repository && snapshot.pr.mergeable === true && !snapshot.pr.draft &&
    classify(snapshot.files, policy).risk === 'low' && diagnosis.recipe === 'textbook-fixture-v1' &&
    Number.isInteger(attempts) && attempts >= 0 && attempts < Math.min(policy.maxRepairAttempts, 2) &&
    mandatorySecurityPassed(snapshot, policy);
}
export function mandatorySecurityPassed(snapshot, policy) {
  return policy.requiredChecks.some(c => /security|guardian/i.test(c.name)) &&
    policy.requiredChecks.filter(c => /security|guardian/i.test(c.name)).every(rule => {
      const check = snapshot.checks.filter(c => c.name === rule.name && c.app?.id === rule.appId && c.head_sha === snapshot.pr.head.sha).sort((a,b) => b.id - a.id)[0];
      return check?.status === 'completed' && check.conclusion === 'success';
    });
}
