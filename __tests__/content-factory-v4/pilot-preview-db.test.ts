import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { CONDITIONALLY_ACCEPTED, LEARNING_PREVIEW_POLICY_KEY, PILOT_RELEASE_APPROVAL_KEY,
  loadStudentLearningPreview, pilotApprovalBinding, previewPolicySchema } from "@/lib/curriculum/v4/learningPreview";
import {resolvePilotDay} from "@/lib/curriculum/v4/pilotDay";

// Opt-in integration suite. A different URL, port, database or user is rejected before connecting.
const isolatedUrl = "postgresql://preview_test:preview_local_only@127.0.0.1:55447/draft6_preview_validation";
const enabled = process.env.LL_PREVIEW_DB_TEST === "1";
if (enabled && (process.env.DATABASE_URL !== isolatedUrl || process.env.DIRECT_URL !== isolatedUrl)) throw Error("preview_test_database_isolation_not_verified");
const db = new PrismaClient({ datasources: { db: { url: isolatedUrl } }, log: [{ emit: "event", level: "query" }] });
const writes: string[] = [];
db.$on("query", event => { if (/^\s*(INSERT|UPDATE|DELETE)/i.test(event.query)) writes.push(event.query); });
const selection = "factory@4.0.0-draft.6@g7-math-area-perimeter";
const packageHash = CONDITIONALLY_ACCEPTED["g7-math-area-perimeter"];
const schoolId = "preview-test-school", classId = "preview-test-class", studentId = "preview-test-student";
const user = { id: "preview-test-user", role: "STUDENT", schoolId };
const now = Date.parse("2026-10-22T12:00:00Z");
let auditLogId: string;
const refs = { content: "SYNTHETIC-TEST-ONLY", rights: "SYNTHETIC-TEST-ONLY", access: "SYNTHETIC-TEST-ONLY",
  accessibility: "SYNTHETIC-TEST-ONLY", safety: "SYNTHETIC-TEST-ONLY", runtime: "SYNTHETIC-TEST-ONLY", releaseAuthorization: "SYNTHETIC-TEST-ONLY" };
const policy = previewPolicySchema.parse({ version: "learning-preview/1.0.0", status: "PILOT_ONLY", enabled: true,
  revokedAt: null, startsAt: "2026-10-22T11:00:00Z", endsAt: "2026-10-22T13:00:00Z", schoolId,
  studentUserIds: [user.id], classIds: [classId], canonicalRecordWrites: false, offlineDelivery: false,
  lessons: [{ selection, packageHash, revokedAt: null, approvalRecordId: "preview-test-approval", reviews: refs }] });

