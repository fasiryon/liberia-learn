const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const esbuild = require('esbuild');
const out = 'artifacts/pr195-integration-repair';
fs.mkdirSync(out, {recursive: true});
const env = {...process.env, NODE_OPTIONS: '--max-old-space-size=4096', VALIDATE_CHANGED_NODE_OPTIONS: '--max-old-space-size=4096', VITEST_MAX_WORKERS: '1', VITEST_FILE_PARALLELISM: 'false'};
const receipt = {startedAt: new Date().toISOString(), sequential: true, steps: []};
function run(name, args) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, {env, windowsHide: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  fs.writeFileSync(`${out}/${name}.log`, (result.stdout || '') + (result.stderr || ''));
  receipt.steps.push({name, args, startedAt, finishedAt: new Date().toISOString(), exitCode: result.status, error: result.error?.message});
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${name}: exit ${result.status}`);
  if (result.status !== 0) throw new Error(`${name}_failed`);
}
function ts(name, entry, args = []) {
  const target = path.resolve(out, `${name}.generated.cjs`);
  esbuild.buildSync({entryPoints: [entry], outfile: target, bundle: true, platform: 'node', packages: 'external', logLevel: 'silent'});
  run(name, [target, ...args]);
}
const extract = 'C:/liberia-learn/.worktrees/library-modernization-v1/artifacts/library-modernization-v1/extract';
try {
  ts('inventory', 'scripts/qa/recompute-pr195-inventory.ts', [extract, `${out}/recomputed-inventory.json`]);
  ts('ledger', 'scripts/verify-library-modernization-ledger.ts');
  ts('ledger-diff', 'scripts/check-modernization-ledger-diff.ts', ['origin/main']);
  ts('release-provenance', 'scripts/validate-curriculum-releases.ts');
  ts('source-bindings', 'scripts/verify-first-ten-source-bindings.ts', [extract, '--check']);
  ts('contract-render', 'scripts/render-first-ten-modernization-spec.ts', ['--check']);
  ts('contract-manifest', 'scripts/build-first-ten-manifest.ts', ['--check']);
  run('affected-tests', ['node_modules/vitest/vitest.mjs', 'run', '__tests__/library-modernization', '__tests__/curriculum-v2', '__tests__/security', '__tests__/learner-experience', '__tests__/assessment-v2', '__tests__/learning-authority', '__tests__/curriculum/p2a-provenance-primitives.test.ts', '--maxWorkers=1', '--no-file-parallelism']);
  run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']);
  run('changed-validation', ['scripts/validate-changed.mjs', '--base', 'origin/main', '--no-types']);
} catch (error) {console.error(error.message); process.exitCode = 1;}
