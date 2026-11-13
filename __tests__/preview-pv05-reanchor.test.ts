/**
 * PV-05 application-side behavior (T1, 2026-11-02). T2 owns the Preview timetable re-anchor; this pins how
 * /learn/day (resolvePilotDay) and the player admission (loadStudentLearningPreview) interpret timetable weekdays
 * and the policy window before and after an authorized re-anchor. Synthetic in-memory database that honors the
 * real query filters and fails on any write.
 */
import {describe,expect,it} from 'vitest';
import * as preview from '@/lib/curriculum/v4/learningPreview';
import {resolvePilotDay} from '@/lib/curriculum/v4/pilotDay';
import {GRADE4_SCHOOLDAY_ACCEPTED} from '@/lib/curriculum/v4/schooldayPackage';

const SELECTIONS=Object.keys(GRADE4_SCHOOLDAY_ACCEPTED) as Array<keyof typeof GRADE4_SCHOOLDAY_ACCEPTED>;
const SUBJECTS=['MATH','SCIENCE','ENGLISH','CIVICS','COMPUTER_SCIENCE','ENGINEERING','ENGLISH','ENGLISH'];
const WEEKDAYS=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const school='pv05-school',klass='pv05-class',otherClass='pv05-other-class',user={id:'pv05-student-user',role:'STUDENT',schoolId:school};
const ENV={V4_LEARNING_PREVIEW_ENABLED:'1'};
const DAY=86_400_000,HOUR=3_600_000;
const SEED=Date.parse('2026-11-02T00:00:00Z'),REANCHOR=Date.parse('2026-11-10T00:00:00Z');
const refs=Object.fromEntries(['content','rights','access','accessibility','safety','runtime','releaseAuthorization'].map(k=>[k,'SYNTHETIC PV05 ONLY']));

