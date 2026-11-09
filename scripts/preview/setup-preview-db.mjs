/** Explicitly authorized isolated Preview setup. Never prints connection strings or secrets. */
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,createWriteStream,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline';
import {validatePreviewTarget,previewOperatorEnvironment} from './preview-target.mjs';
import {PREVIEW_CREDENTIAL_SCOPE,assertReviewerAccounts,writeReviewerCredentials} from './reviewer-credentials.mjs';
// JSON keeps this native .mjs operator entrypoint portable to Node 20.
const {SCHOOL_DAY_EMAILS,SCHOOL_DAY_IDS}=JSON.parse(readFileSync(new URL('../e2e/school-day-identities.json',import.meta.url),'utf8'));

const root=process.cwd(),out=resolve(root,'artifacts/preview-setup-20261029');
const receiptPath=resolve(out,'result.json');
const require=createRequire(import.meta.url);
const safeError=code=>{throw Error(code);};
async function main(){
  const flag=process.argv.indexOf('--env-file');
  if(flag<0||!process.argv[flag+1])safeError('preview_explicit_env_file_required');
  const file=resolve(process.argv[flag+1]);
  // Check the explicitly named file's repository ignore rule without printing contents.
  const ignored=spawnSync('git',['-C',dirname(file),'check-ignore','--quiet','--',file],{stdio:'ignore'});
  if(ignored.status!==0)safeError('preview_secret_file_must_be_git_ignored');
  if(!existsSync(file))safeError('preview_secret_file_missing');
  let loaded;
  try{loaded=parseEnv(readFileSync(file,'utf8'));}catch{safeError('preview_secret_file_parse_failed');}
  const env=previewOperatorEnvironment(loaded);
  const target=validatePreviewTarget(env);
  if(existsSync(receiptPath)){
    const prior=JSON.parse(readFileSync(receiptPath,'utf8'));
    if(prior.status==='COMPLETE'&&prior.projectRef===target.projectRef&&prior.credentialScope===PREVIEW_CREDENTIAL_SCOPE){console.log(JSON.stringify({status:'ALREADY_COMPLETE',projectRef:prior.projectRef,counts:prior.counts,ids:prior.ids}));return;}
    safeError('preview_setup_prior_attempt_requires_review');
  }
  // Plaintext account passwords go ONLY to a separate actual operator console.
  // Tool pipes and CI must refuse before any database connection or mutation.
  if(process.platform!=='win32'||!process.stdout.isTTY||!process.stdin.isTTY||!process.argv.includes('--operator-console'))
    safeError('preview_setup_requires_private_operator_console');
  const operatorFd=openSync('\\\\.\\CONOUT$','w');
  mkdirSync(out,{recursive:true});
  closeSync(openSync(resolve(out,'attempt.lock'),'wx'));
  writeFileSync(receiptPath,JSON.stringify({status:'STARTED',projectRef:target.projectRef}));
  const passwords=Object.fromEntries(Object.keys(SCHOOL_DAY_EMAILS).map(key=>[key,randomBytes(24).toString('base64url')]));
  // Allowlist operating-system plumbing, rather than inherit any integration key.
  const systemEnv=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
  const childEnv={...systemEnv,NODE_ENV:'production',SYNTHETIC_PREVIEW_SEED:'1',PREVIEW_SUPABASE_PROJECT_REF:target.projectRef,PREVIEW_PINNED_PROJECT_REF:target.projectRef,PREVIEW_DB_ROLE:'preview_app',PREVIEW_DB_PASSWORD:env.PREVIEW_DB_PASSWORD,DATABASE_URL:target.databaseUrl,DIRECT_URL:target.directUrl,G4_SYNTHETIC_PASSWORDS:JSON.stringify(passwords)};
  const {PrismaClient}=require('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:target.directUrl}}});
  try{
    const identity=await db.$queryRawUnsafe('SELECT current_database() AS database, current_user AS username, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser');
    if(identity.length!==1||identity[0].database!=='postgres'||identity[0].username!=='preview_app'||identity[0].superuser!==false)safeError('preview_restricted_role_identity_failed');
    const tables=await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
    if(tables[0]?.count!==0)safeError('preview_initial_database_not_empty');
  }finally{await db.$disconnect();}
  // Prisma 6.19 has no db-push --url option. Both datasource variables are pinned
  // to the validated DIRECT URL for this child only; the config cannot load dotenv.
  const schema=spawnSync(process.execPath,[resolve(root,'node_modules/prisma/build/index.js'),'db','push','--config','scripts/preview/prisma-preview.config.ts','--skip-generate'],{cwd:root,env:{...childEnv,DATABASE_URL:target.directUrl,DIRECT_URL:target.directUrl},encoding:'utf8',windowsHide:true});
  if(schema.error||schema.status!==0){
    const prismaCode=(schema.stderr||'').match(/\bP\d{4}\b/)?.[0]||null;
    writeFileSync(receiptPath,JSON.stringify({status:'SCHEMA_FAILED',projectRef:target.projectRef,exitCode:schema.status,prismaCode}));
    safeError('preview_schema_push_failed');
  }
  const seeded=spawnSync(process.execPath,['--max-old-space-size=512','scripts/e2e/run-seed-school-day.cjs'],{cwd:root,env:childEnv,encoding:'utf8',windowsHide:true});
  if(seeded.error||seeded.status!==0){writeFileSync(receiptPath,JSON.stringify({status:'SEED_FAILED',projectRef:target.projectRef,exitCode:seeded.status}));safeError('preview_synthetic_seed_failed');}
  // The seed emits IDs and known package hashes only; don't forward arbitrary child output.
  let emitted;
  try{emitted=JSON.parse(seeded.stdout.trim().split(/\r?\n/).at(-1));}catch{safeError('preview_seed_receipt_invalid');}
  for(const [key,id] of Object.entries(SCHOOL_DAY_IDS))if(emitted[key]!==id)safeError('preview_seed_receipt_identity_mismatch');
  const ids={...SCHOOL_DAY_IDS}; // Never persist arbitrary child output or credential material.
  const verify=new PrismaClient({datasources:{db:{url:target.directUrl}}});
  let counts;
  try{
    counts={schools:await verify.school.count(),users:await verify.user.count(),students:await verify.student.count(),classes:await verify.class.count(),periods:await verify.timetable.count(),assignments:await verify.assignment.count(),attendance:await verify.attendance.count(),grades:await verify.grade.count(),mastery:await verify.masteryRecord.count()};
    if(counts.schools!==2||counts.users!==7||counts.students!==3||counts.classes!==1||counts.periods!==8||counts.assignments!==1||counts.attendance!==1||counts.grades!==0||counts.mastery!==0)safeError('preview_fixture_cardinality_failed');
    const reviewers=await verify.user.findMany({where:{id:{in:[SCHOOL_DAY_IDS.studentUser,SCHOOL_DAY_IDS.teacher,SCHOOL_DAY_IDS.admin]}},select:{id:true,role:true,schoolId:true,isPlatformAdmin:true,hashedPwd:true}});
    assertReviewerAccounts(reviewers);
    if(await verify.user.count({where:{isPlatformAdmin:true,hashedPwd:{not:null}}})!==0)safeError('preview_platform_password_refused');
  }finally{await verify.$disconnect();}
  const receipt={status:'COMPLETE',projectRef:target.projectRef,credentialScope:PREVIEW_CREDENTIAL_SCOPE,restrictedRoleVerified:true,syntheticOnly:true,counts,ids,publication:false,productionMutation:false};
  writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:receipt.status,counts,ids}));
  // Not stdout/stderr, files, logs, prompts or artifacts: the operator sees these once.
  writeFileSync(operatorFd,'\r\nSYNTHETIC PREVIEW LOGINS ONLY. Shown once; do not paste into agent messages or logs.\r\n');
  writeReviewerCredentials(line=>writeFileSync(operatorFd,line),passwords);
  const consoleOutput=createWriteStream('',{fd:operatorFd,autoClose:false});
  const prompt=createInterface({input:process.stdin,output:consoleOutput});
  await new Promise(done=>prompt.question('\r\nPress Enter after recording the synthetic logins privately. ',()=>{prompt.close();done();}));
}
main().catch(error=>{
  const code=error instanceof Error&&/^preview_[a-z_]+$/.test(error.message)?error.message:'preview_setup_failed';
  if(existsSync(receiptPath)){
    const prior=JSON.parse(readFileSync(receiptPath,'utf8'));
    if(prior.status!=='COMPLETE')writeFileSync(receiptPath,JSON.stringify({...prior,status:'FAILED',code},null,2)+'\n');
  }
  console.error(code);process.exitCode=1;
});
