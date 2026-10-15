import { digest, isSha } from './core.mjs';

export const fixtureRecipe = Object.freeze({
  testPath: '__tests__/textbook-hub-visual-fixtures.test.tsx',
  fixturePath: '__tests__/fixtures/textbook-hub-before.tsx.fixture',
  sourcePath: 'app/student/textbooks/page.tsx',
  sourceSha: '2bf94c11df127292a1863b75cc338a462204d0a2',
});
const oldCall = 'execFileSync("git", ["show", "2bf94c11:app/student/textbooks/page.tsx"], { encoding: "utf8" })';
const oldImport = 'import { execFileSync } from "node:child_process";\n';
export function fixtureRepair(test, source, head) {
  if (!isSha(head) || test.length > 30000 || source.length > 30000 || test.split(oldCall).length !== 2 || !test.includes(oldImport)) throw Error('recipe-precondition');
  const after = test.replace(oldImport, '').replace(oldCall, `readFileSync("${fixtureRecipe.fixturePath}", "utf8")`);
  return { recipe: 'textbook-fixture-v1', head, source: { sha: fixtureRecipe.sourceSha, path: fixtureRecipe.sourcePath, hash: digest(source) },
    writes: [{ path: fixtureRecipe.testPath, content: after }, { path: fixtureRecipe.fixturePath, content: source }],
    beforeHash: digest(test), afterHash: digest(after) };
}
export function validateRepair(proposal, test, source, head) {
  const expected = fixtureRepair(test, source, head);
  if (JSON.stringify(proposal) !== JSON.stringify(expected)) throw Error('forbidden-repair-write');
  return expected;
}
export async function publishRepair(github, proposal, number) {
  // Construction is pure data; no checkout, hooks, npm lifecycle, shell or PR script executes.
  const test = await github.text(fixtureRecipe.testPath, proposal.head);
  const source = await github.text(fixtureRecipe.sourcePath, fixtureRecipe.sourceSha);
  validateRepair(proposal, test, source, proposal.head);
  const pr = await github.request('GET', `/pulls/${number}`);
  if (pr.head.sha !== proposal.head) throw Error('stale-head');
  const config = JSON.parse(await github.text('vercel.json', proposal.head));
  // No branch push until the committed config prevents repair previews.
  const deployments = config.git?.deploymentEnabled;
  if (deployments !== false && (deployments?.['mergeops-repair-*'] !== false || Object.values(deployments).some(v => v !== false))) throw Error('preview-prevention-unverified');
  const commit = await github.commitFiles(proposal.head, proposal.writes, 'test: make historical textbook fixture independent of checkout depth');
  const current = await github.request('GET', `/pulls/${number}`);
  if (current.head.sha !== proposal.head) throw Error('stale-head');
  const branch = `mergeops-repair-${number}-${proposal.head.slice(0,12)}`;
  await github.request('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });
  const repairPr = await github.request('POST', '/pulls', { title: `Repair historical fixture for PR #${number}`, head: branch, base: pr.base.ref,
    body: `Bounded recipe textbook-fixture-v1 for exact head ${proposal.head}. CI must rerun on ${commit.sha}; no checks are waived.`, draft: false });
  return { branch, commit: commit.sha, pullRequest: repairPr.number, url: repairPr.html_url };
}
