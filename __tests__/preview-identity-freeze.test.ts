/**
 * OneRoster / account-provisioning exposure (T1, 2026-11-02, B5 follow-up). On a deployed Preview no route may create
 * accounts, issue, reveal, send or reset another account's credentials, issue or accept invites, change account
 * lifecycle or change privilege. Direct handler calls (not navigation) for every inventoried entry point, as a
 * same-school admin, a foreign-school admin, a platform admin and a student (authority is permissive in this file):
 * each must refuse with PREVIEW_IDENTITY_FROZEN before database or provider work. Production and local are unchanged.
 * Revision 3 moved protected-route refusal after authority; ordering, role-aware denials, own-credential freezes and
 * the syntax-aware scanner live in preview-identity-freeze-r3.test.ts and preview-identity-freeze-scanner.test.ts.
 */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({actor:{current:null as null|Record<string,unknown>},auth:vi.fn(),db:vi.fn(),provider:vi.fn()}));
const resolveActor=async()=>{m.auth();if(!m.actor.current)throw Object.assign(new Error('Unauthorized'),{status:401});return m.actor.current;};
vi.mock('@/lib/auth',()=>({requireUser:resolveActor,requireRole:resolveActor,requirePlatformAdmin:resolveActor,requirePrivilegedStepUp:resolveActor,getOptionalUser:resolveActor,authOptions:{}}));
vi.mock('@/lib/moeAccess',()=>({requireMoePlatformAdmin:resolveActor}));
vi.mock('next-auth',()=>({getServerSession:async()=>{m.auth();return m.actor.current?{user:m.actor.current}:null;}}));
vi.mock('@/lib/db',()=>{
  const deep:any=new Proxy(function(){},{get:(_t,key)=>key==='then'?undefined:deep,apply:()=>{m.db();throw Error('unexpected_database_access');}});
  return {prisma:deep,rdsPrisma:null,isRdsDualWriteEnabled:()=>false,logRdsDualWriteError:()=>undefined};
});
vi.mock('@/lib/email',async o=>({...(await o<object>()),sendEmail:m.provider}));
vi.mock('@/lib/credentials',async o=>({...(await o<object>()),sendCredentialSms:m.provider}));
vi.mock('@/lib/rateLimit',async o=>({...(await o<object>()),checkRateLimit:async()=>({allowed:true,remaining:9,resetAt:Date.now()+1000})}));
vi.mock('@/lib/serverFlags',async o=>({...(await o<object>()),isMoePortalEnabled:()=>true,isGuardianLinkingEnabled:()=>true,isEnrollmentInvitesEnabled:()=>true}));

