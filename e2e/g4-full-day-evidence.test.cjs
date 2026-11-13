// Offline tests of the browser-result ledger. No browser, database, generated client or app runtime.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'g4-full-day-evidence.ts'),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;

function fixture(){
  const writes=new Map(),exports={};
  const expect=value=>({
    toMatch:pattern=>assert.match(value,pattern),toBe:other=>assert.equal(value,other),
    toHaveLength:length=>assert.equal(value.length,length),toEqual:other=>assert.equal(JSON.stringify(value),JSON.stringify(other)),
  });
  vm.runInNewContext(source,{exports,Buffer,process:{env:{}},require:name=>{
    if(name==='@playwright/test')return {expect};
    if(name==='node:child_process')return {execFileSync:()=>`${'a'.repeat(40)}\n`};
    if(name==='node:fs')return {mkdirSync:()=>{},lstatSync:()=>({isSymbolicLink:()=>false}),
      mkdtempSync:()=>'/synthetic-gallery/run-test',writeFileSync:(file,body)=>writes.set(file,String(body))};
    if(['node:crypto','node:path'].includes(name))return require(name);
    throw Error('unexpected_test_dependency');
  }});
  const packages=[8,8,8,9,10,8,10,5].map((count,i)=>({selection:`p${i+1}`,hash:String(i).repeat(64),
    experience:{scenes:Array.from({length:count},(_,j)=>({id:`scene-${j}`,interaction:{kind:'NONE'}}))}}));
  return {ledger:new exports.FullDayEvidence(packages),writes};
}

test('every scene and unfinished-period return starts INCOMPLETE',()=>{
  const {ledger}=fixture();
  assert.equal(ledger.periods.flatMap(p=>p.scenes).length,66);
  assert.ok(ledger.periods.every(p=>p.scenes.every(s=>s.status==='INCOMPLETE')));
  assert.equal(ledger.periods[0].leaveReturn?.status,'INCOMPLETE');
});

test('a failed Leave lesson return cannot produce a period PASS',()=>{
  const {ledger}=fixture(),period=ledger.periods[0];
  period.scenes.forEach(s=>{s.status='PASS';});
  period.finish={status:'PASS',reason:'observed'};period.transition={status:'PASS',reason:'observed'};
  period.leaveReturn={status:'FAIL',reason:'wrong_period'};
  assert.throws(()=>ledger.periodPassed(),/unfinished_period_return_not_verified/);
  assert.notEqual(period.status,'PASS');
});

test('period PASS requires scene, Finish, Leave and next-period UI outcomes',()=>{
  const {ledger}=fixture(),period=ledger.periods[0];
  period.finish={status:'PASS',reason:'observed'};period.transition={status:'PASS',reason:'observed'};
  period.leaveReturn={status:'PASS',reason:'same_unfinished_period'};
  assert.throws(()=>ledger.periodPassed(),/period_scene_or_finish_not_verified/);
  period.scenes.forEach(s=>{s.status='PASS';});
  ledger.periodPassed();assert.equal(period.status,'PASS');
});

test('an activity failure records FAIL and retains all unreached scenes as INCOMPLETE',()=>{
  const {ledger}=fixture();ledger.activeScene=0;ledger.stage='ACTIVITY:CHECK:test';ledger.fail();
  assert.equal(ledger.periods[0].status,'FAIL');
  assert.equal(ledger.periods[0].scenes[0].status,'FAIL');
  assert.ok(ledger.periods.flatMap(p=>p.scenes).slice(1).every(s=>s.status==='INCOMPLETE'));
  assert.equal(ledger.capabilities.durableStudentEvidence.status,'INCOMPLETE');
});