describe.runIf(enabled)("verified isolated PostgreSQL pilot admission", () => {
  beforeAll(async () => {
    const identity = await db.$queryRaw<Array<{ database: string; username: string }>>`SELECT current_database() AS database, current_user AS username`;
    expect(identity).toEqual([{ database: "draft6_preview_validation", username: "preview_test" }]);
    await db.school.upsert({ where: { id: schoolId }, create: { id: schoolId, name: "SYNTHETIC PILOT TEST ONLY" }, update: {} });
    await db.user.upsert({ where: { id: "preview-test-authority" }, create: { id: "preview-test-authority", email: "pilot-authority@example.invalid", role: "ADMIN", schoolId, isPlatformAdmin: true }, update: {} });
    await db.user.upsert({ where: { id: user.id }, create: { id: user.id, email: "pilot-student@example.invalid", role: "STUDENT", schoolId }, update: { role: "STUDENT" } });
    await db.student.upsert({ where: { id: studentId }, create: { id: studentId, userId: user.id, currentGrade: 7 }, update: { deletedAt: null } });
    await db.class.upsert({ where: { id: classId }, create: { id: classId, schoolId, name: "SYNTHETIC TEST COHORT", subject: "MATH", gradeLevel: 7 }, update: {} });
    await db.enrollment.upsert({ where: { studentId_classId: { studentId, classId } }, create: { studentId, classId }, update: {} });
    await db.policyConfig.deleteMany({ where: { policyKey: LEARNING_PREVIEW_POLICY_KEY, schoolId } });
    await db.policyConfig.create({ data: { id: "preview-test-policy", policyKey: LEARNING_PREVIEW_POLICY_KEY, scope: "SCHOOL", schoolId, createdById: "preview-test-authority", config: policy } });
    const bindingSha256 = pilotApprovalBinding(policy, selection, packageHash);
    auditLogId = `preview-test-audit-${Date.now()}`;
    await db.auditLog.create({ data: { id: auditLogId, userId: "preview-test-authority", schoolId,
      action: "V4_PILOT_RELEASE_AUTHORIZED", resourceType: "PolicyConfig", resourceId: "preview-test-approval", details: { bindingSha256, syntheticTestOnly: true } } });
    await db.policyConfig.upsert({ where: { id: "preview-test-approval" }, create: { id: "preview-test-approval", policyKey: PILOT_RELEASE_APPROVAL_KEY,
      scope: "SCHOOL", schoolId, createdById: "preview-test-authority", config: { status: "AUTHORIZED_PILOT_RELEASE", bindingSha256, auditLogId } },
      update: { isActive: true, config: { status: "AUTHORIZED_PILOT_RELEASE", bindingSha256, auditLogId } } });
  });
  afterAll(async () => {
    await db.policyConfig.updateMany({where:{schoolId,policyKey:{in:[LEARNING_PREVIEW_POLICY_KEY,PILOT_RELEASE_APPROVAL_KEY]}},data:{isActive:false}});
    await db.$disconnect();
  });

  it("serves an admitted student and performs zero database writes", async () => {
    writes.length = 0;
    const result = await loadStudentLearningPreview(db, user, selection, now);
    expect(result?.status).toBe("PILOT_ONLY");
    expect(result?.identity.packageHash).toBe(packageHash);
    expect(result?.experience.scenes.some(scene => scene.interaction.kind === "ASSESSMENT_HANDOFF")).toBe(false);
    expect(writes).toEqual([]);
  });
  it("denies every non-student role and a mismatched school", async () => {
    for (const role of ["TEACHER", "ADMIN", "GUARDIAN", "MOE_OFFICIAL", "DISTRICT_ADMIN"])
      expect(await loadStudentLearningPreview(db, { ...user, role }, selection, now)).toBeNull();
    expect(await loadStudentLearningPreview(db, { ...user, schoolId: "other" }, selection, now)).toBeNull();
  });
  it("denies a removed roster membership even when the user is allowlisted", async () => {
    await db.enrollment.delete({ where: { studentId_classId: { studentId, classId } } });
    expect(await loadStudentLearningPreview(db, user, selection, now)).toBeNull();
    await db.enrollment.create({ data: { studentId, classId } });
  });
  it("immediately denies revoked approvals and missing audit linkage", async () => {
    await db.policyConfig.update({ where: { id: "preview-test-approval" }, data: { isActive: false } });
    expect(await loadStudentLearningPreview(db, user, selection, now)).toBeNull();
    await db.policyConfig.update({ where: { id: "preview-test-approval" }, data: { isActive: true, config: {
      status: "AUTHORIZED_PILOT_RELEASE", bindingSha256: pilotApprovalBinding(policy, selection, packageHash), auditLogId: "missing" } } });
    expect(await loadStudentLearningPreview(db, user, selection, now)).toBeNull();
    await db.policyConfig.update({ where: { id: "preview-test-approval" }, data: { config: {
      status: "AUTHORIZED_PILOT_RELEASE", bindingSha256: pilotApprovalBinding(policy, selection, packageHash), auditLogId } } });
  });
  it("denies revoked lesson, disabled policy, expired window and changed cohort authorization", async () => {
    for (const config of [{ ...policy, enabled: false }, { ...policy, lessons: [{ ...policy.lessons[0], revokedAt: "2026-10-22T11:30:00Z" }] },
      { ...policy, endsAt: "2026-10-22T12:00:00Z" }, { ...policy, classIds: [classId, "unapproved-class"] }]) {
      await db.policyConfig.update({ where: { id: "preview-test-policy" }, data: { config } });
      expect(await loadStudentLearningPreview(db, user, selection, now)).toBeNull();
    }
    await db.policyConfig.update({ where: { id: "preview-test-policy" }, data: { config: policy } });
  });
  it("denies duplicate active policies and never reads or writes official learning state", async () => {
    const duplicate = await db.policyConfig.create({ data: { policyKey: LEARNING_PREVIEW_POLICY_KEY, scope: "SCHOOL", schoolId, createdById: "preview-test-authority", config: policy } });
    expect(await loadStudentLearningPreview(db, user, selection, now)).toBeNull();
    await db.policyConfig.delete({ where: { id: duplicate.id } });
    const counts = () => Promise.all([db.grade.count(), db.masteryRecord.count(), db.studentMasteryProfile.count(), db.assignment.count(), db.learningEvent.count(), db.masterySnapshot.count(), db.curriculumGovernanceEvent.count()]);
    const before = await counts();
    writes.length = 0;
    expect(await loadStudentLearningPreview(db, user, selection, now)).not.toBeNull();
    expect(writes).toEqual([]);
    expect(await counts()).toEqual(before);
  });
  it("loads all six exact packages with separate authorizations, bounded offline validity and class-specific denial",async()=>{
    const otherClass=await db.class.create({data:{schoolId,name:"SYNTHETIC OUTSIDE-COHORT TEST ONLY",subject:"MATH",gradeLevel:7}});
    const six=previewPolicySchema.parse({...policy,classIds:[classId,otherClass.id],offlineDelivery:true,offlineMaxAgeSeconds:60,
      lessons:Object.entries(CONDITIONALLY_ACCEPTED).map(([key,sha],index)=>({...policy.lessons[0],selection:`factory@4.0.0-draft.6@${key}`,packageHash:sha,classIds:[classId],approvalRecordId:`preview-test-approval-six-${index}`}))});
    const authorizeEntry=async(entry:typeof six.lessons[number],config:typeof six)=>{
      const bindingSha256=pilotApprovalBinding(config,entry.selection,entry.packageHash);
      const audit=await db.auditLog.create({data:{userId:"preview-test-authority",schoolId,action:"V4_PILOT_RELEASE_AUTHORIZED",resourceType:"PolicyConfig",resourceId:entry.approvalRecordId,details:{bindingSha256,syntheticTestOnly:true}}});
      await db.policyConfig.upsert({where:{id:entry.approvalRecordId},create:{id:entry.approvalRecordId,policyKey:PILOT_RELEASE_APPROVAL_KEY,scope:"SCHOOL",schoolId,createdById:"preview-test-authority",config:{status:"AUTHORIZED_PILOT_RELEASE",bindingSha256,auditLogId:audit.id}},update:{isActive:true,config:{status:"AUTHORIZED_PILOT_RELEASE",bindingSha256,auditLogId:audit.id}}});
    };
    try {
      await db.policyConfig.update({where:{id:"preview-test-policy"},data:{config:six}});
      for(const entry of six.lessons){
        await authorizeEntry(entry,six);writes.length=0;
        const result=await loadStudentLearningPreview(db,user,entry.selection,now);
        expect(result?.identity.packageHash).toBe(entry.packageHash);
        expect(result?.offlineAuthorization?.validUntil).toBe(new Date(now+60000).toISOString());
        expect(result?.offlineIntegritySha256).toMatch(/^[a-f0-9]{64}$/);
        if(entry.selection.includes("civics"))expect(result?.sceneAttachments["generated-1"][0].kind).toBe("LIBERIA_GEOGRAPHIC_MAP");
        expect(writes).toEqual([]);
      }
      const outside=previewPolicySchema.parse({...six,lessons:[{...six.lessons[0],classIds:[otherClass.id]}]});
      await authorizeEntry(outside.lessons[0],outside);
      await db.policyConfig.update({where:{id:"preview-test-policy"},data:{config:outside}});
      expect(await loadStudentLearningPreview(db,user,outside.lessons[0].selection,now)).toBeNull();
    }finally{
      await db.policyConfig.update({where:{id:"preview-test-policy"},data:{config:policy}});
      await db.class.delete({where:{id:otherClass.id}});
    }
  });
  it("resolves a real synthetic timetable through its exact approved binding without academic writes",async()=>{
    const teacher=await db.user.create({data:{email:`pilot-timetable-${Date.now()}@example.invalid`,role:"TEACHER",schoolId}});
    let timetableId:string|undefined;
    try{
      const timetable=await db.timetable.create({data:{schoolId,classId,teacherId:teacher.id,dayOfWeek:"THURSDAY",subject:"MATH",periodLabel:`synthetic-pilot-${Date.now()}`,startTime:"08:20",endTime:"09:10"}});
      timetableId=timetable.id;
      const scheduled=previewPolicySchema.parse({...policy,lessons:[{...policy.lessons[0],classIds:[classId],timetable:[{timetableId,classId,subject:"MATH"}]}]});
      const bindingSha256=pilotApprovalBinding(scheduled,selection,packageHash);
      const audit=await db.auditLog.create({data:{userId:"preview-test-authority",schoolId,action:"V4_PILOT_RELEASE_AUTHORIZED",resourceType:"PolicyConfig",resourceId:"preview-test-approval",details:{bindingSha256,syntheticTestOnly:true}}});
      await db.policyConfig.update({where:{id:"preview-test-policy"},data:{config:scheduled}});
      await db.policyConfig.update({where:{id:"preview-test-approval"},data:{config:{status:"AUTHORIZED_PILOT_RELEASE",bindingSha256,auditLogId:audit.id}}});
      const counts=()=>Promise.all([db.grade.count(),db.masteryRecord.count(),db.studentMasteryProfile.count(),db.assignment.count(),db.learningEvent.count(),db.masterySnapshot.count()]);
      const before=await counts();writes.length=0;
      const result=await resolvePilotDay(db,user,new Date("2026-10-22T00:00:00Z"),now,{V4_LEARNING_PREVIEW_ENABLED:"1"});
      expect(result?.periods.find(p=>p.timetableId===timetableId)).toMatchObject({status:"ADMITTED",selection,packageHash});
      expect(writes).toEqual([]);expect(await counts()).toEqual(before);
      await db.timetable.update({where:{id:timetableId},data:{subject:"SCIENCE"}});
      writes.length=0;
      const changed=await resolvePilotDay(db,user,new Date("2026-10-22T00:00:00Z"),now,{V4_LEARNING_PREVIEW_ENABLED:"1"});
      expect(changed?.periods.find(p=>p.timetableId===timetableId)).toMatchObject({status:"GAP",reason:"UNBOUND"});
      expect(writes).toEqual([]);
    }finally{
      await db.policyConfig.update({where:{id:"preview-test-policy"},data:{config:policy}});
      await db.policyConfig.update({where:{id:"preview-test-approval"},data:{config:{status:"AUTHORIZED_PILOT_RELEASE",bindingSha256:pilotApprovalBinding(policy,selection,packageHash),auditLogId}}});
      if(timetableId)await db.timetable.delete({where:{id:timetableId}});
      await db.user.delete({where:{id:teacher.id}});
    }
  });
});