type Slot={id:string;schoolId:string;classId:string;subject:string;periodLabel:string;startTime:string;endTime:string;dayOfWeek:string};
/** Mirrors the seed: 8 slots on the anchor's UTC weekday, policy [anchor-1h, anchor+48h). */
function schedule(anchor:number,prefix='pv05-period'){
  const slots:Slot[]=SELECTIONS.map((_,i)=>({id:`${prefix}-${i+1}`,schoolId:school,classId:klass,subject:SUBJECTS[i],periodLabel:`P${i+1}`,
    startTime:`${String(8+Math.floor(i*40/60)).padStart(2,'0')}:${String((i*40)%60).padStart(2,'0')}`,endTime:'23:59',dayOfWeek:WEEKDAYS[new Date(anchor).getUTCDay()]}));
  const policy={version:'learning-preview/1.0.0',status:'PILOT_ONLY',enabled:true,revokedAt:null as string|null,
    startsAt:new Date(anchor-HOUR).toISOString(),endsAt:new Date(anchor+2*DAY).toISOString(),schoolId:school,studentUserIds:[user.id],classIds:[klass],
    canonicalRecordWrites:false,offlineDelivery:true,offlineMaxAgeSeconds:300,
    lessons:SELECTIONS.map((selection,i)=>({selection,packageHash:GRADE4_SCHOOLDAY_ACCEPTED[selection],revokedAt:null,approvalRecordId:`pv05-approval-${i+1}`,
      timetable:[{classId:klass,timetableId:slots[i].id,subject:SUBJECTS[i]}],reviews:refs}))};
  return {slots,policy};
}
function approvalsFor(policy:ReturnType<typeof schedule>['policy'],auditSuffix:string){
  const approvals=new Map<string,unknown>(),audits=new Map<string,unknown>();
  for(const lesson of policy.lessons){
    const bindingSha256=preview.pilotApprovalBinding(policy as never,lesson.selection,lesson.packageHash),auditLogId=`${lesson.approvalRecordId}-audit-${auditSuffix}`;
    approvals.set(lesson.approvalRecordId,{id:lesson.approvalRecordId,policyKey:preview.PILOT_RELEASE_APPROVAL_KEY,scope:'SCHOOL',schoolId:school,isActive:true,
      config:{status:'AUTHORIZED_PILOT_RELEASE',bindingSha256,auditLogId},createdById:'pv05-authority',createdBy:{role:'ADMIN',isPlatformAdmin:true}});
    audits.set(auditLogId,{userId:'pv05-authority',action:'V4_PILOT_RELEASE_AUTHORIZED',resourceId:lesson.approvalRecordId,resourceType:'PolicyConfig',schoolId:school,details:{bindingSha256,syntheticTestOnly:true}});
  }
  return {approvals,audits};
}
type State={policy:unknown;slots:Slot[];approvals:Map<string,unknown>;audits:Map<string,unknown>;enrolled:string[]};
function database(state:State){
  const writes:string[]=[];
  const model=(reads:Record<string,(...a:any[])=>unknown>,name:string)=>new Proxy(reads,{get(target,key:string){
    if(key in target)return target[key];
    if(/^(create|update|upsert|delete)/.test(key))return ()=>{writes.push(`${name}.${key}`);throw Error('unexpected_write');};
    return undefined;}});
  const db={
    user:model({findUnique:async()=>({id:user.id,role:'STUDENT',schoolId:school,school:{status:'ACTIVE'},
      student:{deletedAt:null,enrollments:state.enrolled.map(id=>({Class:{id,schoolId:school}})),academicEnrollments:[]}})},'user'),
    policyConfig:model({findMany:async()=>[{config:state.policy}],findUnique:async({where}:any)=>state.approvals.get(where.id)??null},'policyConfig'),
    auditLog:model({findUnique:async({where}:any)=>state.audits.get(where.id)??null},'auditLog'),
    timetable:model({findMany:async({where}:any)=>state.slots.filter(s=>s.schoolId===where.schoolId&&where.classId.in.includes(s.classId)&&s.dayOfWeek===where.dayOfWeek)},'timetable'),
  };
  return {db:db as never,writes};
}
const seeded=()=>{const {slots,policy}=schedule(SEED);return {slots,policy,...approvalsFor(policy,'seed'),enrolled:[klass]} as State;};
const at=(t:number)=>({date:new Date(t),now:t});
const day=async(state:State,t:number)=>{const {db,writes}=database(state);const r=await resolvePilotDay(db,user,at(t).date,at(t).now,ENV);return {r,writes};};
const statuses=(r:Awaited<ReturnType<typeof resolvePilotDay>>)=>r?.periods.map(p=>p.status==='ADMITTED'?p.packageHash:`${p.status}:${(p as {reason:string}).reason}`);

describe('seeded schedule (current one-shot setup)',()=>{
  it('admits all eight exact packages on the seed day',async()=>{
    const {r,writes}=await day(seeded(),SEED+9*HOUR);
    expect(statuses(r)).toEqual(SELECTIONS.map(s=>GRADE4_SCHOOLDAY_ACCEPTED[s]));
    expect(writes).toEqual([]);
  });
  it('characterizes PV-05: the next weekday inside the window has no periods',async()=>{
    const {r}=await day(seeded(),SEED+DAY+9*HOUR);
    expect(r?.periods).toEqual([]);
  });
  it('characterizes PV-05: after the 48 h window the day is concealed (404 at the page)',async()=>{
    expect((await day(seeded(),SEED+2*DAY)).r).toBeNull();
  });
});

