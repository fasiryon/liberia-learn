/**
 * PV-06 Preview-only session policy (T1, 2026-11-02; parameters pending CoS/Atlas confirmation).
 * Deployed Preview/staging: an 8 h absolute session bound anchored at sign-in (authTime), enforced in the
 * NextAuth callbacks every server reader goes through; uncached freshness so password/role/school changes
 * revoke at once; no platform-admin password login. Production and local runs are unchanged.
 * Synthetic users and fake timers only; no database.
 */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({findFirst:vi.fn(),findUnique:vi.fn(),compare:vi.fn(),rate:vi.fn(),metric:vi.fn(),cache:vi.fn(),session:vi.fn()}));
vi.mock('next-auth',()=>({getServerSession:m.session}));
vi.mock('@/lib/db',()=>({prisma:{user:{findFirst:m.findFirst,findUnique:m.findUnique}}}));
vi.mock('bcryptjs',()=>({default:{compare:m.compare}}));
vi.mock('@/lib/rateLimit',()=>({checkRateLimit:m.rate}));
vi.mock('@/lib/metrics/events',()=>({recordMetricEvent:m.metric}));
vi.mock('@/lib/cache/redisCache',()=>({withRedisCache:m.cache}));

const NOW=Date.parse('2026-11-02T12:00:00Z'),HOUR=3600_000;
// integration/g4-day: fixtures carry the R1 token contract (credStamp; passwordChangedAt null -> 0). No assertion changed.
const student={id:'synthetic-student',email:'student@synthetic.invalid',role:'STUDENT',schoolId:'synthetic-school',isPlatformAdmin:false,hashedPwd:'x',school:{status:'ACTIVE'},privilegedIdentity:null,credStamp:0};
async function auth(env:Record<string,string|undefined>){
  vi.unstubAllEnvs();
  for(const key of ['VERCEL_ENV','PRIVILEGED_MFA_ENFORCEMENT_ENABLED'])vi.stubEnv(key,undefined as unknown as string);
  for(const [k,v] of Object.entries(env))vi.stubEnv(k,v as string);
  vi.resetModules();
  return import('@/lib/auth');
}
const sessionFor=async(mod:typeof import('@/lib/auth'),token:Record<string,unknown>):Promise<{user?:Record<string,unknown>}>=>
  await mod.authOptions.callbacks!.session!({session:{user:{name:'x'},expires:'2099-01-01T00:00:00.000Z'},token} as never);
const signInToken=async(mod:typeof import('@/lib/auth'),user:Record<string,unknown>)=>
  mod.authOptions.callbacks!.jwt!({token:{},user,account:{provider:'credentials'}} as never) as Promise<Record<string,unknown>>;

beforeEach(()=>{
  vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(NOW);
  m.rate.mockResolvedValue({allowed:true});m.metric.mockResolvedValue(undefined);m.compare.mockResolvedValue(true);
  m.cache.mockImplementation((_k:string,_t:number,fn:()=>unknown)=>fn());
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});

describe('cookie lifetime',()=>{
  it('RED: deployed Preview issues at most an 8 hour session cookie',async()=>{
    expect((await auth({VERCEL_ENV:'preview'})).authOptions.session?.maxAge).toBe(8*60*60);
  });
  it.each([[{VERCEL_ENV:'production'}],[{}]])('Production and local keep the 30 day default %j',async env=>{
    expect((await auth(env)).authOptions.session?.maxAge).toBe(30*24*60*60);
  });
});

describe('absolute bound anchored at sign-in',()=>{
  it('RED: sign-in stamps authTime once; a later refresh never moves it',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    const token=await signInToken(mod,student);
    expect(token.authTime).toBe(NOW);
    m.findFirst.mockResolvedValue({passwordChangedAt:null,role:'STUDENT',schoolId:student.schoolId,isPlatformAdmin:false,school:{status:'ACTIVE'}});
    vi.setSystemTime(NOW+2*HOUR);
    const refreshed=await mod.authOptions.callbacks!.jwt!({token:{...token}} as never) as Record<string,unknown>;
    expect(refreshed.authTime).toBe(NOW);
  });
  it('RED: a session past 8 hours has no user, so every server reader is signed out',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    const token=await signInToken(mod,student);
    vi.setSystemTime(NOW+8*HOUR-1000);
    expect((await sessionFor(mod,token)).user?.id).toBe(student.id);
    vi.setSystemTime(NOW+8*HOUR);
    expect((await sessionFor(mod,token)).user).toBeUndefined();
  });
  it.each([['missing',undefined],['non-numeric','x'],['future',NOW+10*60_000]])('RED: a %s authTime fails closed in Preview',async(_label,authTime)=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    expect((await sessionFor(mod,{id:student.id,role:'STUDENT',authTime})).user).toBeUndefined();
  });
  it('RED: getOptionalUser and requireUser refuse an expired Preview session',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    const token={id:student.id,role:'STUDENT',schoolId:student.schoolId,authTime:NOW-9*HOUR};
    m.session.mockImplementation(async()=>sessionFor(mod,token));
    expect(await mod.getOptionalUser()).toBeNull();
    await expect(mod.requireUser()).rejects.toMatchObject({status:401});
    expect(m.findUnique).not.toHaveBeenCalled();
  });
  it('Production is unchanged: an old or anchorless token still yields its user',async()=>{
    const mod=await auth({VERCEL_ENV:'production'});
    expect((await sessionFor(mod,{id:student.id,role:'STUDENT',authTime:NOW-9*24*HOUR})).user?.id).toBe(student.id);
    expect((await sessionFor(mod,{id:student.id,role:'STUDENT'})).user?.id).toBe(student.id);
  });
});

