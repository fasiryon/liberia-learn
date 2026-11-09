/**
 * T1 hosted Preview readiness (2026-11-02). A Vercel function contains only traced files. The school-day and
 * player loaders read sealed packages with fs at process.cwd(), which static tracing cannot see, so every file
 * they actually read on the admitted path must be covered by that route's outputFileTracingIncludes, and must
 * not be excluded from upload by .vercelignore. Records reads by wrapping fs; synthetic in-memory database only.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {syncBuiltinESMExports} from 'node:module';
import {beforeAll,describe,expect,it} from 'vitest';

const reads=new Set<string>();
const rel=(p:unknown)=>path.relative(process.cwd(),path.resolve(String(p))).replace(/\\/g,'/');
for(const name of ['readFileSync','readdirSync','existsSync'] as const){
  const original=(fs as any)[name];
  (fs as any)[name]=function(this:unknown,target:unknown,...rest:unknown[]){
    if(typeof target==='string')reads.add(`${name==='readdirSync'?'dir':'file'}:${rel(target)}`);
    return original.call(this,target,...rest);
  };
}
syncBuiltinESMExports();

function nextConfig(){
  const source=fs.readFileSync('next.config.js','utf8');
  const requireStub=(name:string)=>{
    if(name==='@sentry/nextjs')return {withSentryConfig:(config:unknown)=>config};
    if(name==='next-intl/plugin')return ()=>((config:unknown)=>config);
    if(name==='./lib/validateEnv.shared.js')return {validateBuildEnv:()=>{}};
    if(name.startsWith('./curriculum/'))return JSON.parse(fs.readFileSync(name,'utf8'));
    throw Error('unexpected_config_dependency');
  };
  return vm.runInNewContext(source,{process:{env:{VERCEL_ENV:'preview',SKIP_ENV_VALIDATION:'true'}},require:requireStub,module:{exports:{}}});
}
const globRegex=(glob:string)=>new RegExp('^'+glob.replace(/^\.\//,'').replace(/[.+^${}()|[\]\\]/g,'\\$&')
  .replace(/\*\*\//g,'\u0000').replace(/\*/g,'[^/]*').replace(/\u0000/g,'(?:.*/)?')+'$');
