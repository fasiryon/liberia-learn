// Local build/dev launcher. Pass only workstation variables and dummy loopback configuration.
const fs=require('fs'),cp=require('child_process'),path=require('path');
const dependencyRoot=path.resolve('node_modules');
if(fs.lstatSync(dependencyRoot).isSymbolicLink()||fs.realpathSync(dependencyRoot)!==dependencyRoot)throw Error('private_dependencies_required');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SystemRoot|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramFiles|ProgramFiles\(x86\)|ProgramData|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(key)));
Object.assign(env,{
 DATABASE_URL:'postgresql://validation:validation@127.0.0.1:1/validation',
 DIRECT_URL:'postgresql://validation:validation@127.0.0.1:1/validation',
 SHADOW_DATABASE_URL:'postgresql://validation:validation@127.0.0.1:1/validation',
 NEXTAUTH_SECRET:'local-candidate-validation-only-2026',NEXTAUTH_URL:'http://localhost:3027',
 NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--max-old-space-size=8192',
});
const mode=process.argv[2]||'build';
if(mode==='dev')Object.assign(env,{LAB_REVIEW_HARNESS:'1'});
const args=mode==='build'?['/d','/c','npm.cmd run build']:mode==='dev'?['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3027']:mode==='types'?['node_modules/typescript/bin/tsc','--noEmit']:null;
if(!args)throw Error('unknown_validation_mode');
const result=cp.spawnSync(mode==='build'?'cmd.exe':process.execPath,args,{env,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
