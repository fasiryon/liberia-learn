// Execute the author's exact completeness-test callback against an in-memory source tree.
// No T1 file edits, API calls, account provisioning or database connection.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const source=execFileSync('git',['show','5daefe7c:__tests__/preview-identity-freeze.test.ts'],{encoding:'utf8'});
const ast=ts.createSourceFile('review.ts',source,ts.ScriptTarget.Latest,true);
let callback,allow;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='ALLOW')allow=node.getText(ast);if(ts.isCallExpression(node)&&node.expression.getText(ast)==='it'&&node.arguments[0]?.getText(ast).includes('every route that writes identity data'))callback=node.arguments[1].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert(callback&&allow);
const compiled=ts.transpileModule(`const ${allow}; module.exports = ${callback};`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const controls=['admin/interoperability/oneroster/import','admin/students','admin/guardian-link','enroll','admin/school','platform/security/accept'];
const cases=[
  {name:'ordinary-direct-writer',route:'export async function POST(){return prisma.user.create({data:payload});}'},
  {name:'whitespace-in-property-call',route:'export async function POST(){return prisma.user .create ({data:payload});}'},
  {name:'computed-model-property',route:'export async function POST(){return prisma["user"].create({data:payload});}'},
  {name:'arrow-export-provisioner',route:'import {provision} from "@/lib/provision"; export async function POST(){return provision(payload);}',lib:'export const provision = async (payload) => prisma.user.create({data:payload});'},
  {name:'namespace-import-provisioner',route:'import * as identities from "@/lib/provision"; export async function POST(){return identities.provision(payload);}',lib:'export async function provision(payload){return prisma.user.create({data:payload});}'},
  {name:'cross-file-helper-provisioner',route:'import {provision} from "@/lib/provision"; export async function POST(){return provision(payload);}',lib:'import {child} from "@/lib/child";\nexport async function provision(payload){return child(payload);}',child:'export async function child(payload){return prisma.user.create({data:payload});}'},
  {name:'guard-in-comment-only',route:'// previewIdentityFrozen(\nexport async function POST(){return prisma.user.create({data:payload});}'},
  {name:'guard-only-in-other-handler',route:'export async function GET(){return previewIdentityFrozen();}\nexport async function POST(){return prisma.user.create({data:payload});}'},
];
async function run(test){
  const files=Object.fromEntries(controls.map(p=>[`app/api/${p}/route.ts`,'export async function POST(){ const frozen=previewIdentityFrozen(); if(frozen)return frozen; return prisma.user.create({data:payload});}']));
  files['app/api/new-entry/route.ts']=test.route;if(test.lib)files['lib/provision.ts']=test.lib;if(test.child)files['lib/child.ts']=test.child;
  const norm=p=>p.replaceAll('\\','/');
  const fake={readFileSync:p=>{assert(norm(p) in files);return files[norm(p)];},readdirSync:dir=>{
    const base=norm(dir)+'/',names=new Set(Object.keys(files).filter(f=>f.startsWith(base)).map(f=>f.slice(base.length).split('/')[0]));
    return [...names].map(name=>({name,isDirectory:()=>Object.keys(files).some(f=>f.startsWith(base+name+'/'))}));
  }};
  let offenders;
  const context={module:{exports:null},require:name=>name==='node:fs'?fake:name==='node:path'?path:assert.fail('unexpected module'),expect:actual=>({toContain:expected=>assert(actual.includes(expected)),toEqual:expected=>{offenders=Array.from(actual);assert.deepEqual(actual,expected);}})};
  vm.runInNewContext(compiled,context);
  try{await context.module.exports();return {case:test.name,detectorRejected:false};}catch(error){if(!offenders?.includes('app/api/new-entry/route.ts'))throw error;return {case:test.name,detectorRejected:true};}
}
(async()=>{
  const results=[];for(const test of cases)results.push(await run(test));
  console.log(JSON.stringify({syntheticMutationResults:results}));
  assert.equal(results[0].detectorRejected,true);assert(results.slice(1).every(r=>!r.detectorRejected));
  const result={reviewedCode:'5daefe7ce484182f10fa412fa50e0e9e474f7f7b',testSourceSha256:createHash('sha256').update(source).digest('hex'),ordinaryWriterControlRejected:true,undetectedValidEntryPointForms:results.slice(1).length,results,completenessVerdict:'REVISE'};
  fs.writeFileSync(path.join(__dirname,'completeness-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(()=>{console.error('independent_completeness_probe_failed');process.exitCode=1;});
