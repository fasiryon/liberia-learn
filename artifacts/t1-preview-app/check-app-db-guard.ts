/**
 * Read-only operator check: would the deployed application's Preview DB guard accept these values?
 * Run: node --import tsx artifacts/t1-preview-app/check-app-db-guard.ts --env-file <git-ignored file>
 * Connects to nothing. Prints only a status and the guard's fixed refusal text, never a value.
 * It checks the local source file; the coordinator confirms the Vercel Preview values were set from it.
 */
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {assertStagingDatabaseIsolation} from '../../lib/database-target';
import {PREVIEW_PROJECT_REF} from '../../scripts/preview/preview-target.mjs';

function main(){
  const flag=process.argv.indexOf('--env-file');
  if(flag<0||!process.argv[flag+1])return {status:'REFUSED',code:'explicit_env_file_required'};
  const file=resolve(process.argv[flag+1]);
  if(spawnSync('git',['-C',dirname(file),'check-ignore','--quiet','--',file],{stdio:'ignore'}).status!==0)return {status:'REFUSED',code:'env_file_must_be_git_ignored'};
  let loaded:Record<string,string|undefined>;
  try{loaded=parseEnv(readFileSync(file,'utf8'));}catch{return {status:'REFUSED',code:'env_file_unreadable'};}
  const projectRef=loaded.STAGING_SUPABASE_PROJECT_REF??PREVIEW_PROJECT_REF;
  try{
    assertStagingDatabaseIsolation({NODE_ENV:'production',VERCEL_ENV:'preview',STAGING_SUPABASE_PROJECT_REF:projectRef,
      DATABASE_URL:loaded.DATABASE_URL,DIRECT_URL:loaded.DIRECT_URL,ENABLE_RDS_DUAL_WRITE:loaded.ENABLE_RDS_DUAL_WRITE});
  }catch(error){
    const message=error instanceof Error?error.message:'';
    // Guard messages are fixed text; refuse to print anything that could carry a value.
    return {status:'REFUSED',code:/postgres(ql)?:\/\/|@/.test(message)?'guard_refused':message};
  }
  return {status:'PASS',projectRefIsPreview:projectRef===PREVIEW_PROJECT_REF};
}
const result=main();
console.log(JSON.stringify(result));
process.exitCode=result.status==='PASS'?0:1;
