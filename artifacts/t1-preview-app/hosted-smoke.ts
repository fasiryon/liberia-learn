/**
 * Hosted Preview smoke runner (T1, 2026-11-02). PREPARED ONLY: do not run until CoS holds founder authorization A3
 * for the exact deployment. Read-only; synthetic approved accounts only (student, teacher, school admin, optional
 * foreign teacher; never the platform-admin authority).
 *
 *   node --import tsx artifacts/t1-preview-app/hosted-smoke.ts --plan
 *   vc env run -- node --import tsx artifacts/t1-preview-app/hosted-smoke.ts \
 *     --deployment-url https://<deployment>.vercel.app --authorization A3-<id> --expect-source-sha <40 hex> [--browser] [--forbid <text>]...
 *
 * Access through Vercel Authentication uses only the short-lived OIDC trusted-source header from `vc env run`, sent to
 * the deployment origin only. Never `vercel curl`: it creates a project automation-bypass secret when none exists.
 * Student, teacher and school-admin passwords are required (an empty answer aborts); the foreign teacher is optional.
 * Exit 0 only for acceptance verdict PASS; FAIL or INCOMPLETE (a required check missing or skipped) exit 1.
 * Passwords come only from a hidden interactive prompt; they and session cookies stay in this process (no child
 * process, argv, env, files or logs). Output is PASS/FAIL/SKIP/LIMITATION per check with fixed codes; no bodies.
 */
import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import {APPROVED_ROLES,BROWSER_WIDTHS,EMAILS,PACKAGES,PRODUCTION_SUPABASE_REF,REQUIRED_ROLES,Smoke,summarize,validateDeploymentUrl,
  type CheckResult,type Http,type HttpResponse,type Passwords,type Role} from './hosted-smoke-lib';

type Args={plan:boolean;url?:string;authorization?:string;sha?:string;browser:boolean;forbid:string[]};

export function parseArgs(argv:string[]):Args{
  const args:Args={plan:false,browser:false,forbid:[PRODUCTION_SUPABASE_REF]};
  for(let i=0;i<argv.length;i++){
    const a=argv[i],next=()=>{const v=argv[++i];if(v===undefined||v.startsWith('--'))throw Error(`smoke_missing_value:${a}`);return v;};
    if(a==='--plan')args.plan=true;else if(a==='--browser')args.browser=true;
    else if(a==='--deployment-url')args.url=next();else if(a==='--authorization')args.authorization=next();
    else if(a==='--expect-source-sha')args.sha=next();else if(a==='--forbid')args.forbid.push(next());
    else throw Error('smoke_unknown_argument');
  }
  return args;
}

/** Refuses before any network or prompt unless the run is explicitly authorized, interactive and well-formed. */
export function preflight(args:Args,io:{stdinTTY:boolean;stdoutTTY:boolean;env:Record<string,string|undefined>}){
  if(io.env.CI||io.env.GITHUB_ACTIONS)throw Error('smoke_refuses_ci');
  if(!io.stdinTTY||!io.stdoutTTY)throw Error('smoke_requires_interactive_console');
  if(!args.authorization||!/^A3-[A-Za-z0-9_-]{3,64}$/.test(args.authorization))throw Error('smoke_requires_A3_authorization_reference');
  if(!args.sha||!/^[0-9a-f]{40}$/.test(args.sha))throw Error('smoke_requires_expected_source_sha');
  const origin=validateDeploymentUrl(args.url??'');
  if(!io.env.VERCEL_OIDC_TOKEN)throw Error('smoke_requires_vc_env_run_oidc');
  return origin;
}

type FetchLike=(url:string,init:{method:string;headers:Record<string,string>;body?:string;redirect:'manual'})=>Promise<Response>;
/** In-process transport. The OIDC header goes to the deployment origin only; plain requests carry no header or cookie. */
export function oidcFetchTransport(origin:string,token:string,fetchImpl:FetchLike=(url,init)=>fetch(url,init)):Http{
  return async request=>{
    const plain=request.base==='plain';
    const headers:Record<string,string>=plain?{}:{...(request.headers??{}),'x-vercel-trusted-oidc-idp-token':token};
    let body:string|undefined;
    if(!plain&&request.form){body=new URLSearchParams(request.form).toString();headers['Content-Type']='application/x-www-form-urlencoded';}
    const r=await fetchImpl(origin+request.path,{method:request.method,headers,body,redirect:'manual'});
    const out:HttpResponse['headers']={};
    r.headers.forEach((v,k)=>{if(k!=='set-cookie')(out[k]??=[]).push(v);});
    const cookies=r.headers.getSetCookie?.()??[];
    if(cookies.length)out['set-cookie']=cookies;
    return {status:r.status,headers:out,body:await r.text()};
  };
}

