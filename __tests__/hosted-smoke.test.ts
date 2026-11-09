/**
 * Synthetic tests for the prepared hosted smoke suite (artifacts/t1-preview-app). A simulated Preview stands in for
 * the host; nothing here touches a network. Failure variants prove each check can fail.
 */
import {describe,expect,it} from 'vitest';
import {CookieJar,EMAILS,IDS,PACKAGES,Smoke,summarize,validateDeploymentUrl,type HttpRequest,type HttpResponse,type Passwords} from '@/artifacts/t1-preview-app/hosted-smoke-lib';
import {parseArgs,preflight} from '@/artifacts/t1-preview-app/hosted-smoke';

const NOW=Date.parse('2026-11-12T10:00:00Z');
const PASSWORDS:Passwords={student:'synthetic-pw-student-"\\x',teacher:'synthetic-pw-teacher',admin:'synthetic-pw-admin',foreignTeacher:'synthetic-pw-foreign'};
type Faults=Partial<{openSso:boolean;leak:boolean;wrongHashP6:boolean;google:boolean;cronOpen:boolean;longCookie:boolean;emptyDay:boolean;foreignSees:boolean;studentAdmin:boolean;revokes:boolean;identityOpen:boolean}>;
const ok=(body:unknown,headers:Record<string,string[]>={}):HttpResponse=>({status:200,headers:{'content-type':['application/json'],...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const status=(code:number,location?:string):HttpResponse=>({status:code,headers:location?{location:[location]}:{},body:''});

function fakePreview(f:Faults={},seen:{emails:string[]}={emails:[]}){
  const roleOf=(req:HttpRequest)=>/next-auth\.session-token=tok-(\w+)/.exec(req.headers?.Cookie??'')?.[1] as keyof typeof EMAILS|undefined;
  return async(req:HttpRequest):Promise<HttpResponse>=>{
    const [path,query='']=req.path.split('?');const role=roleOf(req);
    if(req.base==='plain')return f.openSso?ok('<main data-day-source>'):status(302,'https://vercel.com/sso-api?url=x');
    if(path==='/login')return ok('<form>',{'content-security-policy':["default-src 'self'; script-src 'self' 'nonce-abc123'"],'strict-transport-security':['max-age=63072000'],
      'x-frame-options':['DENY'],'x-content-type-options':['nosniff'],'referrer-policy':['strict-origin-when-cross-origin']});
    if(path==='/api/auth/providers')return ok(f.google?{credentials:{},google:{}}:{credentials:{}});
    if(path==='/api/auth/signin/google')return status(302,'/api/auth/signin?error=OAuthSignin');
    if(path==='/api/auth/csrf')return ok({csrfToken:'csrf'},{'set-cookie':['__Host-next-auth.csrf-token=c; Path=/; HttpOnly; Secure; SameSite=Lax']});
    if(path==='/api/auth/callback/credentials'){
      const entry=Object.entries(EMAILS).find(([,email])=>email===req.form?.email);seen.emails.push(String(req.form?.email));
      const who=entry?.[0] as keyof typeof PASSWORDS|undefined;
      if(!who||PASSWORDS[who]!==req.form?.password)return ok({url:'https://d.vercel.app/api/auth/error?error=CredentialsSignin'});
      const expires=new Date(NOW+(f.longCookie?30*86400:8*3600)*1000).toUTCString();
      return ok({url:'https://d.vercel.app/'},{'set-cookie':[`__Secure-next-auth.session-token=tok-${who}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`]});
    }
    if(path==='/api/auth/signout')return ok({url:'/login'},{'set-cookie':['__Secure-next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']});
    if(path==='/api/auth/session')return ok(role&&!f.revokes?{user:{role:role==='admin'?'ADMIN':role==='student'?'STUDENT':'TEACHER',schoolId:role==='foreignTeacher'?IDS.foreignSchool:IDS.school}}:f.revokes&&role?{}:{});
    if(path.startsWith('/api/cron'))return f.cronOpen?ok({}):status(401);
    if(['/lab-review','/curriculum-candidates/x.svg','/design-preview'].includes(path))return status(404);
    if(path==='/learn/day')return role==='student'?ok(f.emptyDay?'<main data-day-empty="">':'<main data-day-source="PILOT_TIMETABLE">'+(f.leak?'bnphuinpvgpmebcsvmsp':'')):status(404);
    if(path.startsWith('/api/student/learning-preview/')){
      if(req.method!=='GET')return status(405);
      const selection=decodeURIComponent(path.slice('/api/student/learning-preview/'.length));
      const i=PACKAGES.findIndex(p=>p.selection===selection);
      return role==='student'&&i>=0?ok({status:'PILOT_ONLY',identity:{selection,packageHash:f.wrongHashP6&&i===5?'0'.repeat(64):PACKAGES[i].hash}},{'cache-control':['private, no-store, max-age=0']}):status(404);
    }
    if(path.startsWith('/learn/preview/')){const p=PACKAGES.find(x=>`/learn/preview/${encodeURIComponent(x.selection)}`===path);return role==='student'&&p?ok(`<div data-hash="${p.hash}">`):status(404);}
    if(path==='/teacher/schedule')return role==='teacher'?ok('<main>'):status(307,'/learn');
    if(path==='/api/teacher/schedule')return role==='teacher'?ok([]):status(403);
    if(path==='/api/teacher/learning-authority/grade4-math/misconceptions')return role==='teacher'&&query.includes(IDS.student)?ok({}):role==='foreignTeacher'&&f.foreignSees?ok({}):status(404);
    if(path==='/api/teacher/attendance')return role==='foreignTeacher'?status(403):ok([]);
    if(path==='/admin')return role==='admin'||(f.studentAdmin&&role==='student')?ok('<main>'):status(307,'/unauthorized');
    if(path.startsWith('/api/admin/import/batches/'))return f.identityOpen&&role==='admin'?ok('csv'):{status:403,headers:{'content-type':['application/json']},body:JSON.stringify({code:'PREVIEW_IDENTITY_FROZEN'})};
    if(path.startsWith('/api/admin/'))return role==='admin'?ok([]):status(403);
    if(path==='/platform')return status(307,'/unauthorized');
    return status(404);
  };
}
const run=async(f:Faults={},passwords=PASSWORDS)=>{const seen={emails:[] as string[]};const smoke=new Smoke(fakePreview(f,seen),undefined,()=>NOW);const results=await smoke.run(passwords);return {results,smoke,seen};};
const failed=(results:{id:string;status:string;code:string}[])=>results.filter(r=>r.status==='FAIL').map(r=>`${r.id} ${r.code}`);

describe('healthy synthetic Preview',()=>{
  it('passes every check; the copied-cookie replay is reported as a limitation, not a pass',async()=>{
    const {results}=await run();
    expect(failed(results)).toEqual([]);
    expect(results.filter(r=>r.status==='LIMITATION').map(r=>r.id).sort()).toEqual(['LOGOUT_COPIED_COOKIE:admin','LOGOUT_COPIED_COOKIE:foreignTeacher','LOGOUT_COPIED_COOKIE:student','LOGOUT_COPIED_COOKIE:teacher']);
    expect(results.filter(r=>r.id.startsWith('PACKAGE_IDENTITY:')&&r.status==='PASS')).toHaveLength(8);
    expect(summarize(results).ok).toBe(true);
  });
  it('a deployment with server-side revocation turns the replay into a PASS',async()=>{
    const {results}=await run({revokes:true});
    expect(results.filter(r=>r.id.startsWith('LOGOUT_COPIED_COOKIE')).every(r=>r.status==='PASS')).toBe(true);
  });
  it('never signs in as the platform-admin authority or the extra students',async()=>{
    const {seen,smoke}=await run();
    expect(seen.emails).not.toContain(EMAILS.authority);expect(seen.emails).not.toContain(EMAILS.student2);
    await expect(smoke.signIn('authority' as never,'x')).rejects.toThrow('smoke_unapproved_account');
  });
  it('sends only GETs plus the sign-in/sign-out POSTs and one 405 method probe',async()=>{
    const {smoke,results}=await run();
    expect(new Set(smoke.log.filter(r=>r.method!=='GET').map(r=>r.path)).size).toBe(3);
    expect(results.find(r=>r.id==='SMOKE_SENT_NO_WRITES')?.status).toBe('PASS');
  });
  it('results never carry a password, cookie value or response body',async()=>{
    const text=JSON.stringify((await run({leak:true})).results);
    for(const secret of [...Object.values(PASSWORDS),'tok-student','csrf','data-day-source'])expect(text).not.toContain(secret);
  });
  it('without the optional foreign-teacher credential, cross-school denial is SKIP (K2), not PASS',async()=>{
    const {results}=await run({},{...PASSWORDS,foreignTeacher:undefined});
    expect(results.find(r=>r.id==='CROSS_SCHOOL_DENIAL')).toMatchObject({status:'SKIP',code:'no_foreign_credential_k2'});
  });
});

describe('each failure is detected',()=>{
  it.each([
    ['open deployment (no SSO wall)',{openSso:true},'SSO_WALL_UNAUTHENTICATED'],
    ['Production identifier in a response',{leak:true},'NO_PRODUCTION_IDENTIFIERS'],
    ['wrong P6 package hash',{wrongHashP6:true},'PACKAGE_IDENTITY:P6'],
    ['OAuth provider registered',{google:true},'CREDENTIALS_ONLY_PROVIDER'],
    ['cron runs',{cronOpen:true},'CRON_REFUSED:/api/cron/agents/tick'],
    ['30-day session (PV-06 absent)',{longCookie:true},'SESSION_ABSOLUTE_BOUND:student'],
    ['empty day (PV-05)',{emptyDay:true},'STUDENT_DAY_RENDERS'],
    ['foreign teacher sees the learner',{foreignSees:true},'CROSS_SCHOOL_ADVISORY_404'],
    ['student reaches the admin portal',{studentAdmin:true},'STUDENT_DENIED_ADMIN_PORTAL'],
    ['account provisioning not frozen',{identityOpen:true},'IDENTITY_PROVISIONING_FROZEN'],
  ] as Array<[string,Faults,string]>)('%s',async(_label,faults,id)=>{
    const {results}=await run(faults);
    expect(results.find(r=>r.id===id)?.status).toBe('FAIL');
    expect(summarize(results).ok).toBe(false);
  });
  it('a wrong password fails sign-in and the journey',async()=>{
    const {results}=await run({},{...PASSWORDS,teacher:'wrong'});
    expect(results.find(r=>r.id==='SIGN_IN:teacher')).toMatchObject({status:'FAIL',code:'error_CredentialsSignin'});
    expect(results.find(r=>r.id==='TEACHER_JOURNEY')?.status).toBe('FAIL');
  });
});

describe('cookie jar',()=>{
  it('the cookie jar drops cleared and expired cookies',()=>{
    const jar=new CookieJar();
    jar.absorb({status:200,headers:{'set-cookie':['__Secure-next-auth.session-token=t; Path=/']},body:''});expect(jar.hasSession()).toBe(true);
    jar.absorb({status:200,headers:{'set-cookie':['__Secure-next-auth.session-token=; Max-Age=0']},body:''});expect(jar.hasSession()).toBe(false);
  });
});

describe('authorization gate refuses before any network or prompt',()=>{
  const good=['--deployment-url','https://liberia-learn-preview-abc123.vercel.app','--authorization','A3-20261102-cos','--expect-source-sha','a'.repeat(40)];
  const io={stdinTTY:true,stdoutTTY:true,env:{VERCEL_OIDC_TOKEN:'oidc-synthetic'}};
  it('accepts an authorized interactive run against an exact deployment URL',()=>{
    expect(preflight(parseArgs(good),io)).toBe('https://liberia-learn-preview-abc123.vercel.app');
  });
  it.each([
    ['CI',parseArgs(good),{...io,env:{CI:'true'}},'smoke_refuses_ci'],
    ['non-interactive',parseArgs(good),{...io,stdinTTY:false},'smoke_requires_interactive_console'],
    ['no A3 reference',parseArgs(good.slice(0,2).concat(good.slice(4))),io,'smoke_requires_A3_authorization_reference'],
    ['no source SHA',parseArgs(good.slice(0,4)),io,'smoke_requires_expected_source_sha'],
    ['no OIDC trusted-source token (not under vc env run)',parseArgs(good),{...io,env:{}},'smoke_requires_vc_env_run_oidc'],
  ] as const)('%s',(_l,args,ioIn,code)=>{expect(()=>preflight(args,ioIn as never)).toThrow(code);});
  it.each(['http://x.vercel.app','https://app.example.com','https://x.vercel.app/learn','https://u:p@x.vercel.app','https://x.vercel.app:444','https://x.vercel.app?a=1'])('refuses deployment URL %s',url=>{
    expect(()=>validateDeploymentUrl(url)).toThrow('smoke_deployment_url_invalid');
  });
  it('refuses unknown arguments (no password flag exists)',()=>{
    expect(()=>parseArgs(['--password','x'])).toThrow('smoke_unknown_argument');
  });
});

describe('transport never creates or uses a Vercel protection bypass secret',()=>{
  it('RED: uses in-process fetch with the OIDC trusted-source header on the deployment origin only',async()=>{
    const mod=await import('@/artifacts/t1-preview-app/hosted-smoke') as Record<string,unknown>;
    expect(typeof mod.oidcFetchTransport).toBe('function');
    const calls:Array<{url:string;headers:Record<string,string>;redirect?:string}>=[];
    const fake=async(url:string,init:{headers:Record<string,string>;redirect?:string})=>{calls.push({url,headers:init.headers,redirect:init.redirect});return new Response('ok',{status:200,headers:{'set-cookie':'a=1'}});};
    const http=(mod.oidcFetchTransport as (o:string,t:string,f:unknown)=>(r:HttpRequest)=>Promise<HttpResponse>)('https://d.vercel.app','oidc-synthetic',fake);
    await http({method:'POST',path:'/api/auth/callback/credentials',headers:{Cookie:'c=1'},form:{password:'p'}});
    await http({method:'GET',path:'/learn/day',base:'plain'});
    expect(calls[0]).toMatchObject({url:'https://d.vercel.app/api/auth/callback/credentials',redirect:'manual'});
    expect(calls[0].headers['x-vercel-trusted-oidc-idp-token']).toBe('oidc-synthetic');
    expect(calls[0].headers['x-vercel-protection-bypass']).toBeUndefined();
    expect(calls[1].headers['x-vercel-trusted-oidc-idp-token']).toBeUndefined();
    expect(calls[1].headers.Cookie).toBeUndefined();
  });
  it('RED: the runner contains no vercel CLI invocation or bypass flag',async()=>{
    const {readFileSync}=await import('node:fs');
    const source=readFileSync('artifacts/t1-preview-app/hosted-smoke.ts','utf8');
    expect(source).not.toMatch(/vercel(\.cmd)?['"],\s*\[\s*['"]curl|protection-bypass|VERCEL_AUTOMATION_BYPASS_SECRET|child_process/);
  });
});

/**
 * Revision 3 acceptance gate (Atlas ATLAS-T1-1c2bba0d smoke REVISE). Before: Smoke.run({}) marked every journey SKIP
 * and summarize() returned ok:true whenever FAIL was zero. Now acceptance depends on an explicit required-check set:
 * the three required roles need nonempty credentials before any network progress, a missing or SKIP required check
 * is INCOMPLETE, any FAIL is FAIL, requested browser checks are required, and only the declared optional checks
 * (foreign-teacher cross-school denial; the copied-cookie LIMITATION) may be absent or non-PASS.
 */
import * as smokeLib from '@/artifacts/t1-preview-app/hosted-smoke-lib';
import * as smokeCli from '@/artifacts/t1-preview-app/hosted-smoke';
const lib=smokeLib as any,cli=smokeCli as any;
const verdict=(results:{id:string;status:string;code:string}[],opts?:{browser?:boolean})=>lib.acceptance?.(results,opts)?.verdict;
const BROWSER=[320,375,768].flatMap(w=>['DAY_EIGHT_EXACT_LINKS','KEYBOARD_DAY_TO_LESSON','NO_EXTERNAL_BROWSER_REQUESTS'].map(id=>({id:`${id}:${w}`,status:'PASS' as const,code:'checked'})));

describe('acceptance gate: required journeys cannot be skipped',()=>{
  it('RED: successful three-role control is PASS (optional foreign teacher present or absent)',async()=>{
    expect(verdict((await run()).results)).toBe('PASS');
    const {results}=await run({},{...PASSWORDS,foreignTeacher:undefined});
    expect(verdict(results)).toBe('PASS');
    expect(lib.acceptance(results).openOptional).toContain('CROSS_SCHOOL_DENIAL');
    expect(summarize(results).ok).toBe(true);
  });
  it('RED: with no credentials at all the run refuses before any request',async()=>{
    const calls:string[]=[];
    const smoke=new Smoke(async r=>{calls.push(r.path);return {status:500,headers:{},body:''};},undefined,()=>NOW);
    await expect(smoke.run({})).rejects.toThrow('smoke_required_credential_missing:student,teacher,admin');
    expect(calls).toEqual([]);
  });
  it.each(['student','teacher','admin'] as const)('RED: missing %s credential (undefined, empty or blank) refuses before any request',async role=>{
    for(const value of [undefined,'','   ']){
      const calls:string[]=[];
      const smoke=new Smoke(async r=>{calls.push(r.path);return {status:500,headers:{},body:''};},undefined,()=>NOW);
      await expect(smoke.run({...PASSWORDS,[role]:value})).rejects.toThrow(`smoke_required_credential_missing:${role}`);
      expect(calls).toEqual([]);
    }
  });
  it('RED: a failed required login is FAIL, never PASS or INCOMPLETE',async()=>{
    const {results}=await run({},{...PASSWORDS,admin:'wrong'});
    expect(verdict(results)).toBe('FAIL');
    expect(summarize(results).ok).toBe(false);
  });
  it('RED: a missing required result is INCOMPLETE and named',async()=>{
    const {results}=await run();
    const without=results.filter(r=>r.id!=='IDENTITY_PROVISIONING_FROZEN');
    expect(verdict(without)).toBe('INCOMPLETE');
    expect(lib.acceptance(without).missingRequired).toEqual(['IDENTITY_PROVISIONING_FROZEN']);
    expect(summarize(without).ok).toBe(false);
  });
  it('RED: a SKIP on a required check is INCOMPLETE (only declared optional checks may skip)',async()=>{
    const {results}=await run();
    const skipped=results.map(r=>r.id==='STUDENT_DAY_RENDERS'?{...r,status:'SKIP' as const}:r);
    expect(verdict(skipped)).toBe('INCOMPLETE');
    expect(lib.acceptance(skipped).skippedRequired).toEqual(['STUDENT_DAY_RENDERS']);
  });
  it('RED: --browser makes the nine browser checks required: absent is INCOMPLETE, a FAIL is FAIL',async()=>{
    const {results}=await run();
    expect(verdict(results,{browser:true})).toBe('INCOMPLETE');
    expect(lib.acceptance(results,{browser:true}).missingRequired).toHaveLength(9);
    expect(verdict([...results,...BROWSER],{browser:true})).toBe('PASS');
    expect(verdict([...results,...BROWSER.map((r,i)=>i===4?{...r,status:'FAIL' as const}:r)],{browser:true})).toBe('FAIL');
  });
  it('RED: an optional cross-school SKIP does not close tenant isolation: it is reported as open',async()=>{
    const {results}=await run({},{...PASSWORDS,foreignTeacher:undefined});
    expect(lib.acceptance(results)).toMatchObject({verdict:'PASS',openOptional:['CROSS_SCHOOL_DENIAL']});
    expect(lib.REQUIRED_ROLES).toEqual(['student','teacher','admin']);
  });
  it('RED: the prompt rejects an empty required answer and allows an empty optional one',()=>{
    expect(()=>cli.acceptPromptAnswer('teacher','')).toThrow('smoke_required_credential_missing:teacher');
    expect(()=>cli.acceptPromptAnswer('admin','  ')).toThrow('smoke_required_credential_missing:admin');
    expect(cli.acceptPromptAnswer('foreignTeacher','')).toBeUndefined();
    expect(cli.acceptPromptAnswer('student','synthetic')).toBe('synthetic');
  });
});
