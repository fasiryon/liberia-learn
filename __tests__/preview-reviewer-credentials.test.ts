import {afterEach,describe,expect,it,vi} from 'vitest';
import {seedSchoolDay} from '@/scripts/e2e/seed-school-day';
import identities from '@/scripts/e2e/school-day-identities.json';
import {readFileSync} from 'node:fs';
import {assertReviewerAccounts,writeReviewerCredentials} from '@/scripts/preview/reviewer-credentials.mjs';

afterEach(()=>vi.unstubAllEnvs());
const passwords=Object.fromEntries(Object.keys(identities.SCHOOL_DAY_EMAILS).map(key=>[key,`test-only-${key}-credential-with-enough-length`]));

describe('K2 hosted reviewer credential scope',()=>{
  const accounts=()=>[[identities.SCHOOL_DAY_IDS.studentUser,'STUDENT'],[identities.SCHOOL_DAY_IDS.teacher,'TEACHER'],[identities.SCHOOL_DAY_IDS.admin,'ADMIN']].map(([id,role])=>({id,role,schoolId:identities.SCHOOL_DAY_IDS.school,isPlatformAdmin:false,hashedPwd:'test-only-hash'}));
  it('requires all three non-platform reviewer roles before allowing credential delivery',()=>{
    expect(()=>assertReviewerAccounts(accounts())).not.toThrow();
    for(const drift of [{role:'ADMIN'},{schoolId:'foreign-school'},{isPlatformAdmin:true},{hashedPwd:null}]){
      const rows=accounts();Object.assign(rows[0],drift);
      expect(()=>assertReviewerAccounts(rows)).toThrow('preview_reviewer_scope_failed');
    }
    expect(()=>assertReviewerAccounts(accounts().slice(1))).toThrow('preview_reviewer_scope_failed');
  });
  it('operator entrypoint uses the restricted writer and refuses old unscoped completion receipts',()=>{
    const source=readFileSync('scripts/preview/setup-preview-db.mjs','utf8');
    expect(source).toContain('writeReviewerCredentials(line=>writeFileSync(operatorFd,line),passwords)');
    expect(source).toContain('prior.credentialScope===PREVIEW_CREDENTIAL_SCOPE');
    expect(source).not.toContain('`${SCHOOL_DAY_EMAILS[key]}  ${passwords[key]}');
  });
  it('writes exactly student, teacher and school-admin credentials to the supplied operator writer',()=>{
    const operator=vi.fn();
    expect(writeReviewerCredentials(operator,passwords)).toBeUndefined();
    const output=operator.mock.calls.map(([line])=>line).join('');
    expect(operator).toHaveBeenCalledTimes(3);
    for(const key of ['student','teacher','admin'] as const){
      expect(output).toContain(identities.SCHOOL_DAY_EMAILS[key]);
      expect(output).toContain(passwords[key]);
    }
    for(const key of ['authority','foreignTeacher','student2','student3'] as const){
      expect(output).not.toContain(identities.SCHOOL_DAY_EMAILS[key]);
      expect(output).not.toContain(passwords[key]);
    }
  });

  it.each(['preview','ci'])('%s seed preserves reviewer roles and approval authority; hosted authority has no password',async mode=>{
    vi.stubEnv('G4_SYNTHETIC_PASSWORDS',JSON.stringify(passwords));
    vi.stubEnv('VERCEL','');vi.stubEnv('VERCEL_ENV','');
    vi.stubEnv('CI',mode==='ci'?'true':'');
    vi.stubEnv('E2E_SYNTHETIC','1');
    vi.stubEnv('SYNTHETIC_PREVIEW_SEED',mode==='preview'?'1':'0');
    const ref='previewsyntheticrefz',secret='test-only-preview-role-password';
    vi.stubEnv('PREVIEW_PINNED_PROJECT_REF',ref);vi.stubEnv('PREVIEW_SUPABASE_PROJECT_REF',ref);vi.stubEnv('PREVIEW_DB_ROLE','preview_app');vi.stubEnv('PREVIEW_DB_PASSWORD',secret);
    vi.stubEnv('DATABASE_URL',mode==='preview'?`postgresql://preview_app.${ref}:${secret}@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`:'postgresql://postgres:postgres@localhost:5432/e2e');
    vi.stubEnv('DIRECT_URL',mode==='preview'?`postgresql://preview_app.${ref}:${secret}@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require`:process.env.DATABASE_URL);
    const users:any[]=[];
    const db:any={$executeRaw:async()=>0,$queryRaw:async()=>[{database:mode==='preview'?'postgres':'e2e',username:mode==='preview'?'preview_app':'postgres'}],$transaction:async(fn:any)=>fn(db)};
    for(const name of ['school','user','dataPolicyAcceptance','teacherProfile','student','class','enrollment','assignment','attendance','timetable','policyConfig','auditLog']){
      db[name]={count:async()=>0,upsert:vi.fn(async(args:any)=>{if(name==='user')users.push(args);return args.create;})};
    }
    db.grade={count:async()=>0};db.masteryRecord={count:async()=>0};
    await seedSchoolDay(db,new Date('2026-11-02T09:00:00Z'));
    const authority=users.find(u=>u.create.id===identities.SCHOOL_DAY_IDS.authority);
    expect(authority.create.isPlatformAdmin).toBe(true); // Approval metadata, never a hosted reviewer login.
    for(const branch of ['create','update']){
      if(mode==='preview')expect(authority[branch].hashedPwd).toBeNull();
      else expect(authority[branch].hashedPwd).toMatch(/^\$2/);
    }
    for(const [id,role] of [[identities.SCHOOL_DAY_IDS.studentUser,'STUDENT'],[identities.SCHOOL_DAY_IDS.teacher,'TEACHER'],[identities.SCHOOL_DAY_IDS.admin,'ADMIN']]){
      const row=users.find(u=>u.create.id===id).create;
      expect(row).toMatchObject({role,schoolId:identities.SCHOOL_DAY_IDS.school,isPlatformAdmin:false});
      expect(row.hashedPwd).toMatch(/^\$2/);
    }
    expect(users).toHaveLength(7);
    expect(db.timetable.upsert).toHaveBeenCalledTimes(8);
    expect(db.auditLog.upsert).toHaveBeenCalledTimes(8);
  });
});
