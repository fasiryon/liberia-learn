/**
 * T1 hosted Preview readiness (2026-11-02): the deployed Preview must refuse a wrong database before any query.
 * Next 14 never runs instrumentation register(), so assertStagingDatabaseIsolation() must also run where the
 * Prisma singleton is created. The accepted topology is the operator contract in scripts/preview/preview-target.mjs:
 * restricted role preview_app on the shared pooler (preview_app.<ref>) or the direct host. Synthetic values only.
 */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assertStagingDatabaseIsolation,PRODUCTION_SUPABASE_PROJECT_REF as prod} from '@/lib/database-target';

vi.mock('@prisma/client',()=>({PrismaClient:class{constructor(public options:unknown){}}}));
const ref='previewsyntheticrefz',secret='synthetic-guard-unit-only-placeholder';
const pooled=(role:string,port:number,query:string)=>`postgresql://${role}.${ref}:${secret}@aws-0-us-east-2.pooler.supabase.com:${port}/postgres?${query}`;
const restricted:Partial<NodeJS.ProcessEnv>={
  VERCEL_ENV:'preview',STAGING_SUPABASE_PROJECT_REF:ref,
  DATABASE_URL:pooled('preview_app',6543,'pgbouncer=true&sslmode=require'),
  DIRECT_URL:`postgresql://preview_app:${secret}@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
};
const KEYS=['VERCEL_ENV','STAGING_SUPABASE_PROJECT_REF','DATABASE_URL','DIRECT_URL','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','ENABLE_RDS_DUAL_WRITE','RDS_DATABASE_URL'];
function stub(env:Partial<NodeJS.ProcessEnv>){
  for(const key of KEYS)vi.stubEnv(key,undefined as unknown as string);
  for(const [key,value] of Object.entries(env))vi.stubEnv(key,value as string);
}
async function importDb(){
  vi.resetModules();
  delete (globalThis as {prisma?:unknown}).prisma;
  return import('@/lib/db');
}
const guard=(env:Partial<NodeJS.ProcessEnv>)=>assertStagingDatabaseIsolation({NODE_ENV:'production',...env});
beforeEach(()=>vi.unstubAllEnvs());
afterEach(()=>{vi.unstubAllEnvs();delete (globalThis as {prisma?:unknown}).prisma;});

describe('restricted-role Preview topology accepted by the operator contract',()=>{
  it('RED: preview_app.<ref> transaction pooler with a direct-host DIRECT_URL is accepted',()=>{
    expect(()=>guard({...restricted})).not.toThrow();
  });
  it('RED: preview_app.<ref> session pooler DIRECT_URL is accepted',()=>{
    expect(()=>guard({...restricted,DIRECT_URL:pooled('preview_app',5432,'sslmode=require')})).not.toThrow();
  });
  it('RED: verify-full TLS, which the operator contract permits, is accepted',()=>{
    expect(()=>guard({...restricted,DATABASE_URL:pooled('preview_app',6543,'pgbouncer=true&sslmode=verify-full')})).not.toThrow();
  });
  it.each([
    ['an unapproved pooler role',{DATABASE_URL:pooled('wrong',6543,'pgbouncer=true&sslmode=require')}],
    ['the production project',{DATABASE_URL:pooled('preview_app',6543,'pgbouncer=true&sslmode=require').replace(ref,prod)}],
    ['TLS disabled',{DATABASE_URL:pooled('preview_app',6543,'pgbouncer=true&sslmode=disable')}],
    ['missing TLS',{DATABASE_URL:pooled('preview_app',6543,'pgbouncer=true')}],
    ['a session-mode runtime URL',{DATABASE_URL:pooled('preview_app',5432,'pgbouncer=true&sslmode=require')}],
    ['a transaction-mode DIRECT_URL',{DIRECT_URL:pooled('preview_app',6543,'pgbouncer=true&sslmode=require')}],
    ['a missing project pin',{STAGING_SUPABASE_PROJECT_REF:undefined}],
    ['a production project pin',{STAGING_SUPABASE_PROJECT_REF:prod}],
    ['a pin for a different non-production project',{STAGING_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst'}],
    ['a missing runtime URL',{DATABASE_URL:undefined}],
    ['RDS dual-write to a second database',{ENABLE_RDS_DUAL_WRITE:'true',RDS_DATABASE_URL:'postgresql://user:pw@rds.synthetic.invalid:5432/app'}],
  ] as Array<[string,Partial<NodeJS.ProcessEnv>]>)('still refuses %s',(_label,override)=>{
    expect(()=>guard({...restricted,...override})).toThrow();
  });
  it('never echoes a credential or connection string in the refusal',()=>{
    try{guard({...restricted,DATABASE_URL:pooled('wrong',6543,'pgbouncer=true&sslmode=require')});throw Error('expected refusal');}
    catch(error){const message=error instanceof Error?error.message:'';expect(message).not.toContain(secret);expect(message).not.toContain('postgresql://');}
  });
});

describe('the Prisma singleton enforces the guard in deployed Preview (instrumentation is dormant on Next 14)',()=>{
  it('RED: a Preview runtime pointed at the production project refuses before a client exists',async()=>{
    stub({...restricted,DATABASE_URL:pooled('preview_app',6543,'pgbouncer=true&sslmode=require').replace(ref,prod)});
    await expect(importDb()).rejects.toThrow(/\[Startup\]/);
  });
  it('RED: a Preview runtime missing its project pin refuses',async()=>{
    stub({...restricted,STAGING_SUPABASE_PROJECT_REF:undefined});
    await expect(importDb()).rejects.toThrow('STAGING_SUPABASE_PROJECT_REF is required');
  });
  it('a Preview runtime whose pin names a different project refuses',async()=>{
    stub({...restricted,STAGING_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst'});
    await expect(importDb()).rejects.toThrow('does not match STAGING_SUPABASE_PROJECT_REF');
  });
  it('a Preview runtime with RDS dual-write configured refuses before the second client exists',async()=>{
    stub({...restricted,ENABLE_RDS_DUAL_WRITE:'true',RDS_DATABASE_URL:'postgresql://user:pw@rds.synthetic.invalid:5432/app'});
    await expect(importDb()).rejects.toThrow('must not dual-write');
  });
  it('a correctly isolated restricted-role Preview creates the client',async()=>{
    stub(restricted);
    await expect(importDb()).resolves.toHaveProperty('prisma');
  });
  it('Production identity is unchanged: no staging pin is required',async()=>{
    stub({VERCEL_ENV:'production',DATABASE_URL:pooled('postgres',6543,'pgbouncer=true').replace(ref,prod)});
    await expect(importDb()).resolves.toHaveProperty('prisma');
  });
  it('local and CI runs without a Vercel identity are unchanged',async()=>{
    stub({DATABASE_URL:'postgresql://postgres:postgres@localhost:5432/e2e'});
    await expect(importDb()).resolves.toHaveProperty('prisma');
  });
});
