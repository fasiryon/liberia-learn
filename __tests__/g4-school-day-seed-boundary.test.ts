import {describe,it,expect} from 'vitest';
import {requireSyntheticSchoolDayDatabase,syntheticCredentials} from '@/scripts/e2e/school-day-contract';
const env:NodeJS.ProcessEnv={NODE_ENV:'test',CI:'true',E2E_SYNTHETIC:'1',DATABASE_URL:'postgresql://postgres:postgres@localhost:5432/e2e'};
describe('synthetic school-day database boundary',()=>{
  it('accepts only the agreed disposable fixture URL',()=>expect(requireSyntheticSchoolDayDatabase(env)).toBe(env.DATABASE_URL));
  it.each([
    {CI:undefined},{E2E_SYNTHETIC:undefined},{VERCEL_ENV:'preview'},{VERCEL_ENV:'production'},
    {VERCEL:'1'},{DATABASE_URL:'postgresql://postgres:postgres@db.example/e2e'},
    {DATABASE_URL:'postgresql://postgres:postgres@localhost:5432/production'},
    {DATABASE_URL:'postgresql://postgres:postgres@localhost:5432/e2e?host=prod'},
    {DIRECT_URL:'postgresql://postgres:postgres@localhost:5432/production'},
  ] satisfies Array<Partial<NodeJS.ProcessEnv>>)('refuses unsafe overrides %j before opening a client',override=>expect(()=>requireSyntheticSchoolDayDatabase({...env,...override})).toThrow());
  it('does not disclose malformed generated credentials in validation errors',()=>{
    const privateFixture='private-fixture-value-not-for-error-output';
    try{syntheticCredentials({NODE_ENV:'test',G4_SYNTHETIC_PASSWORDS:privateFixture});throw Error('expected credential refusal');}
    catch(error){expect(error instanceof Error?error.message:'').toBe('school_day_generated_credentials_required');}
  });
});
