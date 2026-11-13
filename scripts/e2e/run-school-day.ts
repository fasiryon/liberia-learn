/** One private-suite entry point. No credential files or persisted browser traces. */
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SCHOOL_DAY_EMAILS,requireSyntheticSchoolDayDatabase} from './school-day-contract';
import {redactSyntheticSecrets} from './secret-output';
requireSyntheticSchoolDayDatabase(process.env);
const passwords=Object.fromEntries(Object.keys(SCHOOL_DAY_EMAILS).map(key=>[key,randomBytes(24).toString('base64url')]));
// Masking workflow commands can themselves enter raw tee artifacts. Emit none.
// Redact child output BEFORE it reaches any workflow logger or artifact writer.
const redact=(text:string)=>redactSyntheticSecrets(text,Object.values(passwords));
const env={...process.env,DEBUG:'',PWDEBUG:'',SYNTHETIC_PREVIEW_SEED:'0',G4_SYNTHETIC_PASSWORDS:JSON.stringify(passwords)};
function run(argv:string[]){
  const result=spawnSync(process.execPath,['--max-old-space-size=512',...argv],{env,encoding:'utf8',maxBuffer:20*1024*1024});
  if(result.stdout)process.stdout.write(redact(result.stdout));
  if(result.stderr)process.stderr.write(redact(result.stderr));
  if(result.error||result.status!==0)process.exit(result.status||1);
}
// Repeating the same fixture must preserve IDs and row cardinalities. The browser checks them.
run(['--import','tsx','scripts/e2e/seed-school-day.ts']);
run(['--import','tsx','scripts/e2e/seed-school-day.ts']);
run(['node_modules/@playwright/test/cli.js','test','e2e/g4-school-day.spec.ts','--project=chromium']);
