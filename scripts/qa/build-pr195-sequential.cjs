const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const out = path.resolve('artifacts/pr195-integration-repair');
fs.mkdirSync(out, {recursive: true});
const env = {...process.env, DATABASE_URL: 'postgresql://review:review@127.0.0.1:1/pr195_synthetic', DIRECT_URL: 'postgresql://review:review@127.0.0.1:1/pr195_synthetic', NEXTAUTH_URL: 'http://localhost:3298', NEXTAUTH_SECRET: 'synthetic-pr195-build-only', NEXT_TELEMETRY_DISABLED: '1', LIBERIALEARN_BUILD_CPUS: '1', NODE_OPTIONS: '--max-old-space-size=4096', SENTRY_AUTH_TOKEN: '', SENTRY_ORG: '', SENTRY_PROJECT: ''};
const receipt = {startedAt: new Date().toISOString(), workerCount: 1, heapMiB: 4096, sequential: true, database: 'DUMMY_LOOPBACK_NO_PRODUCTION', steps: []};
async function run(name, args) {
  const startedAt = new Date().toISOString();
  const log = fs.createWriteStream(path.join(out, `${name}.log`));
  const child = spawn(process.execPath, args, {cwd: process.cwd(), env, windowsHide: true});
  fs.writeFileSync(path.join(out, 'active-build.json'), JSON.stringify({pid: child.pid, name, startedAt}));
  child.stdout.pipe(log); child.stderr.pipe(log);
  const exitCode = await new Promise((resolve, reject) => {child.once('error', reject); child.once('close', resolve);});
  await new Promise(resolve => log.end(resolve));
  receipt.steps.push({name, startedAt, finishedAt: new Date().toISOString(), exitCode});
  fs.writeFileSync(path.join(out, 'sequential-build.json'), JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(`${name}: exit ${exitCode}\n`);
  if (exitCode !== 0) throw new Error(`${name}_failed`);
}
(async () => {
  await run('prisma-generate', ['node_modules/prisma/build/index.js', 'generate']);
  await run('production-build', ['node_modules/next/dist/bin/next', 'build']);
})().catch(error => {process.stderr.write(`${error.message}\n`); process.exitCode = 1;});
