import {describe,it,expect} from 'vitest';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validatePreviewTarget,previewOperatorEnvironment,PRODUCTION_PROJECT_REF as prod} from '@/scripts/preview/preview-target.mjs';
// Synthetic reference; the real Preview project is pinned at runtime (PREVIEW_PINNED_PROJECT_REF), never in source.
const ref='previewsyntheticrefz';
const password='synthetic-target-unit-test-placeholder';
const make=(port:string)=>`postgresql://preview_app.${ref}:${password}@aws-0-us-east-2.pooler.supabase.com:${port}/postgres?sslmode=require${port==='6543'?'&pgbouncer=true':''}`;
const env={SYNTHETIC_PREVIEW_SEED:'1',PREVIEW_PINNED_PROJECT_REF:ref,PREVIEW_SUPABASE_PROJECT_REF:ref,PREVIEW_DB_ROLE:'preview_app',PREVIEW_DB_PASSWORD:password,DATABASE_URL:make('6543'),DIRECT_URL:make('5432')};
describe('exact Preview project and restricted role before any schema or seed operation',()=>{
  it('offline operator check emits only a fixed result and does not repair an invalid file',()=>{
    const dir=mkdtempSync(resolve('artifacts/t2-g4-e2e-20261029/url-validator-'));
    const file=join(dir,'.env.fixture.local');
    const run=()=>spawnSync(process.execPath,[resolve('scripts/preview/validate-preview-env.mjs'),'--credentials-file',file],{encoding:'utf8',env:{...process.env,PREVIEW_PINNED_PROJECT_REF:ref,CI:'',VERCEL:undefined,VERCEL_ENV:''}});
    const configured=Object.entries(env).filter(([key])=>key!=='SYNTHETIC_PREVIEW_SEED').map(([key,value])=>`${key}=${value}`).join('\n');
    writeFileSync(file,configured);const good=run();expect(good.status).toBe(0);expect(good.stdout.trim()).toBe('preview_exact_config_valid');expect(good.stderr).toBe('');
    writeFileSync(file,configured.replaceAll('sslmode=require','sslmode=disable'));const bad=run();expect(bad.status).toBe(1);expect(bad.stdout).toBe('');expect(bad.stderr.trim()).toBe('preview_database_target_refused');
    for(const output of [good.stdout,good.stderr,bad.stdout,bad.stderr])expect(output).not.toContain(password);
  });
  it('does not fill a missing configured URL/password from the ambient environment',()=>{
    for(const key of ['DATABASE_URL','DIRECT_URL','PREVIEW_DB_PASSWORD']){
      const configured={...env};delete configured[key];
      expect(()=>validatePreviewTarget(previewOperatorEnvironment(configured,env))).toThrow('preview_database_target_refused');
    }
  });
  it('accepts properly encoded reserved credential characters without rewriting the configured URL',()=>{
    const pw=password+'@:/?#%';
    const configured={...env,PREVIEW_DB_PASSWORD:pw,DATABASE_URL:make('6543').replace(password,encodeURIComponent(pw)),DIRECT_URL:make('5432').replace(password,encodeURIComponent(pw))};
    expect(validatePreviewTarget(configured).databaseUrl).toBe(configured.DATABASE_URL);
    expect(()=>validatePreviewTarget({...configured,DATABASE_URL:make('6543').replace(password,pw)})).toThrow('preview_database_target_refused');
  });
  it('accepts only exact configured URLs and returns them byte-for-byte without normalization',()=>{
    const target=validatePreviewTarget(env);expect(target.projectRef).toBe(ref);expect(target.role).toBe('preview_app');
    expect(new URL(target.databaseUrl).searchParams.get('sslmode')).toBe('require');
    expect(new URL(target.directUrl).searchParams.get('sslmode')).toBe('require');
    expect(target.databaseUrl).toBe(env.DATABASE_URL);expect(target.directUrl).toBe(env.DIRECT_URL);
  });
  it('accepts different runtime and direct hostnames when both prove the same project and purpose',()=>{
    const direct=`postgresql://preview_app:${password}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
    expect(validatePreviewTarget({...env,DIRECT_URL:direct}).directUrl).toBe(direct);
  });
  it.each([
    {DATABASE_URL:make('6543').replace('sslmode=require&','')},
    {DIRECT_URL:make('5432').replace('?sslmode=require','')},
    {DIRECT_URL:make('5432')+'&pgbouncer=true'},
    {DATABASE_URL:make('6543').replace('sslmode=require','sslmode=verify-full')},
    {DATABASE_URL:make('6543')+'&connection_limit=0'},
    {DATABASE_URL:make('6543')+'&pool_timeout=0001'},
    {DATABASE_URL:make('6543')+'&pool_timeout=10000'},
    {DATABASE_URL:make('6543')+'&sslmode=disable'},
    {DATABASE_URL:make('6543')+'&ssl%6dode=require'},
    {DATABASE_URL:make('6543')+'&host=production.invalid'},
    {DATABASE_URL:make('6543')+'#'},
    {DATABASE_URL:' '+make('6543')},
    {DATABASE_URL:make('6543').replace(password,'%ZZ')},
    {DATABASE_URL:make('6543').replace(password,'')},
    {DATABASE_URL:make('6543').replace('/postgres?','/another-db?')},
    {PREVIEW_DB_PASSWORD:undefined},
    {DIRECT_URL:`postgresql://preview_app:${password}@db.${prod}.supabase.co:5432/postgres?sslmode=require`},
  ])('refuses exact stored URL defects without repairing or exposing them (%#)',override=>{
    const input={...env,...override},before={...input};
    expect(()=>validatePreviewTarget(input)).toThrow('preview_database_target_refused');expect(input).toEqual(before);
  });
  it.each([
    {SYNTHETIC_PREVIEW_SEED:'0'},{VERCEL_ENV:'production'},{VERCEL:'1'},{CI:'true'},
    {PREVIEW_SUPABASE_PROJECT_REF:prod},{PREVIEW_DB_ROLE:'postgres'},
    {DATABASE_URL:make('6543').replace(ref,prod)},{DIRECT_URL:make('5432').replace(ref,prod)},
    {DATABASE_URL:make('6543').replace('preview_app.','postgres.')},
    {DIRECT_URL:make('5432').replace('preview_app.','postgres.')},
    {DATABASE_URL:make('6543').replace('aws-0-us-east-2.pooler.supabase.com','example.invalid')},
    {DATABASE_URL:make('6543').replace('pgbouncer=true','host=db.production.invalid')},
    {DATABASE_URL:make('6543')+'&sslmode=disable'},
    {DATABASE_URL:make('6543')+'&pgbouncer=true'},
    {DIRECT_URL:make('6543')},{DATABASE_URL:make('5432')},
    {PREVIEW_DB_PASSWORD:'different-synthetic-password'},
  ])('refuses an unsafe or ambiguous target override (%#)',override=>{
    expect(()=>validatePreviewTarget({...env,...override})).toThrow('preview_database_target_refused');
  });
  it('never includes a URL or password in the error',()=>{
    try{validatePreviewTarget({...env,DIRECT_URL:'malformed:'+password});throw Error('expected refusal');}
    catch(error){expect(error instanceof Error?error.message:'').toBe('preview_database_target_refused');}
  });
});
