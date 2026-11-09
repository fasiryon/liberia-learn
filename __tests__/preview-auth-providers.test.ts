import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/db',()=>({prisma:{}}));
beforeEach(()=>{vi.resetModules();for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','AUTH0_CLIENT_ID','AUTH0_CLIENT_SECRET','AUTH0_ISSUER'])vi.stubEnv(key,'');});
afterEach(()=>vi.unstubAllEnvs());
describe('Preview exposes only configured authentication providers',()=>{
  it.each([['',''],['synthetic-client',''],['','synthetic-secret'],[' ',' ']])('unconfigured OAuth is absent without affecting credentials',async(id,secret)=>{
    vi.stubEnv('GOOGLE_CLIENT_ID',id);vi.stubEnv('GOOGLE_CLIENT_SECRET',secret);
    const {authOptions}=await import('@/lib/auth');
    expect(authOptions.providers.some(provider=>'id' in provider&&provider.id==='google')).toBe(false);
    expect(authOptions.providers.some(provider=>'id' in provider&&provider.id==='credentials')).toBe(true);
  });
  it('preserves a properly configured Google provider',async()=>{
    vi.stubEnv('GOOGLE_CLIENT_ID','synthetic-client');vi.stubEnv('GOOGLE_CLIENT_SECRET','synthetic-secret');
    const {authOptions}=await import('@/lib/auth');
    expect(authOptions.providers.some(provider=>'id' in provider&&provider.id==='google')).toBe(true);
  });
});