describe('after an authorized re-anchor',()=>{
  const reanchored=(suffix='reanchor'):State=>{const {slots,policy}=schedule(REANCHOR);return {slots,policy,...approvalsFor(policy,suffix),enrolled:[klass]};};
  it('admits all eight on the new day, with new append-only audit rows',async()=>{
    const {r,writes}=await day(reanchored(),REANCHOR+9*HOUR);
    expect(statuses(r)).toEqual(SELECTIONS.map(s=>GRADE4_SCHOOLDAY_ACCEPTED[s]));
    expect(r?.canonicalRecordWrites).toBe(false);
    expect(writes).toEqual([]);
  });
  it('a re-anchor that moves only the window and weekday, keeping the old approvals, admits nothing (approvals bind the window)',async()=>{
    const old=seeded(),{slots,policy}=schedule(REANCHOR);
    const {r}=await day({...old,slots,policy},REANCHOR+9*HOUR);
    expect(r?.periods.map(p=>p.status)).toEqual(Array(8).fill('GAP'));
    expect(r?.periods.every(p=>p.status==='GAP'&&p.reason==='NOT_ADMITTED')).toBe(true);
  });
  it('the old seed day is no longer reachable once the window has moved',async()=>{
    expect((await day(reanchored(),SEED+9*HOUR)).r).toBeNull();
  });
  it('a stale player link bound to a pre-re-anchor slot is refused',async()=>{
    const state=reanchored(),{db,writes}=database(state);
    const selection=SELECTIONS[5];
    expect(await preview.loadStudentLearningPreview(db,user,selection,REANCHOR+9*HOUR,{timetableId:'pv05-old-slot-6',classId:klass,subject:SUBJECTS[5]})).toBeNull();
    const fresh=await preview.loadStudentLearningPreview(db,user,selection,REANCHOR+9*HOUR,{timetableId:state.slots[5].id,classId:klass,subject:SUBJECTS[5]});
    expect(fresh?.identity.packageHash).toBe(GRADE4_SCHOOLDAY_ACCEPTED[selection]);
    expect(fresh?.expiresAt).toBe(new Date(REANCHOR+2*DAY).toISOString());
    expect(Date.parse(fresh!.offlineAuthorization!.validUntil)).toBeLessThanOrEqual(REANCHOR+9*HOUR+300_000);
    expect(writes).toEqual([]);
  });
  it('re-binding to new timetable ids leaves old ids unbound (no stale period carried over)',async()=>{
    const {slots,policy}=schedule(REANCHOR,'pv05-period-v2'),state:State={slots:[...seeded().slots.map(s=>({...s,dayOfWeek:slots[0].dayOfWeek})),...slots],policy,...approvalsFor(policy,'v2'),enrolled:[klass]};
    const {r}=await day(state,REANCHOR+9*HOUR);
    const admitted=r!.periods.filter(p=>p.status==='ADMITTED').map(p=>p.timetableId);
    expect(admitted.sort()).toEqual(slots.map(s=>s.id).sort());
    expect(r!.periods.filter(p=>p.timetableId.startsWith('pv05-period-')&&!p.timetableId.startsWith('pv05-period-v2')).every(p=>p.status==='GAP'&&p.reason==='UNBOUND')).toBe(true);
  });
});

describe('unrelated classes',()=>{
  it('an enrolled class outside the policy cohort contributes no periods',async()=>{
    const state=seeded();
    state.enrolled=[klass,otherClass];
    state.slots=[...state.slots,{...state.slots[0],id:'pv05-other-slot',classId:otherClass}];
    const {r}=await day(state,SEED+9*HOUR);
    expect(r?.periods.some(p=>p.classId===otherClass)).toBe(false);
  });
  it('a student no longer enrolled in the cohort class gets no day',async()=>{
    const state=seeded();state.enrolled=[otherClass];
    expect((await day(state,SEED+9*HOUR)).r).toBeNull();
  });
});

