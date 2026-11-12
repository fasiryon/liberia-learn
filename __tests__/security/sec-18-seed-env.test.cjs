const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const ts = require('typescript');

const seedPaths = ['prisma/seed.ts', 'prisma/seeds/cha-demo.ts', 'scripts/seed-demo.ts'];
for (const path of seedPaths) {
  const source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const getter = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'getDemoSeedPassword');
  assert.ok(getter, 'Expected seed credential boundary');
  const code = ts.transpileModule(getter.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const mode of ['development', 'test', 'production']) {
    for (const value of [undefined, '', '   ']) {
      test(`${path} refuses missing or blank credentials in ${mode}`, () => {
        const context = { process: { env: { NODE_ENV: mode, DEMO_SEED_PASSWORD: value } }, LOCAL_DEMO_SEED_PASSWORD: 'synthetic-forbidden-fallback' };
        assert.throws(() => vm.runInNewContext(code + '\ngetDemoSeedPassword()', context), /DEMO_SEED_PASSWORD.*required/);
      });
    }
  }
  test(`${path} uses supplied credentials without a fallback`, () => {
    assert.equal(vm.runInNewContext(code + '\ngetDemoSeedPassword()', { process: { env: { DEMO_SEED_PASSWORD: ' synthetic-private-input ' } } }), 'synthetic-private-input');
  });
}

test('legacy seed requires both environment inputs before hashing or writes', () => {
  const source = readFileSync('prisma/scripts/seed.ts', 'utf8');
  assert.ok(!/bcrypt\.hash\(\s*["'`]/.test(source), 'Inline seed credentials remain');
  assert.ok(source.includes('process.env.SEED_TEACHER_PASSWORD'));
  assert.ok(source.includes('process.env.SEED_STUDENT_PASSWORD'));
  assert.ok(source.indexOf('throw new Error(') < source.indexOf('await bcrypt.hash('));
});

for (const supplied of [{}, { SEED_TEACHER_PASSWORD: 'synthetic-teacher' }, { SEED_STUDENT_PASSWORD: 'synthetic-student' }, { SEED_TEACHER_PASSWORD: ' ', SEED_STUDENT_PASSWORD: 'synthetic-student' }]) {
  test('legacy seed missing configuration refuses before hashing or writes', async () => {
    const source = readFileSync('prisma/scripts/seed.ts', 'utf8');
    const ast = ts.createSourceFile('seed.ts', source, ts.ScriptTarget.Latest, true);
    const main = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'main');
    const code = ts.transpileModule(main.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    let effects = 0;
    const context = { process: { env: supplied }, console: { log() {} }, bcrypt: { hash() { effects++; throw Error('Unexpected hash'); } }, prisma: new Proxy({}, { get() { effects++; throw Error('Unexpected database operation'); } }) };
    await assert.rejects(vm.runInNewContext(code + '\nmain()', context), /SEED_.*PASSWORD.*required/);
    assert.equal(effects, 0);
  });
}

test('smoke script refuses missing demo credentials before any network call', () => {
  const command = `$env:NODE_ENV='development'; $env:DEMO_MODE='false'; $env:DEMO_SEED_PASSWORD=''; $env:E2E_DEMO_STUDENT_EMAIL='student@example.invalid'; $env:E2E_DEMO_TEACHER_EMAIL='teacher@example.invalid'; $env:E2E_DEMO_ADMIN_EMAIL='admin@example.invalid'; $env:E2E_DEMO_MOE_EMAIL='moe@example.invalid'; $env:DEMO_MOE_PASSWORD='synthetic-private-input'; $global:networkCalls=0; function global:Invoke-WebRequest { $global:networkCalls++; throw 'NETWORK_FORBIDDEN' }; $refused=$false; try { & ./scripts/smoke-test.ps1 } catch { $refused=$_.Exception.Message -match 'DEMO_SEED_PASSWORD.*required' }; if (!$refused -or $global:networkCalls -ne 0) { exit 1 }`;
  let status = 0;
  try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'pipe' }); } catch { status = 1; }
  assert.equal(status, 0, 'Missing environment credentials did not refuse before network');
});

test('SEC-18 additional seed families are absent from tracked source', () => {
  const historical = path => execFileSync('git', ['show', 'ae265966e8b7ca325f8100b793d80aba9444ffde:' + path], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const values = [ /const LOCAL_DEMO_SEED_PASSWORD = ["']([^"']+)["']/.exec(historical('prisma/seed.ts'))[1], ...Array.from(historical('prisma/scripts/seed.ts').matchAll(/bcrypt\.hash\(["']([^"']+)["']/g), match => match[1]) ];
  const paths = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
  const hits = [];
  for (const path of paths) {
    const bytes = readFileSync(path);
    if (bytes.includes(0)) continue;
    if (values.some(value => bytes.toString().includes(value))) hits.push(path);
  }
  assert.equal(hits.length, 0, 'Literal seed credentials remain in tracked paths: ' + hits.join(', '));
});
