/** Disposable CI fixture contract. These identities are never real pilot approvals. */
import {z} from 'zod';
import identities from './school-day-identities.json';
import {validatePreviewTarget} from '../preview/preview-target.mjs';
export const SYNTHETIC_MARKER = 'SYNTHETIC G4 E2E ONLY';
export const SCHOOL_DAY_IDS = identities.SCHOOL_DAY_IDS;
export const SCHOOL_DAY_EMAILS = identities.SCHOOL_DAY_EMAILS;
const credentialSchema=z.object({student:z.string().min(24),teacher:z.string().min(24),foreignTeacher:z.string().min(24),authority:z.string().min(24),admin:z.string().min(24),student2:z.string().min(24),student3:z.string().min(24)}).strict();
export function syntheticCredentials(env:NodeJS.ProcessEnv=process.env){
  try{return credentialSchema.parse(JSON.parse(env.G4_SYNTHETIC_PASSWORDS||''));}
  catch{throw Error('school_day_generated_credentials_required');}
}
export function syntheticPasswordForEmail(email:string){
  const credentials=syntheticCredentials();
  for(const key of credentialSchema.keyof().options)if(SCHOOL_DAY_EMAILS[key]===email)return credentials[key];
  throw Error('school_day_unknown_synthetic_identity');
}

export function requireSyntheticSchoolDayDatabase(env: NodeJS.ProcessEnv): string {
  if (env.E2E_SYNTHETIC !== '1' || env.CI !== 'true' || env.VERCEL_ENV || env.VERCEL)
    throw Error('school_day_requires_disposable_ci');
  const raw = env.DATABASE_URL;
  if (!raw) throw Error('school_day_database_required');
  const url = new URL(raw);
  if (url.protocol !== 'postgresql:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
      (url.port || '5432') !== '5432' || url.pathname !== '/e2e' || url.username !== 'postgres' ||
      url.password !== 'postgres' || url.search || url.hash)
    throw Error('school_day_database_not_disposable');
  if (env.DIRECT_URL && env.DIRECT_URL !== raw) throw Error('school_day_direct_database_mismatch');
  return raw;
}
export function syntheticSeedTarget(env:NodeJS.ProcessEnv=process.env){
  if(env.SYNTHETIC_PREVIEW_SEED==='1'){
    const target=validatePreviewTarget(env);
    return {url:target.directUrl,database:target.database,username:target.role,mode:'preview' as const};
  }
  return {url:requireSyntheticSchoolDayDatabase(env),database:'e2e',username:'postgres',mode:'ci' as const};
}
