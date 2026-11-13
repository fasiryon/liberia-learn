import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
describe('hosted Preview setup never emits credentials into an agent pipe',()=>{
  it('refuses non-interactive execution before connecting or creating a setup receipt',()=>{
    const cwd=mkdtempSync(resolve('artifacts/t2-g4-e2e-20261029/setup-refusal-'));
    const file=join(cwd,'.env.fixture.local');
    const secret='fake-preview-role-password-not-a-live-credential';
    const ref='previewsyntheticrefz';
    writeFileSync(file,[`PREVIEW_DB_ROLE=preview_app`,`PREVIEW_DB_PASSWORD=${secret}`,`PREVIEW_SUPABASE_PROJECT_REF=${ref}`,`DATABASE_URL=postgresql://preview_app.${ref}:${secret}@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`,`DIRECT_URL=postgresql://preview_app.${ref}:${secret}@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require`].join('\n'));
    const result=spawnSync(process.execPath,[resolve('scripts/preview/setup-preview-db.mjs'),'--env-file',file],{cwd,encoding:'utf8',env:{...process.env,PREVIEW_PINNED_PROJECT_REF:ref,CI:'',VERCEL:undefined,VERCEL_ENV:undefined}});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('preview_setup_requires_private_operator_console');
    expect(result.stdout+result.stderr).not.toContain(secret);
    expect(existsSync(join(cwd,'artifacts/preview-setup-20261029/result.json'))).toBe(false);
  });
});
