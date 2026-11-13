/** Operator-only read-only catalog check. No setup, migrations or account provisioning. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validatePreviewTarget,previewOperatorEnvironment} from './preview-target.mjs';
import {collectDatabaseMetadata,evaluateDatabasePreflight,repositoryDatabaseContract,DATABASE_POLICY_VERSION} from './database-preflight.mjs';
async function main(){
  const args=process.argv.slice(2),options={};
  let operator=false;
  for(let i=0;i<args.length;i++){
    const key=args[i];
    if(key==='--operator-console'&&!operator){operator=true;continue;}
    if(!['--credentials-file','--policy-file','--policy-sha256'].includes(key)||options[key]||!args[i+1]||args[i+1].startsWith('--'))throw Error();
    options[key]=args[++i];
  }
  if(Object.keys(options).length!==3||!operator||process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY)throw Error();
  const file=resolve(options['--credentials-file']);
  if(spawnSync('git',['-C',dirname(file),'check-ignore','--quiet','--',file],{stdio:'ignore'}).status!==0)throw Error();
  const loaded=parseEnv(readFileSync(file,'utf8'));
  const env=previewOperatorEnvironment(loaded);
  const target=validatePreviewTarget(env),bytes=readFileSync(resolve(options['--policy-file']));
  if(!/^[a-f0-9]{64}$/.test(options['--policy-sha256'])||createHash('sha256').update(bytes).digest('hex')!==options['--policy-sha256'])throw Error();
  const direct=new URL(target.directUrl),poolerUser=/^preview_app\.([a-z]{20})$/.exec(decodeURIComponent(direct.username));
  const policy=JSON.parse(bytes),context={...repositoryDatabaseContract(),projectRef:target.projectRef,endpointHost:direct.hostname,endpointProjectRef:poolerUser?poolerUser[1]:null};
  if(policy.status!=='ACCEPTED'||policy.version!==DATABASE_POLICY_VERSION)throw Error();
  const require=createRequire(import.meta.url),{PrismaClient}=require('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:target.directUrl}},log:[]});
  try{
    // The pin is re-read from the operator environment (execution env, not the credentials file) inside the evaluator.
    const result=evaluateDatabasePreflight(await collectDatabaseMetadata(db),policy,context,env);
    console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
  }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('preview_preflight_refused');process.exitCode=1;});
