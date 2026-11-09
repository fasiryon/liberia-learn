import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({release:vi.fn(),guardians:vi.fn()}));
vi.mock('@/lib/ai/staleGradeReleaser',()=>({releaseStaleAIGrades:m.release}));
vi.mock('@/lib/db',()=>({prisma:{user:{findMany:m.guardians}}}));
vi.mock('@/lib/guardian/sms-service',()=>({sendGuardianSMS:vi.fn()}));
vi.mock('@/lib/notifications/guardianDigest',()=>({composeGuardianDigest:vi.fn(),mostRecentWeekWindow:()=>({weekStart:new Date(0),weekEnd:new Date(0)})}));
vi.mock('@/lib/logger',()=>({logger:{info:vi.fn(),error:vi.fn(),warn:vi.fn()}}));
import {POST as release} from '@/app/api/cron/release-stale-grades/route';
import {GET as digest} from '@/app/api/cron/guardian-weekly-digest/route';
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('DEMO_MODE','true');vi.stubEnv('CRON_SECRET',undefined);m.release.mockResolvedValue({released:0});m.guardians.mockResolvedValue([]);});
afterEach(()=>vi.unstubAllEnvs());
describe('Atlas Preview cron no-side-effects contract',()=>{
  it.each([['release',()=>release(new Request('http://local.invalid/api/cron/release-stale-grades') as never)],['digest',()=>digest(new Request('http://local.invalid/api/cron/guardian-weekly-digest'))]] as const)('RED: absent cron credentials refuse %s before work',async(_name,route)=>{
    const response=await route();
    expect.soft(response.status).toBe(401);
    expect.soft(m.release).not.toHaveBeenCalled();expect.soft(m.guardians).not.toHaveBeenCalled();
  });
  it.each([['release',()=>release(new Request('http://local.invalid/api/cron/release-stale-grades') as never)],['digest',()=>digest(new Request('http://local.invalid/api/cron/guardian-weekly-digest'))]] as const)('control: configured secret still refuses wrong credentials for %s',async(_name,route)=>{
    vi.stubEnv('CRON_SECRET','synthetic-unit-only-secret');
    expect((await route()).status).toBe(401);expect(m.release).not.toHaveBeenCalled();expect(m.guardians).not.toHaveBeenCalled();
  });
});
