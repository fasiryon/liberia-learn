import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GRADE4_SCHOOLDAY_ACCEPTED} from '@/lib/curriculum/v4/schooldayPackage';
function evaluateConfig(env:Record<string,string>){
  const source=readFileSync('next.config.js','utf8');
  const requireStub=(name:string)=>{
    if(name==='@sentry/nextjs')return {withSentryConfig:(config:unknown)=>config};
    if(name==='next-intl/plugin')return ()=>((config:unknown)=>config);
    if(name==='./lib/validateEnv.shared.js')return {validateBuildEnv:()=>{}};
    if(name==='./curriculum/program/stem-v1/resolved-days/g4-day1.json')return JSON.parse(readFileSync(name,'utf8'));
    throw Error('unexpected_config_dependency');
  };
  return vm.runInNewContext(source,{process:{env},require:requireStub,module:{exports:{}}});
}
describe('production DEMO_MODE build boundary, independent of dormant instrumentation',()=>{
  it.each(['true','false'])('production refuses demo mode even when SKIP_ENV_VALIDATION=%s',skip=>{
    expect(()=>evaluateConfig({VERCEL_ENV:'production',DEMO_MODE:'true',SKIP_ENV_VALIDATION:skip})).toThrow('DEMO_MODE cannot be enabled for a Production build');
  });
  it('a NODE_ENV override cannot bypass the deployment boundary',()=>{
    expect(()=>evaluateConfig({VERCEL_ENV:'production',NODE_ENV:'development',DEMO_MODE:'true',SKIP_ENV_VALIDATION:'true'})).toThrow('DEMO_MODE cannot be enabled for a Production build');
  });
  it.each([
    {VERCEL_ENV:'preview',DEMO_MODE:'true'},
    {VERCEL_ENV:'production',DEMO_MODE:'false'},
    {DEMO_MODE:'true'},
  ])('permits permitted non-production demo or production non-demo config %j',env=>{
    expect(()=>evaluateConfig({...env,SKIP_ENV_VALIDATION:'true'})).not.toThrow();
  });
  it('traces the exact eight accepted Grade 4 package directories on every delivery entry point',()=>{
    const config=evaluateConfig({VERCEL_ENV:'preview',DEMO_MODE:'true',SKIP_ENV_VALIDATION:'true'});
    const expected=Object.keys(GRADE4_SCHOOLDAY_ACCEPTED).map(selection=>`./curriculum/factory-v4/drafts/${selection.split('@')[1]}/**/*`);
    for(const route of ['/learn/preview/*','/learn/day','/api/student/learning-preview/*']){
      const paths=config.experimental.outputFileTracingIncludes[route];
      expect(paths.filter((path:string)=>path.includes('schoolday-')).sort()).toEqual(expected.sort());
    }
  });
});
