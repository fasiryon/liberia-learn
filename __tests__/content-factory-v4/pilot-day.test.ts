import {beforeEach,describe,expect,it,vi} from "vitest";
import {resolvePilotDay} from "@/lib/curriculum/v4/pilotDay";
import {loadStudentLearningPreview,authorizeStudentLearningPreview,CONDITIONALLY_ACCEPTED} from "@/lib/curriculum/v4/learningPreview";
vi.mock("@/lib/curriculum/v4/learningPreview",async importOriginal=>({...await importOriginal<typeof import("@/lib/curriculum/v4/learningPreview")>(),loadStudentLearningPreview:vi.fn()}));
const load=vi.mocked(loadStudentLearningPreview);
const user={id:"synthetic-student",role:"STUDENT",schoolId:"synthetic-school"};
const now=Date.parse("2026-10-26T08:30:00Z"),date=new Date("2026-10-26T00:00:00Z"),env={V4_LEARNING_PREVIEW_ENABLED:"1"};
const selection="factory@4.0.0-draft.6@g7-math-area-perimeter",packageHash=CONDITIONALLY_ACCEPTED["g7-math-area-perimeter"];
const binding={classId:"synthetic-g7-a",timetableId:"synthetic-period-1",subject:"MATH"};
const lesson={selection,packageHash,revokedAt:null,approvalRecordId:"synthetic-approval",classIds:[binding.classId],timetable:[binding],reviews:{content:"TEST ONLY",rights:"TEST ONLY",access:"TEST ONLY",accessibility:"TEST ONLY",safety:"TEST ONLY",runtime:"TEST ONLY",releaseAuthorization:"TEST ONLY"}};
function policy(){return {version:"learning-preview/1.0.0",status:"PILOT_ONLY",enabled:true,revokedAt:null,startsAt:"2026-10-26T00:00:00Z",endsAt:"2026-11-09T00:00:00Z",schoolId:user.schoolId,studentUserIds:[user.id],classIds:[binding.classId],canonicalRecordWrites:false,offlineDelivery:false,lessons:[structuredClone(lesson)]};}
function fixture(){
  const current={...user,school:{status:"ACTIVE"},student:{deletedAt:null,enrollments:[{Class:{id:binding.classId,schoolId:user.schoolId}}],academicEnrollments:[]}};
  const raw=policy();
  const slots=[{id:binding.timetableId,schoolId:user.schoolId,classId:binding.classId,subject:"MATH",periodLabel:"P1",startTime:"08:20",endTime:"09:10"}];
  const source={user:{findUnique:vi.fn().mockResolvedValue(current)},policyConfig:{findMany:vi.fn().mockResolvedValue([{config:raw}]),findUnique:vi.fn()},auditLog:{findUnique:vi.fn()},timetable:{findMany:vi.fn().mockResolvedValue(slots)}};
  return {current,raw,slots,source,db:source as unknown as Parameters<typeof resolvePilotDay>[0]};
}
beforeEach(()=>{load.mockReset();});
describe("read-only pilot day resolution",()=>{
  it("makes no database calls for an off flag, unauthorized role or invalid date",async()=>{
    const f=fixture();
    expect(await resolvePilotDay(f.db,user,date,now,{})).toBeNull();
    for(const role of ["TEACHER","ADMIN","GUARDIAN"])expect(await resolvePilotDay(f.db,{...user,role},date,now,env)).toBeNull();
    expect(await resolvePilotDay(f.db,user,new Date("invalid"),now,env)).toBeNull();
    expect(f.source.user.findUnique).not.toHaveBeenCalled();
  });
  it("requires a current active student and scoped cohort before reading the timetable",async()=>{
    for(const change of ["role","school","deleted","cohort"]){
      const f=fixture();
      if(change==="role")f.current.role="TEACHER";
      if(change==="school")f.current.schoolId="other-school";
      if(change==="deleted")Object.assign(f.current.student,{deletedAt:new Date()});
      if(change==="cohort")f.current.student.enrollments[0].Class.id="outside";
      expect(await resolvePilotDay(f.db,user,date,now,env)).toBeNull();
      expect(f.source.timetable.findMany).not.toHaveBeenCalled();
    }
  });
  it("denies disabled, revoked, expired, unpinned or duplicate active policy records",async()=>{
    for(const change of ["disabled","revoked","expired","hash","duplicate"]){
      const f=fixture();
      if(change==="disabled")f.raw.enabled=false;
      if(change==="revoked")Object.assign(f.raw,{revokedAt:new Date(now).toISOString()});
      if(change==="expired")f.raw.endsAt=new Date(now).toISOString();
      if(change==="hash")f.raw.lessons[0].packageHash="0".repeat(64);
      if(change==="duplicate")f.source.policyConfig.findMany.mockResolvedValue([{config:f.raw},{config:f.raw}]);
      expect(await resolvePilotDay(f.db,user,date,now,env)).toBeNull();
      expect(f.source.timetable.findMany).not.toHaveBeenCalled();
    }
    const f=fixture();
    expect(await resolvePilotDay(f.db,user,new Date("2026-11-09T00:00:00Z"),now,env)).toBeNull();
  });
  it("loads an exact explicitly bound slot through the canonical loader",async()=>{
    const f=fixture();
    load.mockResolvedValue({identity:{selection,packageHash}} as Awaited<ReturnType<typeof loadStudentLearningPreview>>);
    const result=await resolvePilotDay(f.db,user,date,now,env);
    expect(result?.periods[0]).toMatchObject({status:"ADMITTED",selection,packageHash,href:`/learn/preview/${encodeURIComponent(selection)}`});
    expect(load).toHaveBeenCalledWith(f.db,user,selection,now,binding);
    expect(f.source.timetable.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{schoolId:user.schoolId,classId:{in:[binding.classId]},class:{schoolId:user.schoolId},dayOfWeek:"MONDAY"}}));
    expect(result?.canonicalRecordWrites).toBe(false);
  });
  it("never guesses by subject, accepts a foreign slot or truncates an oversized result",async()=>{
    const f=fixture();f.slots[0].id="unbound-math-period";
    expect((await resolvePilotDay(f.db,user,date,now,env))?.periods[0]).toMatchObject({status:"GAP",reason:"UNBOUND"});
    expect(load).not.toHaveBeenCalled();
    f.slots[0].schoolId="foreign";
    expect(await resolvePilotDay(f.db,user,date,now,env)).toBeNull();
    f.source.timetable.findMany.mockResolvedValue(Array(257).fill({...f.slots[0],schoolId:user.schoolId}));
    expect(await resolvePilotDay(f.db,user,date,now,env)).toBeNull();
  });
  it("leaves denied or changed hashes as gaps and propagates package tampering errors",async()=>{
    const f=fixture();load.mockResolvedValue(null);
    expect((await resolvePilotDay(f.db,user,date,now,env))?.periods[0]).toMatchObject({status:"GAP",reason:"NOT_ADMITTED"});
    load.mockResolvedValue({identity:{selection,packageHash:"0".repeat(64)}} as Awaited<ReturnType<typeof loadStudentLearningPreview>>);
    expect((await resolvePilotDay(f.db,user,date,now,env))?.periods[0].status).toBe("GAP");
    load.mockRejectedValue(new Error("sealed_file_digest_mismatch"));
    await expect(resolvePilotDay(f.db,user,date,now,env)).rejects.toThrow("sealed_file_digest_mismatch");
  });
  it("refuses ambiguous bindings instead of selecting a preferred lesson",async()=>{
    const f=fixture();f.raw.lessons.push({...structuredClone(lesson),selection:"factory@4.0.0-draft.6@g7-math-fractions",packageHash:CONDITIONALLY_ACCEPTED["g7-math-fractions"]});
    expect((await resolvePilotDay(f.db,user,date,now,env))?.periods[0]).toMatchObject({status:"GAP",reason:"AMBIGUOUS_BINDING"});
    expect(load).not.toHaveBeenCalled();
  });
  it("rechecks the exact slot and class inside real admission before approval lookup",async()=>{
    const f=fixture();
    expect(await authorizeStudentLearningPreview(f.db,user,selection,now,{...binding,timetableId:"changed-period"})).toBeNull();
    const secondClass="synthetic-g7-b";
    f.raw.classIds.push(secondClass);f.raw.lessons[0].classIds.push(secondClass);
    f.raw.lessons[0].timetable.push({...binding,classId:secondClass,timetableId:"second-class-slot"});
    expect(await authorizeStudentLearningPreview(f.db,user,selection,now,{...binding,classId:secondClass,timetableId:"second-class-slot"})).toBeNull();
    expect(f.source.policyConfig.findUnique).not.toHaveBeenCalled();
  });
});
