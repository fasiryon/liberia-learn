import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({actor:null as any,auth:vi.fn(),read:vi.fn(),write:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireRole:async(role:string)=>{m.auth();if(!m.actor)throw Object.assign(Error('Unauthorized'),{status:401});if(m.actor.role!==role)throw Object.assign(Error('Forbidden'),{status:403});return m.actor;}}));
vi.mock('@/lib/db',()=>({prisma:{student:{findFirst:async()=>{m.read();return {id:'review-student',placementTests:[]};}},user:{findUnique:async()=>{m.read();return {hashedPwd:'test-only-hash'};},update:async()=>{m.write();return {};}},school:{update:async()=>{m.write();return {};}}}}));
vi.mock('@/lib/audit',()=>({logAudit:async()=>m.audit()}));
vi.mock('bcryptjs',()=>({default:{hash:async()=> 'test-only-hash',compare:async()=>true}}));
vi.mock('@/lib/school-operations',()=>({inviteTeacherToSchool:async()=>m.write(),deactivateTeacherForSchool:async()=>m.write(),createClassForSchool:async()=>m.write(),moveStudentBetweenClasses:async()=>m.write(),getPrincipalSchoolDashboard:async()=>m.read()}));
import {POST as pin} from '@/app/api/student/change-pin/route';
import {PATCH as password} from '@/app/api/teacher/change-password/route';
import {PATCH as school} from '@/app/api/admin/school/route';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','preview');});
afterEach(()=>{vi.unstubAllEnvs();m.actor=null;});
const request=(method:string,body:any)=>new Request('https://synthetic-review.invalid/api/review',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
describe('independent direct-handler policy probes',()=>{
  it('reproduces that a synthetic student can currently change its own Preview PIN',async()=>{
    m.actor={id:'review-student',role:'STUDENT',schoolId:'synthetic-school'};
    const result=await pin(request('POST',{pin:'2468',confirmPin:'2468'}));
    expect(result.status).toBe(200);expect(m.write).toHaveBeenCalledOnce();
  });
  it('reproduces that a synthetic teacher can currently change its own Preview password',async()=>{
    m.actor={id:'review-teacher',role:'TEACHER',schoolId:'synthetic-school'};
    const result=await password(request('PATCH',{currentPassword:'test-only-current',newPassword:'test-only-next-password'}));
    expect(result.status).toBe(200);expect(m.write).toHaveBeenCalledOnce();
  });
  it.each([{actor:null,status:401},{actor:{id:'student',role:'STUDENT',schoolId:'synthetic-school'},status:403}])('admin/school rejects unauthorized callers before body-driven service work (%#)',async({actor,status})=>{
    m.actor=actor;const result=await school(request('PATCH',{action:'inviteTeacher',fullName:'Synthetic Teacher',email:'teacher@synthetic.invalid'}));
    expect(result.status).toBe(status);expect(m.read).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
  });
  it.each(['same-school','foreign-school'])('admin/school freezes the authenticated %s admin before any school service work',async schoolId=>{
    m.actor={id:'review-admin',role:'ADMIN',schoolId};const result=await school(request('PATCH',{action:'inviteTeacher',fullName:'Synthetic Teacher',email:'teacher@synthetic.invalid'}));
    expect(result.status).toBe(403);expect((await result.json()).code).toBe('PREVIEW_IDENTITY_FROZEN');expect(m.auth).toHaveBeenCalledOnce();expect(m.read).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
  });
  it('reproduces raw authorization/freshness error disclosure before admin/school reaches the freeze',async()=>{
    m.actor={id:'review-admin',role:'ADMIN',schoolId:'synthetic-school'};
    m.auth.mockImplementationOnce(()=>{throw Error('sensitive-auth-database-detail');});
    const result=await school(request('PATCH',{action:'inviteTeacher',fullName:'Synthetic Teacher',email:'teacher@synthetic.invalid'}));
    expect(result.status).toBe(500);expect((await result.json()).error).toBe('sensitive-auth-database-detail');
    expect(m.write).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
  });
});
