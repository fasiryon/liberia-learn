/** Offline, exact-config validation. Never connects, rewrites a file or outputs a URL. */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {validatePreviewTarget,previewOperatorEnvironment} from './preview-target.mjs';
try{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--credentials-file')throw Error();
  const file=resolve(args[1]);
  if(spawnSync('git',['-C',dirname(file),'check-ignore','--quiet','--',file],{stdio:'ignore'}).status!==0)throw Error();
  const configured=parseEnv(readFileSync(file,'utf8'));
  validatePreviewTarget(previewOperatorEnvironment(configured));
  console.log('preview_exact_config_valid');
}catch{console.error('preview_database_target_refused');process.exitCode=1;}
