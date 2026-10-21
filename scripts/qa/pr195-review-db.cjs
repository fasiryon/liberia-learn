// Local-only consent fixture. The app role can SELECT this fixture and cannot mutate any record.
const { execFileSync } = require('node:child_process');
const name = 'liberialearn-pr195-review-db';
const existing = execFileSync('docker', ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}'], { encoding: 'utf8' }).trim();
if (!existing) execFileSync('docker', ['run', '--rm', '--name', name, '-p', '127.0.0.1:55495:5432', '-e', 'POSTGRES_PASSWORD=pr195-synthetic-local-only', '-e', 'POSTGRES_DB=pr195_review', '-d', 'postgres:16'], { stdio: 'pipe' });
async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'pipe' }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  if (!ready) throw new Error('Local PostgreSQL did not become ready');
  const sql = `
    CREATE TABLE IF NOT EXISTS "DataPolicyAcceptance" (id text PRIMARY KEY, "userId" text NOT NULL, "policyKey" text NOT NULL, "policyVersion" text NOT NULL);
    INSERT INTO "DataPolicyAcceptance" VALUES ('synthetic-review-consent', 'synthetic-MOE_OFFICIAL', 'terms_privacy', '2026-04') ON CONFLICT (id) DO NOTHING;
    DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='review_reader') THEN CREATE ROLE review_reader LOGIN PASSWORD 'pr195-read-only-local'; END IF; END $$;
    GRANT CONNECT ON DATABASE pr195_review TO review_reader;
    GRANT USAGE ON SCHEMA public TO review_reader;
    GRANT SELECT ON "DataPolicyAcceptance" TO review_reader;
    ALTER ROLE review_reader SET default_transaction_read_only = on;
  `;
  execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'pr195_review', '-v', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
  console.log('Isolated synthetic consent fixture ready. Application role is read-only.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