type Handler=(req:Request,ctx:{params:Record<string,string>})=>Promise<Response>;
const ROUTES:Array<[string,string,string]>=[
  ['admin/interoperability/oneroster/import','POST','OneRoster import (temporary passwords)'],
  ['admin/import','POST','bulk import upload'],
  ['admin/import/confirm','POST','bulk import account creation'],
  ['admin/import/batches/[id]/credentials','GET','reveal imported credentials'],
  ['admin/onboarding/import-students','POST','onboarding student import'],
  ['admin/onboarding/import-teachers','POST','onboarding teacher import'],
  ['admin/students','POST','create student account'],
  ['admin/teachers','POST','create teacher account'],
  ['admin/teachers','PATCH','activate/deactivate teacher account'],
  ['admin/guardian-link','POST','create guardian account'],
  ['admin/invites','POST','issue invite'],
  ['onboard/invite','POST','issue onboarding invite'],
  ['onboard/accept','POST','accept invite (creates account)'],
  ['rollout/invite/teacher','POST','rollout teacher invite'],
  ['rollout/invite/student','POST','rollout student invite'],
  ['rollout/invite/student/bulk','POST','rollout bulk student invites'],
  ['register/student','POST','self-register student'],
  ['register/guardian','POST','self-register guardian'],
  ['guardian/register','POST','guardian registration'],
  ['admin/students/[id]/generate-reset-code','POST','issue a reset code for another account'],
  ['auth/reset-with-code','POST','reset password with an issued code'],
  ['auth/reset-password','POST','reset password with a token'],
  ['auth/forgot-password','POST','request a password reset'],
  ['admin/credentials/send','POST','send login credentials'],
  ['admin/schools/pending','POST','approve school (creates its admin)'],
  ['platform/security/accept','POST','grant platform privilege'],
  ['platform/security/demote','POST','change platform privilege'],
  ['admin/security/mfa/recovery/reset','POST','reset another account\'s MFA'],
];
const ACTORS={
  'same-school admin':{id:'s-admin',role:'ADMIN',schoolId:'g4-e2e-school',isPlatformAdmin:false,email:'admin@synthetic.invalid'},
  'foreign-school admin':{id:'f-admin',role:'ADMIN',schoolId:'g4-e2e-foreign-school',isPlatformAdmin:false,email:'f@synthetic.invalid'},
  'platform admin':{id:'p-admin',role:'ADMIN',schoolId:'g4-e2e-school',isPlatformAdmin:true,email:'p@synthetic.invalid'},
  student:{id:'stu',role:'STUDENT',schoolId:'g4-e2e-school',isPlatformAdmin:false,email:'s@synthetic.invalid'},
};
async function call(route:string,method:string){
  const mod=await import(`@/app/api/${route}/route`) as Record<string,Handler>;
  const body=JSON.stringify({email:'new@synthetic.invalid',name:'x',password:'synthetic-new-password-0123',role:'ADMIN',students:[],teachers:[],rows:[],batchId:'b',token:'t',code:'123456',userId:'u',schoolId:'g4-e2e-school'});
  const req=new Request(`https://preview.synthetic.invalid/api/${route.replace('[id]','x')}`,{method,headers:{'content-type':'application/json'},...(method==='GET'?{}:{body})});
  return mod[method](req,{params:{id:'x'}});
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');});
afterEach(()=>{vi.unstubAllEnvs();m.actor.current=null;});

describe('deployed Preview refuses every account-provisioning entry point by direct API call',()=>{
  for(const [actorName,actor] of Object.entries(ACTORS)){
    it.each(ROUTES)(`RED: ${actorName} → %s %s (%s) is frozen before data or provider work`,async(route,method)=>{
      vi.stubEnv('VERCEL_ENV','preview');m.actor.current=actor;
      const res=await call(route,method);
      // 403: the freeze, or (since Revision 3 orders it after authority) the route's own inline role/platform denial.
      expect(res.status).toBe(403);
      if(actor.role==='ADMIN'&&actor.isPlatformAdmin)expect((await res.json()).code).toBe('PREVIEW_IDENTITY_FROZEN');
      expect(m.db).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled();
    });
  }
  it.each(ROUTES)('unauthenticated → %s %s is refused without data work (401 from authority, or the public freeze)',async(route,method)=>{
    vi.stubEnv('VERCEL_ENV','preview');
    const res=await call(route,method);
    expect([401,403]).toContain(res.status);expect(m.db).not.toHaveBeenCalled();
  });
});

describe('Production and local behavior is unchanged',()=>{
  it.each(ROUTES)('Production %s %s is not frozen (reaches its own authority/validation)',async(route,method)=>{
    vi.stubEnv('VERCEL_ENV','production');
    const res=await call(route,method).catch(()=>null);
    const code=res?await res.clone().json().then((b:{code?:string})=>b.code,()=>undefined):undefined;
    expect(code).not.toBe('PREVIEW_IDENTITY_FROZEN');
  });
  it('local (no Vercel identity) is not frozen',async()=>{
    const res=await call('admin/interoperability/oneroster/import','POST').catch(()=>null);
    expect(res?await res.clone().json().then((b:{code?:string})=>b.code,()=>undefined):undefined).not.toBe('PREVIEW_IDENTITY_FROZEN');
    expect(m.auth).toHaveBeenCalled();
  });
});

// Own PIN/password changes are frozen on Preview since Revision 3 (T2 P2, CoS decision): see preview-identity-freeze-r3.test.ts.

describe('second inventory pass: identity creation behind non-obvious routes',()=>{
  it('RED: public school enrollment (creates a pending school ADMIN with a temporary password) is frozen',async()=>{
    vi.stubEnv('VERCEL_ENV','preview');
    const res=await call('enroll','POST');
    expect(res.status).toBe(403);expect((await res.json()).code).toBe('PREVIEW_IDENTITY_FROZEN');expect(m.db).not.toHaveBeenCalled();
  });
  const school=async(action:Record<string,unknown>)=>{
    const mod=await import('@/app/api/admin/school/route') as unknown as Record<string,Handler>;
    return mod.PATCH(new Request('https://preview.synthetic.invalid/api/admin/school',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(action)}),{params:{}});
  };
  it.each([
    [{action:'inviteTeacher',fullName:'Synthetic Teacher',email:'t@synthetic.invalid',phone:'0770000000',subjectSpecialty:'MATH'}],
    [{action:'deactivateTeacher',teacherId:'g4-e2e-teacher'}],
  ])('RED: school-admin PATCH %j is frozen in Preview after authentication',async action=>{
    vi.stubEnv('VERCEL_ENV','preview');m.actor.current=ACTORS['same-school admin'];
    const res=await school(action);
    expect(res.status).toBe(403);expect((await res.json()).code).toBe('PREVIEW_IDENTITY_FROZEN');expect(m.db).not.toHaveBeenCalled();
  });
  // createClass/moveStudent/updateProfile are frozen too since Revision 3 (B5): see preview-identity-freeze-r3.test.ts.
});

// The 5daefe7c string-presence completeness guard is replaced by the syntax-aware per-handler scanner:
// preview-identity-freeze-scanner.test.ts (T2 P1).
