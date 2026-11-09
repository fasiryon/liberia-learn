/**
 * Hosted Preview smoke checks (T1, 2026-11-02). Pure logic over an injected HTTP transport so every check is
 * unit-tested without a host. Read-only by construction: only GET, the NextAuth credential sign-in/sign-out POSTs
 * and a 405 method probe on a GET-only route are allowed; the request log is audited at the end.
 * Results carry only an id, a status and a fixed reason code: never a body, cookie, token or password.
 */
import {GRADE4_SCHOOLDAY_ACCEPTED} from '../../lib/curriculum/v4/schooldayPackage';
import identities from '../../scripts/e2e/school-day-identities.json';

export type HttpRequest={method:'GET'|'POST'|'PUT';path:string;headers?:Record<string,string>;form?:Record<string,string>;base?:'deployment'|'plain'};
export type HttpResponse={status:number;headers:Record<string,string[]>;body:string};
export type Http=(request:HttpRequest)=>Promise<HttpResponse>;
export type Status='PASS'|'FAIL'|'SKIP'|'LIMITATION';
export type CheckResult={id:string;status:Status;code:string};
export type Role='student'|'teacher'|'admin'|'foreignTeacher';
export type Passwords=Partial<Record<Role,string>>;

export const EMAILS=identities.SCHOOL_DAY_EMAILS;
export const IDS=identities.SCHOOL_DAY_IDS;
/** Accounts this suite may sign in as. The platform-admin authority and extra students are never used. */
export const APPROVED_ROLES:readonly Role[]=['student','teacher','admin','foreignTeacher'];
/** Roles whose journeys acceptance requires; foreignTeacher is optional (non-disclosed K2 credential). */
export const REQUIRED_ROLES:readonly Role[]=['student','teacher','admin'];
export const PACKAGES=Object.entries(GRADE4_SCHOOLDAY_ACCEPTED).map(([selection,hash])=>({selection,hash}));
export const PRODUCTION_SUPABASE_REF='bnphuinpvgpmebcsvmsp';
export const PREVIEW_SESSION_MAX_SECONDS=8*60*60;
const SESSION_COOKIE=/^(__Secure-)?next-auth\.session-token(\.\d+)?$/;
const ADVISORY=`/api/teacher/learning-authority/grade4-math/misconceptions?studentId=${IDS.student}`;
const CRON_PATHS=['/api/cron/agents/tick','/api/crons/league-snapshot','/api/cron/release-stale-grades'];
const DEV_PATHS=['/lab-review','/curriculum-candidates/x.svg','/design-preview'];
const TEACHER_PATHS=['/teacher/schedule','/api/teacher/schedule',ADVISORY];
const ADMIN_PATHS=['/admin','/api/admin/students','/api/admin/placements','/api/admin/report-cards'];
export const BROWSER_WIDTHS=[320,375,768];

/** Exact https://<name>.vercel.app deployment URL; anything else (custom domains, paths, credentials) is refused. */
export function validateDeploymentUrl(raw:string):string{
  let url:URL;
  try{url=new URL(raw);}catch{throw Error('smoke_deployment_url_invalid');}
  if(url.protocol!=='https:'||!/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname)||url.username||url.password||url.port||(url.pathname!=='/'&&url.pathname!=='')||url.search||url.hash)
    throw Error('smoke_deployment_url_invalid');
  return url.origin;
}

