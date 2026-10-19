import {spawn} from 'node:child_process';import fs from 'node:fs';import net from 'node:net';import assert from 'node:assert/strict';
const out='artifacts/joint-repairs';
const env={...process.env,NODE_ENV:'production',PORT:'3218',HOSTNAME:'127.0.0.1',PLAYWRIGHT_BASE_URL:'http://127.0.0.1:3218',DATABASE_URL:'postgresql://review:review@127.0.0.1:1/review',DIRECT_URL:'postgresql://review:review@127.0.0.1:1/review',NEXTAUTH_SECRET:'local-joint-review-only',NEXTAUTH_URL:'http://127.0.0.1:3218',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:''};
assert(fs.existsSync('.next/standalone/server.js'),'Complete standalone build required');
// Refuse an occupied port and verify the exact build below, so another local
// worktree's server cannot accidentally satisfy this validation.
const portProbe=net.createServer();
await new Promise((resolve,reject)=>{portProbe.once('error',reject);portProbe.listen(3218,'127.0.0.1',resolve);});
await new Promise(resolve=>portProbe.close(resolve));
fs.cpSync('.next/static','.next/standalone/.next/static',{recursive:true,force:true});fs.cpSync('public','.next/standalone/public',{recursive:true,force:true});
const log=fs.openSync(`${out}/pwa-server.log`,'w');const server=spawn(process.execPath,['.next/standalone/server.js'],{env,windowsHide:true,stdio:['ignore',log,log]});
try{let ready=false;for(let i=0;i<45;i++){try{await fetch('http://127.0.0.1:3218/offline',{signal:AbortSignal.timeout(1000)});ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}assert(ready,'Local standalone server ready');
assert.equal(server.exitCode,null,'The newly launched standalone process must still be running');
const buildId=fs.readFileSync('.next/BUILD_ID','utf8').trim();
const manifestPath=`/_next/static/${buildId}/_buildManifest.js`;
const manifest=await fetch(`http://127.0.0.1:3218${manifestPath}`);
assert.equal(manifest.status,200,'Exact local build manifest must be served');
assert.equal(await manifest.text(),fs.readFileSync(`.next/static/${buildId}/_buildManifest.js`,'utf8'),'Standalone server must serve this build, not another worktree');
const protectedPaths=['/student/today','/student/learn','/student/ai-tutor','/student/textbooks','/student/textbooks/test','/student/lesson/test','/student/lessons/test','/student/progress','/student/labs','/lab-review/experience/cv2-cand-g7-math-number-sense-place-value','/lab-review/experience/cv2-cand-g7-literacy-essay-structure-argument','/design-preview/lessons','/curriculum-candidates/g7-native-v1/math-place-value-chart.svg'];const smoke=[];
for(const path of protectedPaths){const r=await fetch(`http://127.0.0.1:3218${path}`,{redirect:'manual'});smoke.push({path,status:r.status,location:r.headers.get('location')});assert([302,303,307,308,401,403,404].includes(r.status),'Anonymous boundary: '+path);}
const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const {encode}=require('next-auth/jwt');const synthetic=await encode({secret:env.NEXTAUTH_SECRET,token:{sub:'local-review-synthetic-user',id:'local-review-synthetic-user',role:'STUDENT',schoolId:'local-review-synthetic-school',mustChangePIN:false},maxAge:60});
for(const path of ['/curriculum-candidates/g7-native-v1/math-place-value-chart.svg','/lab-review/experience/cv2-cand-g7-math-number-sense-place-value','/design-preview/lessons']){const r=await fetch(`http://127.0.0.1:3218${path}`,{redirect:'manual',headers:{cookie:`next-auth.session-token=${synthetic}`}});smoke.push({path,status:r.status,syntheticLocalMiddlewareToken:true,contentType:r.headers.get('content-type')});assert.equal(r.status,404,'Unreleased candidate/preview boundary: '+path);}
fs.writeFileSync(`${out}/production-boundary-smoke.json`,JSON.stringify({buildId,exactBuildManifestVerified:true,scope:'Local production-mode build: anonymous boundaries plus a synthetic locally signed middleware token for static assets and preview guards. No registered student session or school database exercised.',smoke},null,2));
const tests=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','e2e/p5c-pwa-lifecycle.spec.ts','e2e/p5e-offline-hardening.spec.ts'],{env,windowsHide:true,stdio:'inherit'});const exit=await new Promise(r=>tests.on('exit',r));console.log('PWA exit',exit);process.exitCode=Number(exit??1);
}finally{server.kill();fs.closeSync(log);}
