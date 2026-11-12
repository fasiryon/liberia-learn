// An isolated CI fixture, never a production consent assertion. The app gets SELECT only.
// L-CRED-1: the synthetic privileged reviewer exists ONLY in the loopback /lab_review_fixture database; every entry point
// asserts that before connecting. The real schema is pushed so the app's session checks run unchanged against a real row.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
function assertReviewFixtureDatabase(value, env = process.env) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/lab_review_fixture' || url.search || url.hash || env.NODE_ENV === 'production' || env.VERCEL || env.LAB_REVIEW_HARNESS !== '1') throw new Error('Only the isolated local lab_review_fixture database is permitted');
  return url;
}
/** Must match scripts/labs/reviewer-session.cjs: credStamp 0 <=> passwordChangedAt null; schoolId null; not a platform admin. */
const SYNTHETIC_REVIEWER_ROW = Object.freeze({ id: 'synthetic-MOE_OFFICIAL', email: 'synthetic@example.invalid', name: 'Synthetic lab reviewer',
  role: 'MOE_OFFICIAL', schoolId: null, isPlatformAdmin: false, hashedPwd: null, passwordChangedAt: null });
/** The application role's only privileges: connect, read the public schema, and a read-only default. */
const FIXTURE_GRANTS = Object.freeze([
  'GRANT CONNECT ON DATABASE lab_review_fixture TO lab_review_reader',
  'GRANT USAGE ON SCHEMA public TO lab_review_reader',
  'GRANT SELECT ON ALL TABLES IN SCHEMA public TO lab_review_reader',
  'ALTER ROLE lab_review_reader SET default_transaction_read_only = on',
]);
/** Number of public tables the current role could INSERT, UPDATE, DELETE or TRUNCATE (must be 0 for the app role). */
const WRITABLE_TABLES = `SELECT COUNT(*)::int AS writable FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND (has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'INSERT') OR has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'UPDATE') OR has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'DELETE') OR has_table_privilege(current_user, format('%I.%I', t.table_schema, t.table_name), 'TRUNCATE'))`;
async function prepareReviewFixture(env = process.env) {
  const adminUrl = env.REVIEW_FIXTURE_ADMIN_URL;
  if (!adminUrl) throw new Error('REVIEW_FIXTURE_ADMIN_URL is required');
  assertReviewFixtureDatabase(adminUrl, env);
  const appUrl = env.DATABASE_URL;
  if (!appUrl || assertReviewFixtureDatabase(appUrl, env).username !== 'lab_review_reader') throw new Error('Application fixture role must be lab_review_reader');
  const policy = fs.readFileSync('lib/policy/policyVersion.ts', 'utf8');
  const version = policy.match(/CURRENT_POLICY_VERSION = "([a-zA-Z0-9-]+)"/)?.[1];
  const key = policy.match(/DATA_POLICY_KEY = "([a-zA-Z0-9_]+)"/)?.[1];
  if (!version || !key) throw new Error('Current consent fixture policy could not be resolved');
  // The disposable fixture gets the real schema (never another database: asserted above). The schema uses pgvector.
  const bootstrap = new PrismaClient({ datasourceUrl: adminUrl });
  try { await bootstrap.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector'); } finally { await bootstrap.$disconnect(); }
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--accept-data-loss'],
    { env: { ...env, DATABASE_URL: adminUrl, DIRECT_URL: adminUrl }, stdio: ['ignore', 'inherit', 'inherit'] });
  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    const { id, ...row } = SYNTHETIC_REVIEWER_ROW;
    await admin.user.upsert({ where: { id }, create: { id, ...row }, update: row });
    await admin.dataPolicyAcceptance.upsert({ where: { id: 'synthetic-lab-review-consent' },
      create: { id: 'synthetic-lab-review-consent', userId: id, policyKey: key, policyVersion: version, source: 'LAB_REVIEW_FIXTURE' },
      update: { userId: id, policyKey: key, policyVersion: version } });
    await admin.$executeRawUnsafe("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lab_review_reader') THEN CREATE ROLE lab_review_reader LOGIN PASSWORD 'lab-review-read-only-local'; END IF; END $$");
    for (const statement of FIXTURE_GRANTS) await admin.$executeRawUnsafe(statement);
  } finally { await admin.$disconnect(); }
  const app = new PrismaClient({ datasourceUrl: appUrl });
  try {
    const setting = await app.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS read_only");
    if (setting[0]?.read_only !== 'on') throw new Error('Fixture application connection must be read-only');
    const writes = await app.$queryRawUnsafe(WRITABLE_TABLES);
    if (writes[0]?.writable !== 0) throw new Error('Fixture application role must not be able to write any table');
    const reviewer = await app.user.findUnique({ where: { id: SYNTHETIC_REVIEWER_ROW.id }, select: { role: true, schoolId: true, passwordChangedAt: true } });
    if (!reviewer || reviewer.role !== 'MOE_OFFICIAL' || reviewer.schoolId !== null || reviewer.passwordChangedAt !== null) throw new Error('Synthetic reviewer fixture missing or changed');
    const accepted = await app.dataPolicyAcceptance.findFirst({ where: { userId: SYNTHETIC_REVIEWER_ROW.id, policyKey: key, policyVersion: version }, select: { id: true } });
    if (!accepted) throw new Error('Synthetic reviewer consent fixture missing');
  } finally { await app.$disconnect(); }
  console.log('Local synthetic reviewer and consent verified; application database role is read-only.');
}
module.exports = { assertReviewFixtureDatabase, prepareReviewFixture, SYNTHETIC_REVIEWER_ROW, FIXTURE_GRANTS, WRITABLE_TABLES };
if (require.main === module) prepareReviewFixture().catch(error => { console.error(error.message); process.exitCode = 1; });
