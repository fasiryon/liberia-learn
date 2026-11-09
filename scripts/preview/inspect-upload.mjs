// Read-only local inventory using the installed Vercel client's own file tree.
// This never invokes deployment, authentication, or environment APIs.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const args=process.argv.slice(2);
const option=name=>args[args.indexOf(name)+1];
if(!args.includes('--client-module')||!args.includes('--output'))throw Error('upload_inspection_arguments_required');
const root=await realpath(process.cwd());
const output=path.resolve(option('--output'));
if(!output.startsWith(root+path.sep))throw Error('upload_receipt_must_stay_in_workspace');
const clientModule=path.resolve(option('--client-module'));
const client=(await import(pathToFileURL(clientModule).href)).require_dist();
const options={isDirectory:true,prebuilt:false,projectName:'liberia-learn-preview'};
const enumerate=async()=>{
  const result=await client.buildFileTree(root,options,()=>{});
  return result.fileList.map(file=>path.relative(root,file).split(path.sep).join('/')).sort();
};
const files=await enumerate();
const forbidden=/^(?:\.env(?:\.|$)|\.git(?:\/|$)|\.worktrees\/|\.task-worktrees\/|\.agents\/|\.codex\/|\.aws\/|\.claude\/|os-vault\/|__tests__\/|tests\/|e2e\/|test-results\/|playwright-report\/|docs\/(?:audits|security|qa|internal)\/|curriculum\/program\/stem-v1\/security\/)/;
if(files.some(file=>forbidden.test(file)||file.endsWith('.log')))throw Error('upload_contains_excluded_evidence');
const runtimeArtifacts=new Set([
  'artifacts/curriculum-cleanup-v1/snapshot.json',
  'artifacts/curriculum-cleanup-v1/cleanup-plan.json',
  'artifacts/g7-native-curriculum-v1/legacy/literacy-essay-structure-argument.json',
  'artifacts/g7-native-curriculum-v1/legacy/math-number-sense-place-value.json',
]);
if(files.some(file=>file.startsWith('artifacts/')&&!runtimeArtifacts.has(file)))throw Error('upload_contains_local_artifact');
const required=[...runtimeArtifacts,'package.json','package-lock.json','next.config.js','next-env.d.ts','tsconfig.json','.eslintrc.json','.eslintignore','postcss.config.js','postcss.config.mjs','tailwind.config.js','prisma/schema.prisma','prisma.config.ts','i18n.ts','lib/validateEnv.shared.js','scripts/patch-vitest-offline-wildcard.mjs','scripts/seed-demo.ts','curriculum/program/stem-v1/resolved-days/g4-day1.json','curriculum/program/stem-v1/period-matrix.json'];
const plan=JSON.parse(await readFile('curriculum/program/stem-v1/resolved-days/g4-day1.json','utf8'));
const versions=[...new Set(plan.blocks.flatMap(({binding})=>binding?.selection?[binding.selection.split('@')[1]]:[]))];
if(versions.length!==8||versions.some(v=>!/^4\.0\.0-schoolday-[a-z0-9.-]+$/.test(v)))throw Error('upload_invalid_frozen_day');
let sealedFiles=0;
for(const version of versions){
  const base=`curriculum/factory-v4/drafts/${version}`;
  const receipt=JSON.parse(await readFile(`${base}/generation-receipt.json`,'utf8'));
  for(const file of Object.keys(receipt.files)){required.push(`${base}/${file}`);sealedFiles++;}
  required.push(`${base}/generation-receipt.json`);
}
if(required.some(file=>!files.includes(file)))throw Error('upload_missing_runtime_input');
const hashFile=async file=>{
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
};
const entries=[];
for(const file of files){
  const absolute=path.join(root,file);
  const stat=await lstat(absolute);
  if(stat.isSymbolicLink())throw Error('upload_symlink_requires_review');
  if(!stat.isFile())continue;
  const resolved=await realpath(absolute);
  if(!resolved.startsWith(root+path.sep))throw Error('upload_path_escape');
  const sha256=await hashFile(absolute);
  const after=await lstat(absolute);
  if(stat.size!==after.size||stat.mtimeMs!==after.mtimeMs)throw Error('upload_input_changed_during_inspection');
  entries.push({path:file,size:stat.size,sha256,reason:runtimeArtifacts.has(file)?'existing filesystem curriculum input':file.startsWith('curriculum/factory-v4/drafts/')?'preserved curriculum package':file.startsWith('lib/agents/prompts/')?'runtime agent prompt':'application source, asset, or build input'});
}
if(JSON.stringify(files)!==JSON.stringify(await enumerate()))throw Error('upload_file_set_changed_during_inspection');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceHead=git('rev-parse','HEAD');
// Excluded evidence may be untracked. Every included byte must belong to HEAD.
const assertCommittedInputs=()=>{
  const dirty=[...git('diff','HEAD','--name-only').split(/\r?\n/),...git('ls-files','--others','--exclude-standard').split(/\r?\n/)];
  if(dirty.some(file=>files.includes(file)))throw Error('upload_included_inputs_not_committed');
  if(git('rev-parse','HEAD')!==sourceHead)throw Error('upload_source_head_changed');
};
assertCommittedInputs();
for(const entry of entries)if(await hashFile(path.join(root,entry.path))!==entry.sha256)throw Error('upload_input_changed_after_hash');
assertCommittedInputs();
const receipt={schema:'preview-upload-inventory/1',sourceHead,trackedChanges:git('diff','--name-only'),clientModuleSha256:await hashFile(clientModule),ignoreSha256:await hashFile('.vercelignore'),mode:'source upload, not prebuilt',method:'installed Vercel client buildFileTree; two sequential hash passes; included inputs committed at HEAD; no network or upload',fileCount:entries.length,sealedReceiptFiles:sealedFiles,requiredInputs:required,excludedCategories:['credentials','security tests and reproductions','audit reports','local artifacts except four runtime JSON inputs','agent coordination','local dependency and build caches'],limitations:['Build-time generated output and final server tracing require a separate build inspection.','Included curriculum and governance documents remain non-public application inputs; no deployment is authorized by this receipt.'],files:entries};
await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({fileCount:entries.length,sealedReceiptFiles:sealedFiles,requiredInputs:required.length,receipt:path.relative(root,output)}));
