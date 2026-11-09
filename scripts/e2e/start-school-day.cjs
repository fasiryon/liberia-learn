// No dotenv loading: production/shared credentials must never override the CI fixture.
const {spawn}=require('node:child_process');
const {cpSync,existsSync,mkdirSync}=require('node:fs');
const path=require('node:path');
if(process.env.CI!=='true'||process.env.E2E_SYNTHETIC!=='1'||process.env.VERCEL_ENV||process.env.VERCEL)
  throw Error('school_day_server_requires_disposable_ci');
const target=new URL(process.env.DATABASE_URL||'');
if(target.protocol!=='postgresql:'||!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/e2e'||(target.port||'5432')!=='5432'||target.username!=='postgres'||target.password!=='postgres'||target.search||target.hash||process.env.DIRECT_URL&&process.env.DIRECT_URL!==process.env.DATABASE_URL)
  throw Error('school_day_server_database_not_disposable');
const root=process.cwd(),standalone=path.join(root,'.next/standalone');
mkdirSync(path.join(standalone,'.next'),{recursive:true});
for(const [from,to] of [['.next/static','.next/static'],['public','public']])
  if(existsSync(path.join(root,from)))cpSync(path.join(root,from),path.join(standalone,to),{recursive:true});
const guard=path.join(root,'scripts/e2e/block-school-day-egress.cjs');
const child=spawn(process.execPath,['--require',guard,path.join(standalone,'server.js')],{cwd:root,stdio:'inherit',env:{...process.env,__NEXT_PROCESSED_ENV:'true',PORT:'3100',HOSTNAME:'127.0.0.1',NEXTAUTH_URL:'http://127.0.0.1:3100',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:''}});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
