const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');

const base = '4662b14ac47e561ec628ec327499fd1a87eef5ef';
const historical = path => execFileSync('git', ['show', base + ':' + path], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

test('the four original exposed families are absent from every tracked current text file', () => {
  const values = ['e2e/pre-vsl-admin.spec.ts', 'scripts/seed-load-test-pool.ts', 'scripts/seed-waec-demo-mastery.ts'].map(path => {
    const match = /(?:const PASS|const LOAD_TEST_PASSWORD|const DEMO_PASSWORD)\s*=\s*(["'])([^"']+)\1/.exec(historical(path));
    assert.ok(match, 'Missing pinned historical evidence');
    return match[2];
  });
  const row = historical('docs/security/PEN_TEST_BRIEF.md').split('\n').find(line => line.includes('official1@moe.gov.lr') && line.includes(' / '));
  assert.ok(row, 'Missing pinned MOE evidence');
  values.push(row.split(' / ')[1].trim());
  assert.equal(new Set(values).size, 4);
  const hits = [];
  for (const path of execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean)) {
    const bytes = readFileSync(path);
    if (!bytes.includes(0) && values.some(value => bytes.toString().toLowerCase().includes(value.toLowerCase()))) hits.push(path);
  }
  assert.equal(hits.length, 0, 'Original credential families remain in: ' + hits.join(', '));
});

test('rehearsal credentials require the role environment input and an explicit safe origin', () => {
  const { rehearsalPassword, rehearsalBaseUrl } = require('../../e2e/rehearsal-credentials.cjs');
  for (const [email, key] of Object.entries({ 'student1@cha.edu.lr': 'E2E_DEMO_PASSWORD', 'teacher1@cha.edu.lr': 'E2E_DEMO_PASSWORD', 'admin@cha.edu.lr': 'E2E_DEMO_PASSWORD', 'official1@moe.gov.lr': 'E2E_DEMO_MOE_PASSWORD' })) {
    assert.throws(() => rehearsalPassword(email, {}));
    assert.throws(() => rehearsalPassword(email, { [key]: ' ' }));
    const synthetic = randomUUID();
    assert.equal(rehearsalPassword(email, { [key]: synthetic }), synthetic);
  }
  assert.throws(() => rehearsalPassword('__proto__', {}));
  assert.throws(() => rehearsalBaseUrl({}));
  assert.throws(() => rehearsalBaseUrl({ E2E_REHEARSAL_BASE_URL: 'https://example.invalid/path' }));
  assert.equal(rehearsalBaseUrl({ E2E_REHEARSAL_BASE_URL: 'http://127.0.0.1:3100' }), 'http://127.0.0.1:3100');
});

test('load and WAEC seeds require environment secrets and export only to an ignored private file', () => {
  const { requiredSecret } = require('../../scripts/security/required-secret.cjs');
  for (const key of ['LOAD_TEST_PASSWORD', 'WAEC_DEMO_PASSWORD']) {
    assert.throws(() => requiredSecret(key, {}));
    assert.throws(() => requiredSecret(key, { [key]: ' ' }));
    assert.throws(() => requiredSecret(key, { [key]: '<PASSWORD>' }));
    const synthetic = randomUUID();
    assert.equal(requiredSecret(key, { [key]: synthetic }), synthetic);
  }
  for (const [path, key] of [['scripts/seed-load-test-pool.ts', 'LOAD_TEST_PASSWORD'], ['scripts/seed-waec-demo-mastery.ts', 'WAEC_DEMO_PASSWORD']]) {
    const source = readFileSync(path, 'utf8');
    assert.ok(source.indexOf(`requiredSecret("${key}")`) >= 0);
    assert.ok(source.indexOf(`requiredSecret("${key}")`) < source.indexOf('async function main('));
  }
  const exporter = readFileSync('scripts/export-load-test-credentials.ts', 'utf8');
  assert.ok(exporter.indexOf('requiredSecret("LOAD_TEST_PASSWORD")') < exporter.indexOf('async function main('));
  assert.ok(exporter.includes('"load-test.env"'));
  assert.ok(exporter.indexOf('execFileSync("git", ["check-ignore"') < exporter.indexOf('writeFileSync(outPath'));
  execFileSync('git', ['check-ignore', '--quiet', '--', 'load-tests/fixtures/load-test.env'], { stdio: 'pipe' });
});
