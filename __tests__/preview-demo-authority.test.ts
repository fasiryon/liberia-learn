import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({authority:vi.fn(),database:vi.fn(),external:vi.fn()}));
vi.mock('@/lib/moeAccess',()=>({requireMoePlatformAdmin:m.authority}));
vi.mock('@/lib/auth',()=>({requireUser:m.authority}));
vi.mock('@/scripts/seed-demo',()=>({SCHOOL_DEFS:[{id:'synthetic-demo-school'}],seedNationalDemo:m.external}));
vi.mock('@/lib/db',()=>({prisma:new Proxy({}, {get(){m.database();throw Error('unexpected_database_access');}})}));
import {POST as advance} from '@/app/api/platform/demo/advance-day/route';
import {POST as simulate} from '@/app/api/platform/demo/simulate-activity/route';
import {POST as reset} from '@/app/api/demo/reset/route';
import {POST as platformReset} from '@/app/api/platform/demo/reset/route';
describe('demo mode is not authentication, role authority or permission to perform side effects',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('DEMO_MODE','true');
    vi.stubEnv('DEMO_SCHOOL_IDS','synthetic-demo-school');vi.stubEnv('ALLOW_LIVE_DEMO_RESET','false');
    vi.stubGlobal('fetch',m.external);
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it.each([['advance',()=>advance()],['simulate',()=>simulate()],['reset',()=>reset(new Request('http://localhost/api/demo/reset',{method:'POST'}))],['platform-reset',()=>platformReset()]] as const)('%s still checks authority and performs no data or external work when refused',async(_name,route)=>{
    m.authority.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'),{status:401}));
    const result=await route();
    expect(result.status).toBe(401);expect(m.authority).toHaveBeenCalledOnce();
    expect(m.database).not.toHaveBeenCalled();expect(m.external).not.toHaveBeenCalled();
  });
  it('a logged-in student is not granted platform authority by demo mode',async()=>{
    m.authority.mockResolvedValueOnce({id:'synthetic-student',role:'STUDENT',isPlatformAdmin:false});
    const result=await reset(new Request('http://localhost/api/demo/reset',{method:'POST'}));
    expect(result.status).toBe(403);expect(m.database).not.toHaveBeenCalled();expect(m.external).not.toHaveBeenCalled();
  });
});
