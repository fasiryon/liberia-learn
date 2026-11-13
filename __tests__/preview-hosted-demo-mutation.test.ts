/**
 * T1 hosted Preview readiness (2026-11-02). With DEMO_MODE=true a deployed Preview classifies as "demo", not
 * "staging", so the demo mutation routes pass their environment gate there (CI, without VERCEL_ENV, refuses them).
 * Today only absent DEMO_SCHOOL_IDS / ENABLE_MOE_PORTAL stop them from writing fabricated progress, mastery,
 * homework and attendance rows into the synthetic Preview. Deployed Preview must refuse them by identity.
 */
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

const routes=[['advance',()=>advance()],['simulate',()=>simulate()],['reset',()=>reset(new Request('http://localhost/api/demo/reset',{method:'POST'}))],['platform-reset',()=>platformReset()]] as const;
const platformAdmin={id:'synthetic-authority',role:'ADMIN',isPlatformAdmin:true,email:'authority@synthetic.invalid'};
beforeEach(()=>{
  vi.clearAllMocks();vi.stubGlobal('fetch',m.external);m.authority.mockResolvedValue(platformAdmin);
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('DEMO_MODE','true');vi.stubEnv('DEMO_SCHOOL_IDS','synthetic-demo-school');
  vi.stubEnv('ENABLE_MOE_PORTAL','true');vi.stubEnv('ALLOW_LIVE_DEMO_RESET','false');
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe('deployed Preview refuses demo data mutation even for a platform admin with demo config present',()=>{
  it.each(routes)('RED: %s is refused on VERCEL_ENV=preview before any data or external work',async(_name,route)=>{
    vi.stubEnv('VERCEL_ENV','preview');
    const result=await route();
    expect(result.status).toBe(403);
    expect(m.database).not.toHaveBeenCalled();expect(m.external).not.toHaveBeenCalled();
  });
  it.each(routes)('Production refusal of %s is unchanged',async(_name,route)=>{
    vi.stubEnv('VERCEL_ENV','production');
    expect((await route()).status).toBe(403);expect(m.database).not.toHaveBeenCalled();
  });
  it.each(routes)('control: local demo (no Vercel identity) still reaches authority for %s',async(_name,route)=>{
    vi.stubEnv('NODE_ENV','development');
    m.authority.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'),{status:401}));
    await route();
    expect(m.authority).toHaveBeenCalledOnce();
  });
});
