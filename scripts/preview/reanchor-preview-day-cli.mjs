/** Local private-console entrypoint only. No dotenv auto-load, migrations, seed or integration keys. */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validatePreviewTarget,previewOperatorEnvironment} from './preview-target.mjs';

const fail=code=>{throw Error(`preview_reanchor_${code}`);};
async function main(){
  const args=process.argv.slice(2),options={};
  const names=new Set(['--credentials-file','--school','--section','--date']);
  let consoleRequested=false;
  for(let i=0;i<args.length;i++){
    const name=args[i];
    if(name==='--operator-console'&&!consoleRequested){consoleRequested=true;continue;}
    if(!names.has(name)||Object.hasOwn(options,name)||!args[i+1]||args[i+1].startsWith('--'))fail('arguments_refused');
    options[name]=args[++i];
  }
  if(Object.keys(options).length!==4)fail('arguments_refused');
  if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||!consoleRequested)fail('private_operator_console_required');
  const file=resolve(options['--credentials-file']);
  if(spawnSync('git',['-C',dirname(file),'check-ignore','--quiet','--',file],{stdio:'ignore'}).status!==0)fail('ignored_env_file_required');
  const loaded=parseEnv(readFileSync(file,'utf8'));
  // Only named target variables are accepted from this explicitly selected file.
  const env=previewOperatorEnvironment(loaded);
  const target=validatePreviewTarget(env);
  const require=createRequire(import.meta.url);
  const {PrismaClient}=require('@prisma/client');
  const {createJiti}=require('jiti');
  const load=createJiti(import.meta.url,{alias:{'@':process.cwd()},fsCache:false});
  const {reanchorPreviewDay}=await load.import('./reanchor-preview-day.ts');
  const db=new PrismaClient({datasources:{db:{url:target.directUrl}},log:[]});
  try{
    const receipt=await reanchorPreviewDay(db,{schoolId:options['--school'],classId:options['--section'],date:options['--date']},env);
    console.log(JSON.stringify(receipt));
  }finally{await db.$disconnect();}
}
main().catch(error=>{
  const code=error instanceof Error&&/^preview_(?:reanchor_[a-z_]+|database_target_refused)$/.test(error.message)?error.message:'preview_reanchor_failed';
  console.error(code);process.exitCode=1;
});
