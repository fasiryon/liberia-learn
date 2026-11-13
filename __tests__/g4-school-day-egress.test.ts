import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const guard=resolve('scripts/e2e/block-school-day-egress.cjs');
describe('school-day server egress tripwire',()=>{
  it.each([
    "fetch('https://api.openai.com/v1/responses')",
    "require('node:https').request('https://api.anthropic.com/v1/messages')",
    "require('node:http').get({hostname:'api.openai.com',path:'/v1/responses'})",
  ])('refuses and records an attempted external call before networking: %s',code=>{
    const cwd=mkdtempSync(join(tmpdir(),'g4-egress-'));
    const result=spawnSync(process.execPath,['--require',guard,'-e',code],{cwd,env:{...process.env,CI:'true',E2E_SYNTHETIC:'1',VERCEL:undefined,VERCEL_ENV:undefined,GITHUB_RUN_ID:'fixture'},encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('school_day_external_request_forbidden');
    expect(JSON.parse(readFileSync(join(cwd,'artifacts/g4-e2e/egress-guard-fixture.json'),'utf8'))).toMatchObject({syntheticOnly:true});
    expect(readFileSync(join(cwd,'artifacts/g4-e2e/egress-attempts-fixture.jsonl'),'utf8')).not.toContain('v1/');
  });
  it('cannot be activated in a deployment environment',()=>{
    const cwd=mkdtempSync(join(tmpdir(),'g4-egress-'));
    const result=spawnSync(process.execPath,['--require',guard,'-e',''],{cwd,env:{...process.env,CI:'true',E2E_SYNTHETIC:'1',VERCEL_ENV:'production'},encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('requires_disposable_ci');
    expect(existsSync(join(cwd,'artifacts'))).toBe(false);
  });
  it('the server launcher refuses a non-disposable URL before file copies or process launch',()=>{
    const cwd=mkdtempSync(join(tmpdir(),'g4-server-'));
    const launcher=resolve('scripts/e2e/start-school-day.cjs');
    const result=spawnSync(process.execPath,[launcher],{cwd,env:{...process.env,CI:'true',E2E_SYNTHETIC:'1',VERCEL:undefined,VERCEL_ENV:undefined,DATABASE_URL:'postgresql://postgres:postgres@db.example/production'},encoding:'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('school_day_server_database_not_disposable');
    expect(existsSync(join(cwd,'.next'))).toBe(false);
  });
});