export class CookieJar{
  private cookies=new Map<string,string>();
  absorb(response:HttpResponse){
    for(const line of response.headers['set-cookie']??[]){
      const [pair,...attrs]=line.split(';');const eq=pair.indexOf('=');if(eq<1)continue;
      const name=pair.slice(0,eq).trim(),value=pair.slice(eq+1).trim();
      const expired=attrs.some(a=>/^\s*max-age=0\s*$/i.test(a)||(/^\s*expires=/i.test(a)&&Date.parse(a.split('=').slice(1).join('='))<=Date.now()));
      if(!value||expired)this.cookies.delete(name);else this.cookies.set(name,value);
    }
  }
  header(){return [...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ');}
  hasSession(){return [...this.cookies.keys()].some(k=>SESSION_COOKIE.test(k));}
  snapshot(){const copy=new CookieJar();copy.cookies=new Map(this.cookies);return copy;}
}

const first=(r:HttpResponse,name:string)=>r.headers[name.toLowerCase()]?.[0]??'';
const json=(r:HttpResponse):any=>{try{return JSON.parse(r.body);}catch{return null;}};
const redirectsTo=(r:HttpResponse,pathname:string)=>[301,302,303,307,308].includes(r.status)&&(()=>{try{return new URL(first(r,'location'),'https://x.invalid').pathname===pathname;}catch{return false;}})();

export class Smoke{
  results:CheckResult[]=[];
  log:Array<{method:string;path:string}>=[];
  constructor(private http:Http,private forbidden:string[]=[PRODUCTION_SUPABASE_REF],private now:()=>number=Date.now){}
  private record(id:string,ok:boolean|Status,code:string){this.results.push({id,status:typeof ok==='string'?ok:ok?'PASS':'FAIL',code});}
  async request(req:HttpRequest,jar?:CookieJar){
    const headers={...(req.headers??{})};const cookie=jar?.header();if(cookie)headers.Cookie=cookie;
    this.log.push({method:req.method,path:req.path});
    const response=await this.http({...req,headers});
    jar?.absorb(response);
    // Every response is scanned for Production identifiers; only the fact of a leak is reported.
    const haystack=JSON.stringify(response.headers)+response.body;
    for(const needle of this.forbidden)if(needle&&haystack.includes(needle))this.record('NO_PRODUCTION_IDENTIFIERS',false,`leak_in:${req.path.split('?')[0]}`);
    return response;
  }

  async accessControl(){
    const plain=await this.request({method:'GET',path:'/learn/day',base:'plain'});
    const loc=first(plain,'location');
    const wall=plain.status===401||plain.status===403||([302,303,307,308].includes(plain.status)&&/(^|\.)vercel\.com$/.test((()=>{try{return new URL(loc).hostname;}catch{return '';}})()));
    this.record('SSO_WALL_UNAUTHENTICATED',wall&&!plain.body.includes('data-day-source'),wall?'protected':`status_${plain.status}`);
  }

  async publicSurface(){
    const login=await this.request({method:'GET',path:'/login'});
    this.record('LOGIN_RENDERS',login.status===200,`status_${login.status}`);
    const csp=first(login,'content-security-policy');
    const script=csp.split(';').map(s=>s.trim()).find(s=>s.startsWith('script-src '))??'';
    this.record('CSP_NONCE_NO_EVAL',/'nonce-[A-Za-z0-9]+'/.test(script)&&!script.includes("'unsafe-eval'")&&!/\bblob:/.test(script),script?'checked':'missing');
    const hsts=first(login,'strict-transport-security'),xfo=first(login,'x-frame-options'),nosniff=first(login,'x-content-type-options'),ref=first(login,'referrer-policy');
    this.record('SECURITY_HEADERS',/max-age=\d{7,}/.test(hsts)&&xfo.toUpperCase()==='DENY'&&nosniff==='nosniff'&&!!ref,'checked');
    const providers=json(await this.request({method:'GET',path:'/api/auth/providers'}));
    this.record('CREDENTIALS_ONLY_PROVIDER',!!providers&&Object.keys(providers).sort().join()==='credentials','checked');
    const google=await this.request({method:'GET',path:'/api/auth/signin/google'});
    const gloc=first(google,'location');
    this.record('NO_EXTERNAL_OAUTH_REDIRECT',!gloc||!/^https?:\/\//.test(gloc)||(()=>{try{return new URL(gloc).hostname.endsWith('.vercel.app');}catch{return false;}})(),'checked');
    const anon=json(await this.request({method:'GET',path:'/api/auth/session'}));
    this.record('ANONYMOUS_SESSION_EMPTY',!anon?.user,'checked');
  }

  async preview(){
    for(const path of CRON_PATHS){
      const r=await this.request({method:'GET',path});
      this.record(`CRON_REFUSED:${path}`,r.status===401||r.status===403||r.status===404,`status_${r.status}`);
    }
    for(const path of DEV_PATHS){
      const r=await this.request({method:'GET',path});
      this.record(`DEV_SURFACE_ABSENT:${path}`,r.status===404,`status_${r.status}`);
    }
  }

  async signIn(role:Role,password:string){
    if(!APPROVED_ROLES.includes(role))throw Error('smoke_unapproved_account');
    const jar=new CookieJar();
    const csrf=json(await this.request({method:'GET',path:'/api/auth/csrf'},jar))?.csrfToken;
    if(typeof csrf!=='string'){this.record(`SIGN_IN:${role}`,false,'csrf_missing');return null;}
    const r=await this.request({method:'POST',path:'/api/auth/callback/credentials',form:{csrfToken:csrf,email:EMAILS[role],password,callbackUrl:'/',json:'true'}},jar);
    const url=json(r)?.url;
    const error=typeof url==='string'?new URL(url,'https://x.invalid').searchParams.get('error'):null;
    const ok=jar.hasSession()&&!error;
    this.record(`SIGN_IN:${role}`,ok,ok?'session_issued':`error_${error&&/^[A-Za-z]{1,40}$/.test(error)?error:'unknown'}`);
    if(ok)this.sessionCookieAttributes(role,r);
    return ok?jar:null;
  }

  private sessionCookieAttributes(role:Role,r:HttpResponse){
    const line=(r.headers['set-cookie']??[]).find(l=>SESSION_COOKIE.test(l.split('=')[0].trim()))??'';
    const attrs=line.split(';').map(s=>s.trim().toLowerCase());
    this.record(`SESSION_COOKIE_FLAGS:${role}`,line.startsWith('__Secure-')&&attrs.includes('httponly')&&attrs.includes('secure')&&attrs.some(a=>a==='samesite=lax'||a==='samesite=strict'),'checked');
    const expires=attrs.find(a=>a.startsWith('expires='));const maxAge=attrs.find(a=>a.startsWith('max-age='));
    const seconds=maxAge?Number(maxAge.slice(8)):expires?(Date.parse(expires.slice(8))-this.now())/1000:Infinity;
    this.record(`SESSION_ABSOLUTE_BOUND:${role}`,seconds<=PREVIEW_SESSION_MAX_SECONDS+60,seconds<=PREVIEW_SESSION_MAX_SECONDS+60?'<=8h':'over_8h_pv06_absent');
  }

  async student(jar:CookieJar){
    const session=json(await this.request({method:'GET',path:'/api/auth/session'},jar));
    this.record('STUDENT_SESSION_SCOPE',session?.user?.role==='STUDENT'&&session?.user?.schoolId===IDS.school,'checked');
    const day=await this.request({method:'GET',path:'/learn/day'},jar);
    const empty=day.body.includes('data-day-empty');
    this.record('STUDENT_DAY_RENDERS',day.status===200&&!empty,day.status!==200?`status_${day.status}`:empty?'empty_day_pv05':'rendered');
    for(const [i,pkg] of PACKAGES.entries()){
      const access=await this.request({method:'GET',path:`/api/student/learning-preview/${encodeURIComponent(pkg.selection)}?accessOnly=1`},jar);
      const body=json(access);
      this.record(`PACKAGE_IDENTITY:P${i+1}`,access.status===200&&body?.identity?.selection===pkg.selection&&body?.identity?.packageHash===pkg.hash&&body?.status==='PILOT_ONLY'&&/no-store/.test(first(access,'cache-control')),`status_${access.status}`);
      const player=await this.request({method:'GET',path:`/learn/preview/${encodeURIComponent(pkg.selection)}`},jar);
      this.record(`PLAYER_RENDERS:P${i+1}`,player.status===200&&player.body.includes(pkg.hash),`status_${player.status}`);
    }
    const probe=await this.request({method:'POST',path:`/api/student/learning-preview/${encodeURIComponent(PACKAGES[0].selection)}`},jar);
    this.record('PREVIEW_API_READ_ONLY',probe.status===405,`status_${probe.status}`);
    const teacher=await this.request({method:'GET',path:'/teacher/schedule'},jar);
    this.record('STUDENT_DENIED_TEACHER_PORTAL',teacher.status!==200,`status_${teacher.status}`);
    const admin=await this.request({method:'GET',path:'/admin'},jar);
    this.record('STUDENT_DENIED_ADMIN_PORTAL',redirectsTo(admin,'/unauthorized'),`status_${admin.status}`);
    const roster=await this.request({method:'GET',path:'/api/admin/students'},jar);
    this.record('STUDENT_DENIED_ADMIN_API',roster.status===401||roster.status===403,`status_${roster.status}`);
  }

  async teacher(jar:CookieJar){
    for(const path of TEACHER_PATHS){
      const r=await this.request({method:'GET',path},jar);this.record(`TEACHER_ALLOWED:${path.split('?')[0]}`,r.status===200,`status_${r.status}`);
    }
    const missing=await this.request({method:'GET',path:`/api/teacher/learning-authority/grade4-math/misconceptions?studentId=g4-e2e-missing`},jar);
    this.record('TEACHER_UNKNOWN_LEARNER_404',missing.status===404,`status_${missing.status}`);
    const day=await this.request({method:'GET',path:'/learn/day'},jar);
    this.record('TEACHER_DENIED_STUDENT_DAY',day.status===404||[302,307].includes(day.status),`status_${day.status}`);
    const access=await this.request({method:'GET',path:`/api/student/learning-preview/${encodeURIComponent(PACKAGES[0].selection)}?accessOnly=1`},jar);
    this.record('TEACHER_DENIED_PACKAGE',access.status===404,`status_${access.status}`);
    const admin=await this.request({method:'GET',path:'/admin'},jar);
    this.record('TEACHER_DENIED_ADMIN_PORTAL',redirectsTo(admin,'/unauthorized'),`status_${admin.status}`);
  }

  async admin(jar:CookieJar){
    for(const path of ADMIN_PATHS){
      const r=await this.request({method:'GET',path},jar);this.record(`ADMIN_ALLOWED:${path}`,r.status===200,`status_${r.status}`);
    }
    // Read-only proof of the Preview identity freeze: never POST to a provisioning route.
    const reveal=await this.request({method:'GET',path:'/api/admin/import/batches/smoke-probe/credentials'},jar);
    this.record('IDENTITY_PROVISIONING_FROZEN',reveal.status===403&&json(reveal)?.code==='PREVIEW_IDENTITY_FROZEN',`status_${reveal.status}`);
    const platform=await this.request({method:'GET',path:'/platform'},jar);
    this.record('ADMIN_DENIED_PLATFORM',redirectsTo(platform,'/unauthorized'),`status_${platform.status}`);
    const day=await this.request({method:'GET',path:'/learn/day'},jar);
    this.record('ADMIN_DENIED_STUDENT_DAY',day.status===404||[302,307].includes(day.status),`status_${day.status}`);
    const cron=await this.request({method:'GET',path:'/api/cron/agents/tick'},jar);
    this.record('CRON_REFUSED_WITH_SESSION',cron.status===401||cron.status===403,`status_${cron.status}`);
  }

  async foreignTeacher(jar:CookieJar|null){
    if(!jar){this.record('CROSS_SCHOOL_DENIAL','SKIP','no_foreign_credential_k2');return;}
    const advisory=await this.request({method:'GET',path:ADVISORY},jar);
    this.record('CROSS_SCHOOL_ADVISORY_404',advisory.status===404,`status_${advisory.status}`);
    const attendance=await this.request({method:'GET',path:`/api/teacher/attendance?classId=${IDS.class}`},jar);
    this.record('CROSS_SCHOOL_ATTENDANCE_403',attendance.status===403,`status_${attendance.status}`);
  }

  async logout(role:Role,jar:CookieJar){
    const copied=jar.snapshot();
    const csrf=json(await this.request({method:'GET',path:'/api/auth/csrf'},jar))?.csrfToken;
    await this.request({method:'POST',path:'/api/auth/signout',form:{csrfToken:String(csrf??''),callbackUrl:'/login',json:'true'}},jar);
    this.record(`LOGOUT_CLEARS_COOKIE:${role}`,!jar.hasSession(),'checked');
    const after=json(await this.request({method:'GET',path:'/api/auth/session'},jar));
    this.record(`LOGOUT_SESSION_EMPTY:${role}`,!after?.user,'checked');
    const replay=json(await this.request({method:'GET',path:'/api/auth/session'},copied));
    // Stateless JWT: a copied cookie stays valid until the absolute bound (no server-side revocation store).
    this.record(`LOGOUT_COPIED_COOKIE:${role}`,replay?.user?'LIMITATION':'PASS',replay?.user?'copied_cookie_valid_until_bound':'revoked');
  }

  /** The suite itself never writes: only allowed methods and paths appear in the request log. */
  auditOwnRequests(){
    const allowedPost=new Set(['/api/auth/callback/credentials','/api/auth/signout',`/api/student/learning-preview/${encodeURIComponent(PACKAGES[0].selection)}`]);
    const bad=this.log.filter(r=>r.method!=='GET'&&!(r.method==='POST'&&allowedPost.has(r.path)));
    this.record('SMOKE_SENT_NO_WRITES',bad.length===0,bad.length?`unexpected_${bad.length}`:'get_and_auth_only');
    if(!this.results.some(r=>r.id==='NO_PRODUCTION_IDENTIFIERS'))this.record('NO_PRODUCTION_IDENTIFIERS',true,'none_seen');
  }

  async run(passwords:Passwords){
    // Acceptance needs all three required journeys: refuse before any network progress when a credential is absent.
    const missing=REQUIRED_ROLES.filter(role=>typeof passwords[role]!=='string'||!passwords[role]!.trim());
    if(missing.length)throw Error(`smoke_required_credential_missing:${missing.join(',')}`);
    await this.accessControl();await this.publicSurface();await this.preview();
    const jars:Partial<Record<Role,CookieJar|null>>={};
    for(const role of APPROVED_ROLES)jars[role]=passwords[role]?await this.signIn(role,passwords[role]!):null;
    if(jars.student)await this.student(jars.student);else this.record('STUDENT_JOURNEY',false,'no_session');
    if(jars.teacher)await this.teacher(jars.teacher);else this.record('TEACHER_JOURNEY',false,'no_session');
    if(jars.admin)await this.admin(jars.admin);else this.record('ADMIN_JOURNEY',false,'no_session');
    await this.foreignTeacher(jars.foreignTeacher??null);
    for(const role of APPROVED_ROLES)if(jars[role])await this.logout(role,jars[role]!);
    this.auditOwnRequests();
    return this.results;
  }
}

/**
 * The explicit required-check set. Every id must be present with PASS. Optional (may be absent, SKIP or LIMITATION,
 * and never close a gate): the foreign-teacher cross-school checks and LOGOUT_COPIED_COOKIE:<role> (stateless JWT:
 * an honest limitation until a revocation store exists).
 */
export function requiredCheckIds(opts:{browser?:boolean}={}):string[]{
  const ids=['SSO_WALL_UNAUTHENTICATED','LOGIN_RENDERS','CSP_NONCE_NO_EVAL','SECURITY_HEADERS','CREDENTIALS_ONLY_PROVIDER','NO_EXTERNAL_OAUTH_REDIRECT',
    'ANONYMOUS_SESSION_EMPTY',...CRON_PATHS.map(p=>`CRON_REFUSED:${p}`),...DEV_PATHS.map(p=>`DEV_SURFACE_ABSENT:${p}`)];
  for(const role of REQUIRED_ROLES)
    ids.push(`SIGN_IN:${role}`,`SESSION_COOKIE_FLAGS:${role}`,`SESSION_ABSOLUTE_BOUND:${role}`,`LOGOUT_CLEARS_COOKIE:${role}`,`LOGOUT_SESSION_EMPTY:${role}`);
  ids.push('STUDENT_SESSION_SCOPE','STUDENT_DAY_RENDERS',...PACKAGES.flatMap((_,i)=>[`PACKAGE_IDENTITY:P${i+1}`,`PLAYER_RENDERS:P${i+1}`]),
    'PREVIEW_API_READ_ONLY','STUDENT_DENIED_TEACHER_PORTAL','STUDENT_DENIED_ADMIN_PORTAL','STUDENT_DENIED_ADMIN_API',
    ...TEACHER_PATHS.map(p=>`TEACHER_ALLOWED:${p.split('?')[0]}`),'TEACHER_UNKNOWN_LEARNER_404','TEACHER_DENIED_STUDENT_DAY','TEACHER_DENIED_PACKAGE','TEACHER_DENIED_ADMIN_PORTAL',
    ...ADMIN_PATHS.map(p=>`ADMIN_ALLOWED:${p}`),'IDENTITY_PROVISIONING_FROZEN','ADMIN_DENIED_PLATFORM','ADMIN_DENIED_STUDENT_DAY','CRON_REFUSED_WITH_SESSION',
    'SMOKE_SENT_NO_WRITES','NO_PRODUCTION_IDENTIFIERS');
  if(opts.browser)
    for(const w of BROWSER_WIDTHS)ids.push(`DAY_EIGHT_EXACT_LINKS:${w}`,`KEYBOARD_DAY_TO_LESSON:${w}`,`NO_EXTERNAL_BROWSER_REQUESTS:${w}`);
  return ids;
}
const OPTIONAL_GATES=['CROSS_SCHOOL_DENIAL','CROSS_SCHOOL_ADVISORY_404','CROSS_SCHOOL_ATTENDANCE_403'];
export type Verdict='PASS'|'FAIL'|'INCOMPLETE';
/** FAIL if any check failed; INCOMPLETE if a required check is missing or not PASS; PASS only otherwise. */
export function acceptance(results:CheckResult[],opts:{browser?:boolean}={}){
  const failed=[...new Set(results.filter(r=>r.status==='FAIL').map(r=>r.id))];
  const byId=new Map<string,Status[]>();
  for(const r of results)byId.set(r.id,[...(byId.get(r.id)??[]),r.status]);
  const required=requiredCheckIds(opts);
  const missingRequired=required.filter(id=>!byId.has(id));
  const skippedRequired=required.filter(id=>byId.has(id)&&byId.get(id)!.some(s=>s!=='PASS'&&s!=='FAIL'));
  const openOptional=OPTIONAL_GATES.filter(id=>byId.get(id)?.every(s=>s==='SKIP'));
  const verdict:Verdict=failed.length?'FAIL':missingRequired.length||skippedRequired.length?'INCOMPLETE':'PASS';
  return {verdict,failed,missingRequired,skippedRequired,openOptional,required:required.length};
}

export function summarize(results:CheckResult[],opts:{browser?:boolean}={}){
  const count=(s:Status)=>results.filter(r=>r.status===s).length;
  const gate=acceptance(results,opts);
  return {pass:count('PASS'),fail:count('FAIL'),skip:count('SKIP'),limitation:count('LIMITATION'),verdict:gate.verdict,
    missingRequired:gate.missingRequired,skippedRequired:gate.skippedRequired,openOptional:gate.openOptional,ok:gate.verdict==='PASS'};
}
