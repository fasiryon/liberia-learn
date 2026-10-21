// An isolated CI fixture, never a production consent assertion. The app gets SELECT only.
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
function assertReviewFixtureDatabase(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/lab_review_fixture' || process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.LAB_REVIEW_HARNESS !== '1') throw new Error('Only the isolated local lab_review_fixture database is permitted');
  return url;
}
async function main() {
  const adminUrl = process.env.REVIEW_FIXTURE_ADMIN_URL;
  if (!adminUrl) throw new Error('REVIEW_FIXTURE_ADMIN_URL is required');
  assertReviewFixtureDatabase(adminUrl);
  const appUrl = process.env.DATABASE_URL;
  if (!appUrl || assertReviewFixtureDatabase(appUrl).username !== 'lab_review_reader') throw new Error('Application fixture role must be lab_review_reader');
  const policy = fs.readFileSync('lib/policy/policyVersion.ts', 'utf8');
  const version = policy.match(/CURRENT_POLICY_VERSION = "([a-zA-Z0-9-]+)"/)?.[1];
  const key = policy.match(/DATA_POLICY_KEY = "([a-zA-Z0-9_]+)"/)?.[1];
  if (!version || !key) throw new Error('Current consent fixture policy could not be resolved');
  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    await admin.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "DataPolicyAcceptance" (id text PRIMARY KEY, "userId" text NOT NULL, "policyKey" text NOT NULL, "policyVersion" text NOT NULL)');
    await admin.$executeRawUnsafe('INSERT INTO "DataPolicyAcceptance" VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET "policyKey"=EXCLUDED."policyKey", "policyVersion"=EXCLUDED."policyVersion"', 'synthetic-lab-review-consent', 'synthetic-MOE_OFFICIAL', key, version);
    await admin.$executeRawUnsafe("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lab_review_reader') THEN CREATE ROLE lab_review_reader LOGIN PASSWORD 'lab-review-read-only-local'; END IF; END $$");
    await admin.$executeRawUnsafe('GRANT CONNECT ON DATABASE lab_review_fixture TO lab_review_reader');
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO lab_review_reader');
    await admin.$executeRawUnsafe('GRANT SELECT ON "DataPolicyAcceptance" TO lab_review_reader');
    await admin.$executeRawUnsafe('ALTER ROLE lab_review_reader SET default_transaction_read_only = on');
  } finally { await admin.$disconnect(); }
  const app = new PrismaClient({ datasourceUrl: appUrl });
  try {
    const setting = await app.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS read_only");
    if (setting[0]?.read_only !== 'on') throw new Error('Fixture application connection must be read-only');
    const accepted = await app.dataPolicyAcceptance.findFirst({ where: { userId: 'synthetic-MOE_OFFICIAL', policyKey: key, policyVersion: version }, select: { id: true } });
    if (!accepted) throw new Error('Synthetic reviewer consent fixture missing');
  } finally { await app.$disconnect(); }
  console.log('Local synthetic reviewer consent verified; application database role is read-only.');
}
module.exports = { assertReviewFixtureDatabase };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
