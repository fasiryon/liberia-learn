import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {createBackend} from '@/lib/rateLimit';
const runtime={test:false,vitest:false,build:false};
beforeEach(()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','');vi.stubEnv('VERCEL','');
  vi.stubEnv('CI','');vi.stubEnv('E2E_SYNTHETIC','');vi.stubEnv('DEMO_MODE','true');
  vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','');
  vi.stubEnv('DATABASE_URL','');vi.stubEnv('DIRECT_URL','');
});
afterEach(()=>vi.unstubAllEnvs());
describe('Preview and explicit disposable E2E auth rate limits without production Redis',()=>{
  it.each(['preview','staging'])('%s production builds use a bounded local limiter rather than failing login',async target=>{
    vi.stubEnv('VERCEL_ENV',target);
    const backend=createBackend(runtime);
    expect((await backend.increment(`synthetic-${target}`,60000,1)).allowed).toBe(true);
    expect((await backend.increment(`synthetic-${target}`,60000,1)).allowed).toBe(false);
  });
  it('only the exact synthetic CI database gets the standalone test fallback',()=>{
    vi.stubEnv('CI','true');vi.stubEnv('E2E_SYNTHETIC','1');
    vi.stubEnv('DATABASE_URL','postgresql://postgres:postgres@localhost:5432/e2e');
    vi.stubEnv('DIRECT_URL','postgresql://postgres:postgres@localhost:5432/e2e');
    expect(()=>createBackend(runtime)).not.toThrow();
  });
  it.each(['production',''])('a production target or plain production build %j still requires Redis regardless of DEMO_MODE',target=>{
    vi.stubEnv('VERCEL_ENV',target);
    expect(()=>createBackend(runtime)).toThrow('UPSTASH_REDIS_REST_URL');
  });
  it('production wins even over all synthetic flags and a loopback URL',()=>{
    vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('CI','true');vi.stubEnv('E2E_SYNTHETIC','1');
    vi.stubEnv('DATABASE_URL','postgresql://postgres:postgres@localhost:5432/e2e');vi.stubEnv('DIRECT_URL','postgresql://postgres:postgres@localhost:5432/e2e');
    expect(()=>createBackend(runtime)).toThrow('UPSTASH_REDIS_REST_URL');
  });
  it.each(['postgresql://postgres:postgres@localhost:5432/production','postgresql://postgres:postgres@remote.invalid/e2e'])('synthetic flags do not admit another database',url=>{
    vi.stubEnv('CI','true');vi.stubEnv('E2E_SYNTHETIC','1');vi.stubEnv('DATABASE_URL',url);vi.stubEnv('DIRECT_URL',url);
    expect(()=>createBackend(runtime)).toThrow('UPSTASH_REDIS_REST_URL');
  });
});
