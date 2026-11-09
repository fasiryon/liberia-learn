import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const guard=resolve('scripts/e2e/block-school-day-egress.cjs');
describe('Atlas independent HTTP option-precedence tripwire review',()=>{
  it.each([
    {module:'node:http',method:'request',url:'https://api.synthetic.invalid',options:{}},
    {module:'node:http',method:'request',url:'http://127.0.0.1:3100',options:{hostname:'api.synthetic.invalid'}},
    {module:'node:https',method:'get',url:'https://localhost',options:{hostname:'api.synthetic.invalid'}},
  ])('blocks the effective destination before original $module.$method',row=>{
    const code=`const client=require(${JSON.stringify(row.module)});let originalCalled=false;client[${JSON.stringify(row.method)}]=()=>{originalCalled=true;return {};};require(${JSON.stringify(guard)});let blocked=false;try{client[${JSON.stringify(row.method)}](${JSON.stringify(row.url)},${JSON.stringify(row.options)});}catch(e){blocked=e.message==='school_day_external_request_forbidden';}console.log(JSON.stringify({originalCalled,blocked}));`;
    const result=spawnSync(process.execPath,['-e',code],{cwd:mkdtempSync(join(tmpdir(),'atlas-egress-')),env:{...process.env,CI:'true',E2E_SYNTHETIC:'1',VERCEL:undefined,VERCEL_ENV:undefined,GITHUB_RUN_ID:'atlas-review'},encoding:'utf8'});
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({originalCalled:false,blocked:true});
  });
});

describe('loopback controls keep the original Node requester contract',()=>{
  it.each([
    {module:'node:http',method:'request',url:'http://127.0.0.1:3100',options:{}},
    {module:'node:https',method:'get',url:'https://localhost',options:{hostname:'127.0.0.1'}},
    {module:'node:http',method:'request',url:{hostname:'localhost',port:3100},options:undefined},
    {module:'node:https',method:'request',url:{host:'127.0.0.1',port:3100},options:undefined},
  ])('allows effective loopback $module.$method without opening a socket',row=>{
    const code=`const client=require(${JSON.stringify(row.module)});let originalCalled=false;client[${JSON.stringify(row.method)}]=()=>{originalCalled=true;return {};};require(${JSON.stringify(guard)});let blocked=false;try{client[${JSON.stringify(row.method)}](${JSON.stringify(row.url)},${JSON.stringify(row.options)});}catch(e){blocked=true;}console.log(JSON.stringify({originalCalled,blocked}));`;
    const result=spawnSync(process.execPath,['-e',code],{cwd:mkdtempSync(join(tmpdir(),'t2-egress-')),env:{...process.env,CI:'true',E2E_SYNTHETIC:'1',VERCEL:undefined,VERCEL_ENV:undefined,GITHUB_RUN_ID:'t2-review'},encoding:'utf8'});
    expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toEqual({originalCalled:true,blocked:false});
  });
});