describe('invalid and expired schedules are refused',()=>{
  const variant=(edit:(p:any)=>void)=>{const s=seeded();const policy=JSON.parse(JSON.stringify(s.policy));edit(policy);return {...s,policy};};
  it.each([
    ['inverted window',(p:any)=>{[p.startsAt,p.endsAt]=[p.endsAt,p.startsAt];}],
    ['window longer than 14 days',(p:any)=>{p.endsAt=new Date(Date.parse(p.startsAt)+15*DAY).toISOString();}],
    ['non-ISO window',(p:any)=>{p.endsAt='next week';}],
    ['revoked policy',(p:any)=>{p.revokedAt=new Date(SEED).toISOString();}],
    ['disabled policy',(p:any)=>{p.enabled=false;}],
    ['window not yet started',(p:any)=>{p.startsAt=new Date(SEED+20*HOUR).toISOString();}],
  ])('%s',async(_label,edit)=>{
    expect((await day(variant(edit),SEED+9*HOUR)).r).toBeNull();
  });
  it('exactly at endsAt the day is refused (half-open window)',async()=>{
    const s=seeded();
    expect((await day(s,Date.parse((s.policy as {endsAt:string}).endsAt))).r).toBeNull();
  });
});

describe('re-anchor approval contract (what T2 must write for the new window)',()=>{
  const fresh=():State=>{const {slots,policy}=schedule(REANCHOR);return {slots,policy,...approvalsFor(policy,'reanchor'),enrolled:[klass]};};
  const tamper=(edit:(approval:any,audit:any)=>void)=>{const s=fresh();const id='pv05-approval-6',a=structuredClone(s.approvals.get(id)) as any;
    const auditId=a.config.auditLogId,au=structuredClone(s.audits.get(auditId)) as any;edit(a,au);s.approvals.set(id,a);s.audits.set(auditId,au);return s;};
  const p6=async(s:State)=>(await day(s,REANCHOR+9*HOUR)).r?.periods[5];
  it('control: valid new approval and audit admit P6',async()=>{expect((await p6(fresh()))?.status).toBe('ADMITTED');});
  it.each([
    ['approval authored by a non-platform account (keep the authority row even when its password is disabled, K2)',(a:any)=>{a.createdBy={role:'ADMIN',isPlatformAdmin:false};}],
    ['approval inactive',(a:any)=>{a.isActive=false;}],
    ['approval for another school',(a:any)=>{a.schoolId='other-school';}],
    ['approval binding computed for the old window',(a:any,au:any)=>{const old=preview.pilotApprovalBinding(schedule(SEED).policy as never,SELECTIONS[5],GRADE4_SCHOOLDAY_ACCEPTED[SELECTIONS[5]]);a.config.bindingSha256=old;au.details.bindingSha256=old;}],
    ['audit row written by someone other than the approval author',(_a:any,au:any)=>{au.userId='someone-else';}],
    ['audit row pointing at another approval',(_a:any,au:any)=>{au.resourceId='pv05-approval-1';}],
    ['audit binding not matching the approval',(_a:any,au:any)=>{au.details.bindingSha256='0'.repeat(64);}],
    ['audit action other than V4_PILOT_RELEASE_AUTHORIZED',(_a:any,au:any)=>{au.action='V4_PILOT_RELEASE_UPDATED';}],
  ])('NOT_ADMITTED: %s',async(_label,edit)=>{
    expect(await p6(tamper(edit))).toMatchObject({status:'GAP',reason:'NOT_ADMITTED'});
  });
  it('a slot whose subject no longer matches its binding is UNBOUND (subject is a consistency check, never a search key)',async()=>{
    const s=fresh();s.slots[5]={...s.slots[5],subject:'MATH'};
    expect(await p6(s)).toMatchObject({status:'GAP',reason:'UNBOUND'});
  });
  it('two active preview policies for the school (old not deactivated) conceal the day',async()=>{
    const s=fresh(),{db}=database(s);
    (db as any).policyConfig.findMany=async()=>[{config:s.policy},{config:seeded().policy}];
    expect(await resolvePilotDay(db,user,new Date(REANCHOR+9*HOUR),REANCHOR+9*HOUR,ENV)).toBeNull();
  });
});