/** A required role's empty or blank answer aborts the run; only the optional foreign teacher may be skipped. */
export function acceptPromptAnswer(role:Role,answer:string):string|undefined{
  if(answer.trim())return answer;
  if(REQUIRED_ROLES.includes(role))throw Error(`smoke_required_credential_missing:${role}`);
  return undefined;
}

/** Hidden prompt: echoes nothing. */
async function askHidden(question:string){
  let muted=false;
  const out=new Writable({write(chunk,_e,cb){if(!muted)process.stdout.write(chunk);cb();}});
  const rl=createInterface({input:process.stdin,output:out,terminal:true});
  process.stdout.write(question);muted=true;
  const answer=await new Promise<string>(done=>rl.question('',done));
  muted=false;rl.close();process.stdout.write('\n');
  return answer;
}

async function browserChecks(origin:string,password:string,token:string):Promise<CheckResult[]>{
  const results:CheckResult[]=[];
  const {chromium}=await import('@playwright/test');
  const {assertKeyboardReach}=await import('../../e2e/school-day-keyboard');
  const browser=await chromium.launch();
  try{
    for(const width of BROWSER_WIDTHS){
      const context=await browser.newContext({viewport:{width,height:900}});
      const external:string[]=[];
      // The Vercel trusted-source header goes only to the deployment origin.
      await context.route('**/*',route=>{const u=new URL(route.request().url());
        if(u.origin===origin)return route.continue({headers:{...route.request().headers(),'x-vercel-trusted-oidc-idp-token':token}});
        if(['http:','https:'].includes(u.protocol))external.push(u.hostname);return route.abort();});
      const page=await context.newPage();
      const info={attach:async()=>undefined};
      try{
        await page.goto(origin+'/login?role=student');
        await page.getByPlaceholder('student@school.lr',{exact:true}).fill(EMAILS.student);
        const field=page.locator('form input[type=password]');await field.fill(password);
        await Promise.all([page.waitForURL(u=>!u.pathname.startsWith('/login')),page.locator('form button[type=submit]').click()]);
        await field.fill('').catch(()=>undefined);
        await page.goto(origin+'/learn/day');
        const slots=page.locator('nav[aria-label="Today\'s schedule"] [data-slot]');
        const count=await slots.count();
        let bound=count===8;
        for(const [i,pkg] of PACKAGES.entries()){if(!bound)break;
          await slots.nth(i).click();
          const b=page.locator('[data-day-lesson]');
          bound=await b.getAttribute('data-day-lesson')===pkg.selection&&await b.getAttribute('data-package-hash')===pkg.hash&&
            await b.locator('[data-day-open]').getAttribute('href')===`/learn/preview/${encodeURIComponent(pkg.selection)}`;
        }
        results.push({id:`DAY_EIGHT_EXACT_LINKS:${width}`,status:bound?'PASS':'FAIL',code:count===8?'checked':`slots_${count}`});
        await page.goto(origin+'/learn/day');
        await assertKeyboardReach(page,slots.first(),info,`day-slot-${width}`);await page.keyboard.press('Enter');
        await assertKeyboardReach(page,page.locator('[data-day-open]'),info,`day-open-${width}`);await page.keyboard.press('Enter');
        await page.locator('[data-lesson-player-v2]').waitFor();
        const next=page.getByRole('button',{name:'Continue',exact:true});
        await assertKeyboardReach(page,next,info,`lesson-continue-${width}`);
        results.push({id:`KEYBOARD_DAY_TO_LESSON:${width}`,status:'PASS',code:'arrival_exit_return'});
      }catch(error){
        const code=error instanceof Error&&/^school_day_keyboard_[a-z_]+$/.test(error.message)?error.message:'browser_step_failed';
        results.push({id:`KEYBOARD_DAY_TO_LESSON:${width}`,status:'FAIL',code});
      }finally{
        results.push({id:`NO_EXTERNAL_BROWSER_REQUESTS:${width}`,status:external.length?'FAIL':'PASS',code:external.length?`external_${external.length}`:'none'});
        await context.close();
      }
    }
  }finally{await browser.close();}
  return results;
}

