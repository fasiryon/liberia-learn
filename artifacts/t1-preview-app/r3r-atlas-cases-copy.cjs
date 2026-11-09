// Independent synthetic review cases. No real client, HTTP, credentials or DB connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('C:/liberia-learn/node_modules/typescript');
const root = 'C:/liberia-learn/.task-worktrees/t1-preview-app';
function load(relative, stub) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  if (stub) loaded.require = stub;
  loaded._compile(output, filename);
  return loaded.exports;
}
const { scanIdentityFreeze } = load('__tests__/helpers/identityFreezeScanner.ts');
const route = 'app/api/independent/route.ts';
const imports = 'import {previewIdentityFrozen} from "@/lib/preview/identityFreeze"; import {requireRole} from "@/lib/auth";';
const guard = 'const frozen=previewIdentityFrozen(); if(frozen) return frozen;';
function scan(source) {
  const files = { [route]: source, 'lib/preview/identityFreeze.ts': 'export function previewIdentityFrozen(){return null;}' };
  return scanIdentityFreeze({ files: Object.keys(files), read: name => files[name] }, []);
}
function mustRefuseOrReview(source) {
  const result = scan(source);
  assert.ok(result.offenders.length || result.review.length, JSON.stringify(result));
}
test('control: ordinary unguarded identity writer is refused', () => {
  mustRefuseOrReview('export async function POST(){return prisma.user.create({data:payload});}');
});
test('control: direct awaited authority and dominating guard are accepted', () => {
  const r = scan(imports + `export async function POST(){await requireRole('ADMIN'); ${guard} return prisma.user.create({data:payload});}`);
  assert.deepEqual(r.offenders, []); assert.deepEqual(r.review, []);
});
test('delegate alias must not silently escape provisioning inventory', () => {
  mustRefuseOrReview('export async function POST(){const users=prisma.user; return users.create({data:payload});}');
});
test('merely referring to requireRole must not establish prior authentication', () => {
  mustRefuseOrReview(imports + `export async function POST(){const unused=requireRole; ${guard} return prisma.user.create({data:payload});}`);
});
test('guard in try with swallowed earlier failure must not dominate later write', () => {
  mustRefuseOrReview(imports + `export async function POST(){await requireRole('ADMIN'); try{await mayThrow(); ${guard}}catch{} return prisma.user.create({data:payload});}`);
});
const marker = 'ATLAS_SYNTHETIC_AUTH_INFRASTRUCTURE_MARKER';
function routeStubs(name) {
  if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
  if (name === '@/lib/moeAccess') return { requireMoePlatformAdmin: async () => { throw Error(marker); } };
  if (name === '@/lib/auth') return { requireRole: async () => { throw Error(marker); }, requirePrivilegedStepUp: async () => { throw Error('unexpected stepup'); } };
  if (name === '@/lib/preview/identityFreeze') return { previewIdentityFrozen: () => ({ body: { code: 'PREVIEW_IDENTITY_FROZEN' }, status: 403 }) };
  if (name === '@/lib/db') return { prisma: new Proxy({}, { get() { throw Error('unexpected database work'); } }) };
  if (name === '@/lib/audit') return { logAudit() {}, logAuditRequired() {} };
  if (name === '@/lib/tokens') return { generateTokenPair() { throw Error('unexpected tokens'); } };
  if (name === 'bcryptjs') return {};
  // T1 successor 0aaa7a9c: the two routes now import the Preview-only sanitizer; load the real modules.
  if (name === '@/lib/preview/safeError') return load('lib/preview/safeError.ts', routeStubs);
  if (name === '@/lib/previewSideEffects') return load('lib/previewSideEffects.ts', routeStubs);
  if (name === 'zod') return require('C:/liberia-learn/node_modules/zod');
  throw Error(`unreviewed dependency ${name}`);
}
for (const [relative, method] of [
  ['app/api/platform/security/transfer/route.ts', 'POST'],
  ['app/api/teacher/change-password/route.ts', 'PATCH'],
]) test(`Preview auth failure must be sanitized: ${relative}`, async () => {
  const prior = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'preview';
  try {
    const handler = load(relative, routeStubs)[method];
    const response = await handler({ json() { throw Error('body must not be read'); } });
    assert.equal(response.status, 500);
    assert.ok(!JSON.stringify(response.body).includes(marker), 'raw authentication failure reached response');
  } finally {
    if (prior === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = prior;
  }
});
