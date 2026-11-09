import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const token=vi.hoisted(()=>vi.fn());
vi.mock('next-auth/jwt',()=>({getToken:token}));
import {middleware} from '@/middleware';
import {previewAutomationDisabled,isCronNamespace} from '@/lib/previewSideEffects';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('DEMO_MODE','true');});
afterEach(()=>vi.unstubAllEnvs());
describe('Preview cron namespaces fail closed before application/session work',()=>{
  it.each(['/api/cron/release-stale-grades','/api/cron/agents/tick','/api/crons/league-snapshot','/api/%63ron/guardian-weekly-digest'])('refuses %s before the public-path exemption',async path=>{
    const result=await middleware(new NextRequest('https://preview.synthetic.invalid'+path));
    expect(result.status).toBe(401);expect(result.headers.get('cache-control')).toContain('no-store');expect(token).not.toHaveBeenCalled();
  });
  it('production identity is not disabled by DEMO_MODE',()=>expect(previewAutomationDisabled({VERCEL_ENV:'production',DEMO_MODE:'true'})).toBe(false));
  it('matches only the two cron namespaces',()=>{
    expect(isCronNamespace('/api/crons')).toBe(true);expect(isCronNamespace('/api/cronish/example')).toBe(false);expect(isCronNamespace('/api/student/learning-preview')).toBe(false);
  });
});