export const PLAN=['SSO_WALL_UNAUTHENTICATED','OIDC_TRUSTED_SOURCE','LOGIN_RENDERS','CSP_NONCE_NO_EVAL','SECURITY_HEADERS','CREDENTIALS_ONLY_PROVIDER',
  'NO_EXTERNAL_OAUTH_REDIRECT','ANONYMOUS_SESSION_EMPTY','CRON_REFUSED:*','DEV_SURFACE_ABSENT:*','SIGN_IN:<role>','SESSION_COOKIE_FLAGS:<role>',
  'SESSION_ABSOLUTE_BOUND:<role>','STUDENT_SESSION_SCOPE','STUDENT_DAY_RENDERS','PACKAGE_IDENTITY:P1..P8','PLAYER_RENDERS:P1..P8','PREVIEW_API_READ_ONLY',
  'STUDENT_DENIED_*','TEACHER_ALLOWED:*','TEACHER_UNKNOWN_LEARNER_404','TEACHER_DENIED_*','ADMIN_ALLOWED:*','IDENTITY_PROVISIONING_FROZEN','ADMIN_DENIED_*','CRON_REFUSED_WITH_SESSION',
  'CROSS_SCHOOL_ADVISORY_404','CROSS_SCHOOL_ATTENDANCE_403','LOGOUT_CLEARS_COOKIE:<role>','LOGOUT_SESSION_EMPTY:<role>','LOGOUT_COPIED_COOKIE:<role>',
  'SMOKE_SENT_NO_WRITES','NO_PRODUCTION_IDENTIFIERS','[--browser] DAY_EIGHT_EXACT_LINKS:<w>','KEYBOARD_DAY_TO_LESSON:<w>','NO_EXTERNAL_BROWSER_REQUESTS:<w>'];

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.plan){for(const id of PLAN)console.log(id);console.log('Operator follow-up (not HTTP): T2 setup cardinality/academic-record recount after the run.');return;}
  const origin=preflight(args,{stdinTTY:!!process.stdin.isTTY,stdoutTTY:!!process.stdout.isTTY,env:process.env});
  const http=oidcFetchTransport(origin,process.env.VERCEL_OIDC_TOKEN!);
  // Prove trusted-source access reaches the app before any secret is typed; never fall back to a bypass secret.
  const probe=await http({method:'GET',path:'/login'}).catch(()=>null);
  const admitted=probe?.status===200;
  console.log(`${admitted?'PASS':'FAIL'} OIDC_TRUSTED_SOURCE ${admitted?'admitted':`status_${probe?.status??'error'}_abort`}`);
  if(!admitted){process.exitCode=1;return;}
  const passwords:Passwords={};
  for(const role of APPROVED_ROLES){
    const answer=acceptPromptAnswer(role,await askHidden(`Synthetic ${role} password (${REQUIRED_ROLES.includes(role)?'required':'Enter to skip'}): `));
    if(answer)passwords[role as Role]=answer;
  }
  const smoke=new Smoke(http,args.forbid);
  const results=await smoke.run(passwords);
  if(args.browser)results.push(...await browserChecks(origin,passwords.student,process.env.VERCEL_OIDC_TOKEN!));
  for(const key of Object.keys(passwords))delete passwords[key as Role];
  for(const r of results)console.log(`${r.status} ${r.id} ${r.code}`);
  // Acceptance: PASS only when every required check (browser checks too when requested) is present with PASS.
  const summary=summarize(results,{browser:args.browser});
  console.log(JSON.stringify({deployment:origin,authorization:args.authorization,expectedSourceSha:args.sha,...summary}));
  process.exitCode=summary.verdict==='PASS'?0:1;
}
if(process.argv[1]&&/hosted-smoke\.ts$/.test(process.argv[1]))main().catch(error=>{
  console.error(error instanceof Error&&/^smoke_[a-z0-9_:A-Z-]+$/.test(error.message)?error.message:'smoke_failed');process.exitCode=1;
});
