import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {seedSchoolDay} from '@/scripts/e2e/seed-school-day';
import {resolvePilotDay} from '@/lib/curriculum/v4/pilotDay';
import {GRADE4_SCHOOLDAY_ACCEPTED} from '@/lib/curriculum/v4/schooldayPackage';
import {SCHOOL_DAY_IDS as ids,SCHOOL_DAY_EMAILS as emails} from '@/scripts/e2e/school-day-contract';
import {reanchorPreviewDay} from '@/scripts/preview/reanchor-preview-day';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// Transaction model with snapshot rollback, populated by the real seed. No database connection.
async function fixture(){
  const tables:Record<string,any[]>={};
  const match=(row:any,where:any):boolean=>!where||Object.entries(where).every(([key,value]:any)=>{
    if(key==='OR')return value.some((clause:any)=>match(row,clause));
    if(key==='studentId_classId')return match(row,value);
    if(key==='class')return match(tables.class.find(c=>c.id===row.classId),value);
    if(value&&typeof value==='object'&&'in' in value)return value.in.includes(row[key]);
    if(value&&typeof value==='object'&&'not' in value)return row[key]!==value.not;
    return row[key]===value;
  });
  const db:any={$executeRaw:vi.fn(async()=>0),$queryRaw:vi.fn(async()=>[{database:'postgres',username:'preview_app',superuser:false,createdb:false,createrole:false,bypassrls:false,replication:false}])};
  for(const model of ['school','user','dataPolicyAcceptance','teacherProfile','student','class','enrollment','assignment','attendance','timetable','policyConfig','auditLog']){
    tables[model]=[];
    const enrich=(row:any)=>{
      if(!row)return null;
      if(model==='user'){
        const student=tables.student.find(s=>s.userId===row.id);
        return {...row,school:tables.school.find(s=>s.id===row.schoolId),student:student?{...student,academicEnrollments:[],enrollments:tables.enrollment.filter(e=>e.studentId===student.id).map(e=>({Class:tables.class.find(c=>c.id===e.classId)}))}:null};
      }
      if(model==='policyConfig')return {...row,createdBy:tables.user.find(u=>u.id===row.createdById)};
      return row;
    };
    db[model]={
      upsert:vi.fn(async({where,create,update}:any)=>{let row=tables[model].find(r=>match(r,where));if(row)Object.assign(row,update);else{row={isActive:true,deletedAt:null,...create};tables[model].push(row);}return row;}),
      findUnique:vi.fn(async({where}:any)=>enrich(tables[model].find(r=>match(r,where)))),
      findMany:vi.fn(async({where}:any={})=>tables[model].filter(r=>match(r,where)).map(enrich)),
      count:vi.fn(async({where}:any={})=>tables[model].filter(r=>match(r,where)).length),
      update:vi.fn(async({where,data}:any)=>{const row=tables[model].find(r=>match(r,where));if(!row)throw Error('model_missing');Object.assign(row,data);return row;}),
      updateMany:vi.fn(async({where,data}:any)=>{const rows=tables[model].filter(r=>match(r,where));for(const row of rows)Object.assign(row,data);return {count:rows.length};}),
      create:vi.fn(async({data}:any)=>{tables[model].push(data);return data;}),
    };
  }
  db.grade={count:async()=>0};db.masteryRecord={count:async()=>0};
  db.$transaction=vi.fn(async(fn:any)=>{const saved=structuredClone(tables);try{return await fn(db);}catch(error){for(const key of Object.keys(tables))tables[key]=saved[key];throw error;}});
  await seedSchoolDay(db,new Date('2026-11-02T09:00:00Z'));
  for(const model of Object.keys(tables))for(const fn of Object.values(db[model]) as any[])fn.mockClear();
  db.$transaction.mockClear();
  return {db,tables,user:tables.user.find(u=>u.id===ids.studentUser)};
}
const input={schoolId:ids.school,classId:ids.class,date:'2026-11-12'}; // Thursday, ten days after Monday seed.
beforeEach(()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-02T09:00:00Z'));
  vi.stubEnv('CI','');vi.stubEnv('VERCEL','');vi.stubEnv('VERCEL_ENV','');vi.stubEnv('SYNTHETIC_PREVIEW_SEED','1');
  vi.stubEnv('PREVIEW_PINNED_PROJECT_REF','previewsyntheticrefz');vi.stubEnv('PREVIEW_SUPABASE_PROJECT_REF','previewsyntheticrefz');vi.stubEnv('PREVIEW_DB_ROLE','preview_app');
  vi.stubEnv('PREVIEW_DB_PASSWORD','test-only-preview-password-long');
  vi.stubEnv('DATABASE_URL','postgresql://preview_app.previewsyntheticrefz:test-only-preview-password-long@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true');
  vi.stubEnv('DIRECT_URL','postgresql://preview_app.previewsyntheticrefz:test-only-preview-password-long@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require');
  vi.stubEnv('G4_SYNTHETIC_PASSWORDS',JSON.stringify(Object.fromEntries(Object.keys(emails).map(key=>[key,`test-only-${key}-password-with-sufficient-length`]))));
});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe('PV-05 isolated synthetic day re-anchor',()=>{
  it('CLI refuses tool pipes before reading even an explicit missing credentials file',()=>{
    const run=spawnSync(process.execPath,[resolve('scripts/preview/reanchor-preview-day-cli.mjs'),'--credentials-file','missing-private-env-file','--school',ids.school,'--section',ids.class,'--date',input.date,'--operator-console'],{encoding:'utf8'});
    expect({status:run.status,stderr:run.stderr.trim()}).toEqual({status:1,stderr:'preview_reanchor_private_operator_console_required'});expect(run.stdout).toBe('');
    expect(run.stderr).not.toContain(process.env.PREVIEW_DB_PASSWORD!);
  });
  it('refuses duplicate Preview bootstrap without rotating credentials or updating audit history',async()=>{
    const {db,tables}=await fixture();const before=structuredClone(tables);
    await expect(seedSchoolDay(db,new Date('2026-11-03T09:00:00Z'))).rejects.toThrow('school_day_preview_already_initialized');
    expect(tables).toEqual(before);expect(db.user.upsert).not.toHaveBeenCalled();expect(db.auditLog.upsert).not.toHaveBeenCalled();
  });
  it('admits all eight sealed lessons on another weekday after original expiry, with no roster/record/credential changes',async()=>{
    const {db,tables,user}=await fixture();
    const date=new Date('2026-11-12T09:00:00Z');
    expect(await resolvePilotDay(db,user,date,date.getTime(),{V4_LEARNING_PREVIEW_ENABLED:'1'})).toBeNull();
    const preserved=structuredClone(Object.fromEntries(Object.entries(tables).filter(([key])=>!['timetable','policyConfig','auditLog'].includes(key))));
    const oldAudits=structuredClone(tables.auditLog);
    const oldApprovals=structuredClone(tables.policyConfig.filter(p=>p.id!==ids.policy));
    const result=await reanchorPreviewDay(db,input);
    const day=await resolvePilotDay(db,user,date,date.getTime(),{V4_LEARNING_PREVIEW_ENABLED:'1'});
    expect(day?.periods.map(p=>p.status==='ADMITTED'?p.packageHash:p.status)).toEqual(Object.values(GRADE4_SCHOOLDAY_ACCEPTED));
    expect(tables.timetable).toHaveLength(8);
    expect(tables.timetable.every(t=>t.dayOfWeek==='THURSDAY')).toBe(true);
    for(const [key,rows] of Object.entries(preserved))expect(tables[key]).toEqual(rows);
    expect(tables.auditLog.slice(0,8)).toEqual(oldAudits);
    for(const old of oldApprovals){
      const row=tables.policyConfig.find(p=>p.id===old.id);
      expect(row.config).toEqual(old.config);expect(row.isActive).toBe(false);
    }
    expect(db.policyConfig.update.mock.calls.every(([arg]:any)=>arg.where.id===ids.policy||Object.keys(arg.data).join(',')==='isActive')).toBe(true);
    expect(db.$transaction.mock.calls[0][1]).toMatchObject({isolationLevel:'Serializable'});
    expect(result).toMatchObject({status:'REANCHORED',date:input.date,periods:8});
    expect(tables.auditLog.some(a=>a.action==='SYNTHETIC_PREVIEW_DAY_REANCHORED')).toBe(true);
    const output=JSON.stringify(result);
    expect(output).not.toContain(process.env.PREVIEW_DB_PASSWORD!);
    expect(output).not.toContain('postgresql:');
    expect(output).not.toContain('$2');
    await reanchorPreviewDay(db,input);
    expect(tables.timetable).toHaveLength(8);
    expect((await resolvePilotDay(db,user,date,date.getTime(),{V4_LEARNING_PREVIEW_ENABLED:'1'}))?.periods.every(p=>p.status==='ADMITTED')).toBe(true);
    const expired=new Date('2026-11-13T00:00:00Z');
    expect(await resolvePilotDay(db,user,expired,expired.getTime(),{V4_LEARNING_PREVIEW_ENABLED:'1'})).toBeNull();
    await reanchorPreviewDay(db,{...input,date:'2026-11-16'});
    await reanchorPreviewDay(db,input);
    expect(tables.timetable).toHaveLength(8);
    expect((await resolvePilotDay(db,user,date,date.getTime(),{V4_LEARNING_PREVIEW_ENABLED:'1'}))?.periods.every(p=>p.status==='ADMITTED')).toBe(true);
    expect(db.user.create).not.toHaveBeenCalled();expect(db.user.update).not.toHaveBeenCalled();expect(db.user.upsert).not.toHaveBeenCalled();
  });
  it.each([{schoolId:'another-school'},{classId:'another-section'},{date:'2026-02-30'},{date:'next Thursday'},{date:'2026-11-12T00:00:00Z'},{date:'2026-11-01'},{date:'2026-11-17'}])('refuses invalid explicit scope/date %j before a transaction',async override=>{
    const {db}=await fixture();await expect(reanchorPreviewDay(db,{...input,...override})).rejects.toThrow(/preview_reanchor_/);expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([{VERCEL_ENV:'production'},{VERCEL:'1'},{CI:'true'},{PREVIEW_SUPABASE_PROJECT_REF:'bnphuinpvgpmebcsvmsp'},{SYNTHETIC_PREVIEW_SEED:'0'}])('refuses unsafe environment %j before a transaction',async override=>{
    const {db}=await fixture();for(const [key,value] of Object.entries(override))vi.stubEnv(key,value);
    await expect(reanchorPreviewDay(db,input)).rejects.toThrow();expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each(['privileged-role','teacher','roster','hash','extra-period','revoked','approval','audit','authority-password','foreign-student','inactive-policy','extra-policy','lesson-slot','bell-times','teacher-profile'])('refuses %s drift without writes',async drift=>{
    const {db,tables}=await fixture();
    const policy=tables.policyConfig.find(p=>p.id===ids.policy);
    if(drift==='privileged-role')db.$queryRaw.mockResolvedValue([{database:'postgres',username:'preview_app',superuser:true}]);
    if(drift==='teacher')tables.class[0].teacherId='foreign-teacher';
    if(drift==='roster')tables.enrollment.pop();
    if(drift==='hash')policy.config.lessons[0].packageHash='0'.repeat(64);
    if(drift==='extra-period')tables.timetable.push({...tables.timetable[0],id:'extra-period'});
    if(drift==='revoked')policy.config.revokedAt='2026-11-03T00:00:00Z';
    if(drift==='approval')tables.policyConfig[1].config.bindingSha256='0'.repeat(64);
    if(drift==='audit')tables.auditLog[0].details.syntheticTestOnly=false;
    if(drift==='authority-password')tables.user.find(u=>u.id===ids.authority).hashedPwd='unapproved';
    if(drift==='foreign-student')tables.user.find(u=>u.id===ids.studentUser).schoolId=ids.foreignSchool;
    if(drift==='inactive-policy')policy.isActive=false;
    if(drift==='extra-policy')tables.policyConfig.push({...policy,id:'duplicate-policy'});
    if(drift==='lesson-slot')policy.config.lessons[0].timetable[0].timetableId='wrong-period';
    if(drift==='bell-times')tables.timetable[0].startTime='01:00';
    if(drift==='teacher-profile')tables.teacherProfile.find(p=>p.userId===ids.teacher).schoolId=ids.foreignSchool;
    const before=structuredClone(tables);
    await expect(reanchorPreviewDay(db,input)).rejects.toThrow(/preview_reanchor_/);
    expect(tables).toEqual(before);expect(db.timetable.updateMany).not.toHaveBeenCalled();
  });
  it.each(['approval','operation-audit'])('rolls back timetable, policy and approvals if %s write fails',async failure=>{
    const {db,tables}=await fixture();const before=structuredClone(tables);
    if(failure==='approval')db.policyConfig.update.mockRejectedValueOnce(Error('private-database-detail'));
    else db.auditLog.create.mockImplementation(async({data}:any)=>{if(data.action==='SYNTHETIC_PREVIEW_DAY_REANCHORED')throw Error('private-database-detail');tables.auditLog.push(data);return data;});
    await expect(reanchorPreviewDay(db,input)).rejects.toThrow('preview_reanchor_failed');
    expect(tables).toEqual(before);
  });
});