describe('invalidation without waiting for a cache',()=>{
  const fresh={passwordChangedAt:null,role:'STUDENT',schoolId:student.schoolId,isPlatformAdmin:false,school:{status:'ACTIVE'}};
  it('RED: Preview re-reads freshness from the database on every request (no 700 s cache)',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    // NextAuth always sets iat (seconds) on an issued token.
    const token={id:student.id,role:'STUDENT',schoolId:student.schoolId,authTime:NOW,credStamp:0,iat:Math.floor(NOW/1000)};
    m.session.mockImplementation(async()=>sessionFor(mod,token));
    m.findUnique.mockResolvedValue(fresh);
    await mod.requireUser();
    expect(m.cache).not.toHaveBeenCalled();
    m.findUnique.mockResolvedValue({...fresh,passwordChangedAt:new Date(NOW+1000)});
    vi.setSystemTime(NOW+2000);
    await expect(mod.requireUser()).rejects.toMatchObject({status:401});
  });
  it('a role or school change in Preview ends the session at once',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    m.session.mockImplementation(async()=>sessionFor(mod,{id:student.id,role:'STUDENT',schoolId:student.schoolId,authTime:NOW}));
    m.findUnique.mockResolvedValue({...fresh,schoolId:'other-school'});
    await expect(mod.requireUser()).rejects.toMatchObject({status:401});
  });
  it('Production keeps the cached freshness path',async()=>{
    const mod=await auth({VERCEL_ENV:'production'});
    m.session.mockImplementation(async()=>sessionFor(mod,{id:student.id,role:'STUDENT',schoolId:student.schoolId,authTime:NOW,credStamp:0}));
    m.findUnique.mockResolvedValue(fresh);
    await mod.requireUser();
    expect(m.cache).toHaveBeenCalledOnce();
  });
});

describe('no platform-admin password login on a deployed Preview',()=>{
  const platform={...student,id:'synthetic-authority',email:'authority@synthetic.invalid',role:'ADMIN',isPlatformAdmin:true};
  const schoolAdmin={...student,id:'synthetic-admin',email:'admin@synthetic.invalid',role:'ADMIN',isPlatformAdmin:false};
  it('RED: a platform admin with the right password is refused in Preview, with a reason-coded metric',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    m.findFirst.mockResolvedValue(platform);
    expect(await mod.authorizeCredentials({email:platform.email,password:'correct'})).toBeNull();
    expect(m.metric.mock.calls[0]?.[1]).toMatchObject({reason:'privileged_mfa_required'});
  });
  it('the synthetic school admin and student journeys still sign in (SEC-R08 unchanged, not bypassed)',async()=>{
    const mod=await auth({VERCEL_ENV:'preview'});
    for(const user of [schoolAdmin,student]){
      m.findFirst.mockResolvedValueOnce(user);
      expect(await mod.authorizeCredentials({email:user.email,password:'correct'})).toMatchObject({id:user.id});
    }
  });
  it('MFA enforcement still applies first when enabled (no bypass)',async()=>{
    const mod=await auth({VERCEL_ENV:'preview',PRIVILEGED_MFA_ENFORCEMENT_ENABLED:'true'});
    m.findFirst.mockResolvedValue(schoolAdmin);
    expect(await mod.authorizeCredentials({email:schoolAdmin.email,password:'correct'})).toBeNull();
  });
  it('Production platform-admin login behavior is unchanged',async()=>{
    const mod=await auth({VERCEL_ENV:'production'});
    m.findFirst.mockResolvedValue(platform);
    expect(await mod.authorizeCredentials({email:platform.email,password:'correct'})).toMatchObject({id:platform.id});
  });
});