function covered(entry:string,globs:string[]){
  const [kind,file]=[entry.slice(0,entry.indexOf(':')),entry.slice(entry.indexOf(':')+1)];
  // A traced directory exists when any file inside it is traced.
  const probe=kind==='dir'?`${file}/__any__`:file;
  return globs.some(glob=>globRegex(glob).test(probe));
}
// Runtime-relevant .vercelignore exclusions (the full file is gitignore syntax; these are the curriculum/artifact rules).
const UPLOAD_EXCLUDED=[/^curriculum\/program\/stem-v1\/security(\/|$)/,/^artifacts\/(?!curriculum-cleanup-v1\/(snapshot|cleanup-plan)\.json$|g7-native-curriculum-v1\/legacy\/)/,/^scripts\/(e2e|preview)\//,/^docs\/(audits|security|qa|internal)\//];

const schoolId='g4trace-school',classId='g4trace-class',user={id:'g4trace-student-user',role:'STUDENT',schoolId};
const now=Date.parse('2026-10-28T09:00:00Z');
const refs=Object.fromEntries(['content','rights','access','accessibility','safety','runtime','releaseAuthorization'].map(k=>[k,'SYNTHETIC-TRACE-ONLY']));
let preview:typeof import('@/lib/curriculum/v4/learningPreview');
let SELECTIONS:string[]=[];let HASHES:Record<string,string>={};
const SUBJECTS=['MATH','SCIENCE','ENGLISH','SOCIAL_STUDIES','COMPUTER_SCIENCE','ENGINEERING','SUPPORT','END_OF_DAY'];
function fakeDb(){
  const policy={version:'learning-preview/1.0.0',status:'PILOT_ONLY',enabled:true,revokedAt:null,startsAt:'2026-10-28T00:00:00Z',endsAt:'2026-10-29T00:00:00Z',
    schoolId,studentUserIds:[user.id],classIds:[classId],canonicalRecordWrites:false,offlineDelivery:false,
    lessons:SELECTIONS.map((selection,i)=>({selection,packageHash:HASHES[selection],revokedAt:null,approvalRecordId:`g4trace-approval-${i}`,timetable:[{classId,timetableId:`g4trace-tt-${i}`,subject:SUBJECTS[i]}],reviews:refs}))};
  const approvals=new Map<string,any>(),audits=new Map<string,any>();
  policy.lessons.forEach((lesson,i)=>{
    const bindingSha256=preview.pilotApprovalBinding(policy as never,lesson.selection,lesson.packageHash);
    approvals.set(lesson.approvalRecordId,{id:lesson.approvalRecordId,policyKey:preview.PILOT_RELEASE_APPROVAL_KEY,scope:'SCHOOL',schoolId,isActive:true,
      config:{status:'AUTHORIZED_PILOT_RELEASE',bindingSha256,auditLogId:`g4trace-audit-${i}`},createdById:'g4trace-authority',createdBy:{role:'ADMIN',isPlatformAdmin:true}});
    audits.set(`g4trace-audit-${i}`,{userId:'g4trace-authority',action:'V4_PILOT_RELEASE_AUTHORIZED',resourceId:lesson.approvalRecordId,resourceType:'PolicyConfig',schoolId,details:{bindingSha256,syntheticTestOnly:true}});
  });
  return {
    user:{findUnique:async()=>({id:user.id,role:'STUDENT',schoolId,school:{status:'ACTIVE'},student:{deletedAt:null,enrollments:[{Class:{id:classId,schoolId}}],academicEnrollments:[]}})},
    policyConfig:{findMany:async()=>[{config:policy}],findUnique:async({where}:any)=>approvals.get(where.id)??null},
    auditLog:{findUnique:async({where}:any)=>audits.get(where.id)??null},
    timetable:{findMany:async()=>SELECTIONS.map((_,i)=>({id:`g4trace-tt-${i}`,schoolId,classId,subject:SUBJECTS[i],periodLabel:`P${i+1}`,startTime:`${String(8+i).padStart(2,'0')}:00`,endTime:null}))},
  } as never;
}

const includes=nextConfig().experimental.outputFileTracingIncludes as Record<string,string[]>;
const playerReads=new Set<string>(),dayReads=new Set<string>();
beforeAll(async()=>{
  preview=await import('@/lib/curriculum/v4/learningPreview');
  const {GRADE4_SCHOOLDAY_ACCEPTED}=await import('@/lib/curriculum/v4/schooldayPackage');
  HASHES=GRADE4_SCHOOLDAY_ACCEPTED;SELECTIONS=Object.keys(HASHES);
  const {resolvePilotDay}=await import('@/lib/curriculum/v4/pilotDay');
  const {schoolDayForGrade}=await import('@/lib/learner-experience/day/loadSchoolDay');
  const {GRADES}=await import('@/lib/learner-experience/day/schoolDay');
  const {cosDayForPilot,schoolDayFromPilot}=await import('@/lib/learner-experience/day/pilotSchoolDay');
  // The player page and API: one sealed admission per selection.
  reads.clear();
  for(const [i,selection] of SELECTIONS.entries()){
    const loaded=await preview.loadStudentLearningPreview(fakeDb(),user as never,selection,now,{timetableId:`g4trace-tt-${i}`,classId,subject:SUBJECTS[i]});
    if(loaded?.identity.packageHash!==HASHES[selection])throw Error(`trace_fixture_not_admitted:${i}`);
  }
  reads.forEach(entry=>playerReads.add(entry));
  // /learn/day exactly as the page composes it.
  reads.clear();
  const day=await resolvePilotDay(fakeDb(),user as never,new Date(now),now,{V4_LEARNING_PREVIEW_ENABLED:'1'});
  if(!day||day.periods.some(p=>p.status!=='ADMITTED'))throw Error('trace_fixture_day_not_admitted');
  schoolDayFromPilot(day,cosDayForPilot(day,GRADES.map(schoolDayForGrade)));
  reads.forEach(entry=>dayReads.add(entry));
});

describe('hosted file tracing covers every file the admitted lesson path reads',()=>{
  it('the fixture exercised real package reads (non-vacuous)',()=>{
    expect([...playerReads].filter(e=>e.includes('generation-receipt.json')).length).toBe(8);
    expect([...dayReads].some(e=>e.includes('resolved-days/g4-day1.json'))).toBe(true);
  });
  it('control: the matcher rejects files a route does not trace',()=>{
    const player=[...includes['/learn/preview/*'],...includes['/*']];
    expect(covered('file:curriculum/program/stem-v1/resolved-days/g4-day1.json',player)).toBe(false);
    expect(covered('file:curriculum/factory-v4/drafts/4.0.0-schoolday-primary-math.1-draft.1/g4-math-three-digit-products/manifest.json',player)).toBe(false);
    expect(covered('dir:curriculum/factory-v4/drafts/4.0.0-schoolday-grade4-eod.1-draft.1/g4-eod-evidence-connections',player)).toBe(true);
  });
  it.each(['/learn/preview/*','/api/student/learning-preview/*'])('%s traces every package file the player loader reads',route=>{
    const globs=[...includes[route],...includes['/*']];
    expect([...playerReads].filter(entry=>!entry.includes('node_modules')&&!covered(entry,globs))).toEqual([]);
  });
  it('/learn/day traces every package, resolved-day and matrix file it reads',()=>{
    const globs=[...includes['/learn/day'],...includes['/*']];
    expect([...dayReads].filter(entry=>!entry.includes('node_modules')&&!covered(entry,globs))).toEqual([]);
  });
  it('no runtime read targets a path excluded from the Vercel upload',()=>{
    const all=[...playerReads,...dayReads].map(entry=>entry.slice(entry.indexOf(':')+1));
    expect(all.filter(file=>UPLOAD_EXCLUDED.some(rule=>rule.test(file)))).toEqual([]);
  });
  it('reads stay inside the repository root (no absolute or parent paths)',()=>{
    expect([...playerReads,...dayReads].filter(entry=>/^(file|dir):(\.\.\/|[a-zA-Z]:|\/)/.test(entry))).toEqual([]);
  });
});
