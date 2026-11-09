/**
 * T1 hosted Preview readiness (2026-11-02): failure paths a hosted Preview can receive that local CI does not.
 * Synthetic hostnames and tokens only; no network.
 */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const token=vi.hoisted(()=>vi.fn());
vi.mock('next-auth/jwt',()=>({getToken:token}));
import {middleware} from '@/middleware';
import {isCronNamespace} from '@/lib/previewSideEffects';

const host='https://liberia-learn-preview-synthetic.vercel.app';
beforeEach(()=>{vi.clearAllMocks();token.mockResolvedValue(null);vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('V4_LEARNING_PREVIEW_ENABLED','1');});
afterEach(()=>vi.unstubAllEnvs());

describe('cron namespace refusal fails closed on undecodable paths',()=>{
  it.each(['/api/cron/agents/tick%','/api/cron/%E0%A4%A','/api/crons/league-snapshot%ZZ'])('RED: %s is still a cron path',path=>{
    expect(isCronNamespace(path)).toBe(true);
  });
  it.each(['/api/cron/agents/tick%','/api/crons/league-snapshot%ZZ'])('RED: Preview middleware refuses %s before the cron bypass',async path=>{
    const result=await middleware(new NextRequest(host+path));
    expect(result.status).toBe(401);
    expect(result.headers.get('x-middleware-next')).toBeNull();
  });
  it.each(['/api/%2563ron/agents/tick','/API/CRON/agents/tick','/api/cron%2Fagents%2Ftick'])('guard: %s never reaches the unauthenticated cron bypass',async path=>{
    const result=await middleware(new NextRequest(host+path));
    expect(result.status).toBe(401);
    expect(result.headers.get('x-middleware-next')).toBeNull();
  });
  it('undecodable non-cron paths are not reclassified',()=>{
    expect(isCronNamespace('/learn/day%')).toBe(false);
    expect(isCronNamespace('/api/cronish%')).toBe(false);
  });
});

describe('wrong or missing identity on the hosted pilot namespace',()=>{
  it.each(['/learn/day','/learn/preview/x','/api/student/learning-preview/x'])('unauthenticated %s never reaches the page',async path=>{
    const result=await middleware(new NextRequest(host+path));
    expect(result.headers.get('x-middleware-next')).toBeNull();
    expect([302,307,401]).toContain(result.status);
  });
  it.each([['TEACHER','/learn/day'],['ADMIN','/learn/day']])('a %s session is not redirected into a student portal page by middleware',async(role,path)=>{
    // integration/g4-day: a current-contract token (U1 refuses tokens without numeric authTime/credStamp). Assertion unchanged.
    token.mockResolvedValue({id:'synthetic',role,schoolId:'synthetic-school',authTime:Date.now()-60_000,credStamp:0});
    const result=await middleware(new NextRequest(host+path));
    // The page itself requires STUDENT (requireRole) and 404s otherwise; middleware only authenticates.
    expect(result.status).toBe(200);
  });
  it.each([undefined,'0','true'])('the pilot namespace is concealed when the flag is %s, before any token read',async value=>{
    vi.stubEnv('V4_LEARNING_PREVIEW_ENABLED',value as string);
    const result=await middleware(new NextRequest(host+'/learn/day'));
    expect(result.status).toBe(404);expect(token).not.toHaveBeenCalled();
  });
});

describe('dev-only review surfaces are absent on a hosted deployment',()=>{
  it.each(['/lab-review','/lab-review/v4-day/4','/curriculum-candidates/x.svg','/curriculum-%63andidates/x.svg'])('%s is a 404 on Vercel even with the harness flag',async path=>{
    vi.stubEnv('VERCEL','1');vi.stubEnv('LAB_REVIEW_HARNESS','1');
    token.mockResolvedValue({id:'synthetic',role:'ADMIN',isPlatformAdmin:true});
    const result=await middleware(new NextRequest(host+path));
    expect(result.status).toBe(404);
  });
});
