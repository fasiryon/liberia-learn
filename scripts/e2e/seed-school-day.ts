import {PrismaClient, type Subject, type Weekday} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {GRADE4_SCHOOLDAY_ACCEPTED} from '../../lib/curriculum/v4/schooldayPackage';
import {previewPolicySchema,pilotApprovalBinding,LEARNING_PREVIEW_POLICY_KEY,PILOT_RELEASE_APPROVAL_KEY} from '../../lib/curriculum/v4/learningPreview';
import {SCHOOL_DAY_IDS as ids,SCHOOL_DAY_EMAILS as emails,SYNTHETIC_MARKER,syntheticSeedTarget,syntheticPasswordForEmail} from './school-day-contract';
import {CURRENT_POLICY_VERSION,DATA_POLICY_KEY} from '../../lib/policy/policyVersion';

export async function seedSchoolDay(db:PrismaClient,now=new Date()) {
  const target=syntheticSeedTarget();
  const identity=await db.$queryRaw<Array<{database:string;username:string}>>`SELECT current_database() AS database, current_user AS username`;
  if(identity.length!==1||identity[0].database!==target.database||identity[0].username!==target.username) throw Error('school_day_database_identity_mismatch');
  const dayOfWeek:Weekday=(['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'] as const)[now.getUTCDay()];
  const subjects:Subject[]=['MATH','SCIENCE','ENGLISH','CIVICS','COMPUTER_SCIENCE','ENGINEERING','ENGLISH','ENGLISH'];
  const selections=Object.entries(GRADE4_SCHOOLDAY_ACCEPTED);
  await db.$transaction(async tx=>{
    if(target.mode==='preview'){
      // Serialize one-time initialization; never rotate a completed fixture's credentials
      // or issue UPDATE against immutable audit history on a duplicate invocation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('g4-synthetic-preview-bootstrap'))`;
      const counts=await Promise.all([tx.school.count(),tx.user.count(),tx.student.count(),tx.class.count(),tx.enrollment.count(),tx.timetable.count(),tx.policyConfig.count(),tx.auditLog.count(),tx.assignment.count(),tx.attendance.count(),tx.grade.count(),tx.masteryRecord.count()]);
      if(counts.some(count=>count!==0))throw Error('school_day_preview_already_initialized');
    }
    for(const id of [ids.school,ids.foreignSchool]) await tx.school.upsert({where:{id},create:{id,name:`${SYNTHETIC_MARKER} ${id}`,status:'ACTIVE'},update:{status:'ACTIVE'}});
    const users=[
      {id:ids.authority,email:emails.authority,role:'ADMIN' as const,schoolId:ids.school,isPlatformAdmin:true},
      {id:ids.teacher,email:emails.teacher,role:'TEACHER' as const,schoolId:ids.school,isPlatformAdmin:false},
      {id:ids.foreignTeacher,email:emails.foreignTeacher,role:'TEACHER' as const,schoolId:ids.foreignSchool,isPlatformAdmin:false},
      {id:ids.studentUser,email:emails.student,role:'STUDENT' as const,schoolId:ids.school,isPlatformAdmin:false},
      {id:ids.admin,email:emails.admin,role:'ADMIN' as const,schoolId:ids.school,isPlatformAdmin:false},
      {id:'g4-e2e-student-user-2',email:emails.student2,role:'STUDENT' as const,schoolId:ids.school,isPlatformAdmin:false},
      {id:'g4-e2e-student-user-3',email:emails.student3,role:'STUDENT' as const,schoolId:ids.school,isPlatformAdmin:false},
    ];
    for(const user of users){
      // The hosted approval actor is metadata only: it must have no password login.
      const hashedPwd=target.mode==='preview'&&user.id===ids.authority ? null : await bcrypt.hash(syntheticPasswordForEmail(user.email),10);
      const onboarding={welcomeCompletedAt:now,privacyAcceptedAt:now,tourCompletedAt:now};
      await tx.user.upsert({where:{id:user.id},create:{...user,hashedPwd,name:SYNTHETIC_MARKER,...onboarding,emailVerified:now},update:{...user,hashedPwd,mustChangePIN:false,...onboarding}});
      // Disposable onboarding fixtures, explicitly not evidence of a real person's consent.
      await tx.dataPolicyAcceptance.upsert({where:{id:user.id+'-synthetic-consent'},create:{id:user.id+'-synthetic-consent',userId:user.id,schoolId:user.schoolId,policyKey:DATA_POLICY_KEY,policyVersion:CURRENT_POLICY_VERSION,source:SYNTHETIC_MARKER,metadata:{syntheticTestOnly:true,notRealConsent:true}},update:{policyVersion:CURRENT_POLICY_VERSION}});
      if(user.role==='TEACHER')await tx.teacherProfile.upsert({where:{userId:user.id},create:{id:user.id+'-profile',userId:user.id,schoolId:user.schoolId,fullName:SYNTHETIC_MARKER,gradesTaught:[],subjectsTaught:['MATH'],isOnboarded:true,onboardedAt:now,updatedAt:now},update:{isOnboarded:true,onboardedAt:now,updatedAt:now}});
    }
    await tx.student.upsert({where:{id:ids.student},create:{id:ids.student,userId:ids.studentUser,currentGrade:4},update:{currentGrade:4,deletedAt:null}});
    await tx.class.upsert({where:{id:ids.class},create:{id:ids.class,schoolId:ids.school,teacherId:ids.teacher,name:SYNTHETIC_MARKER,subject:'MATH',gradeLevel:4},update:{teacherId:ids.teacher}});
    await tx.enrollment.upsert({where:{studentId_classId:{studentId:ids.student,classId:ids.class}},create:{id:'g4-e2e-enrollment',studentId:ids.student,classId:ids.class},update:{}});
    for(const n of [2,3]){
      const studentId=`g4-e2e-student-${n}`;
      await tx.student.upsert({where:{id:studentId},create:{id:studentId,userId:`g4-e2e-student-user-${n}`,currentGrade:4},update:{deletedAt:null,currentGrade:4}});
      await tx.enrollment.upsert({where:{studentId_classId:{studentId,classId:ids.class}},create:{id:`g4-e2e-enrollment-${n}`,studentId,classId:ids.class},update:{}});
    }
    await tx.assignment.upsert({where:{id:'g4-e2e-assignment'},create:{id:'g4-e2e-assignment',classId:ids.class,title:SYNTHETIC_MARKER+' evidence reflection',description:'Synthetic sample only. Explain one actual detail from work attempted; no response, score or completion is prefilled.',points:0,generationMethod:'synthetic_fixture',smsEnabled:false},update:{}});
    await tx.attendance.upsert({where:{id:'g4-e2e-attendance'},create:{id:'g4-e2e-attendance',studentId:ids.student,classId:ids.class,schoolId:ids.school,date:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),status:'PRESENT',markedById:ids.teacher,notes:SYNTHETIC_MARKER+'; not a real attendance event'},update:{date:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()))}});
    const lessons=[];
    for(const [i,[selection,packageHash]] of selections.entries()) {
      const timetableId=`g4-e2e-period-${i+1}`,subject=subjects[i],approvalRecordId=`g4-e2e-approval-${i+1}`;
      const startMinutes=8*60+i*40;
      const time=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
      await tx.timetable.upsert({where:{id:timetableId},create:{id:timetableId,schoolId:ids.school,classId:ids.class,teacherId:ids.teacher,subject,dayOfWeek,periodLabel:`P${i+1}`,startTime:time(startMinutes),endTime:time(startMinutes+35),room:SYNTHETIC_MARKER},update:{dayOfWeek,subject,startTime:time(startMinutes),endTime:time(startMinutes+35)}});
      lessons.push({selection,packageHash,revokedAt:null,approvalRecordId,timetable:[{classId:ids.class,timetableId,subject}],reviews:{content:SYNTHETIC_MARKER,rights:SYNTHETIC_MARKER,access:SYNTHETIC_MARKER,accessibility:SYNTHETIC_MARKER,safety:SYNTHETIC_MARKER,runtime:SYNTHETIC_MARKER,releaseAuthorization:SYNTHETIC_MARKER}});
    }
    const dayStart=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
    const policy=previewPolicySchema.parse({version:'learning-preview/1.0.0',status:'PILOT_ONLY',enabled:true,revokedAt:null,startsAt:new Date(dayStart-3600000).toISOString(),endsAt:new Date(dayStart+2*86400000).toISOString(),schoolId:ids.school,studentUserIds:[ids.studentUser,'g4-e2e-student-user-2','g4-e2e-student-user-3'],classIds:[ids.class],canonicalRecordWrites:false,offlineDelivery:true,offlineMaxAgeSeconds:300,lessons});
    await tx.policyConfig.upsert({where:{id:ids.policy},create:{id:ids.policy,policyKey:LEARNING_PREVIEW_POLICY_KEY,scope:'SCHOOL',schoolId:ids.school,createdById:ids.authority,config:policy},update:{isActive:true,config:policy}});
    for(const lesson of policy.lessons){
      const bindingSha256=pilotApprovalBinding(policy,lesson.selection,lesson.packageHash),auditLogId=lesson.approvalRecordId+'-audit';
      await tx.policyConfig.upsert({where:{id:lesson.approvalRecordId},create:{id:lesson.approvalRecordId,policyKey:PILOT_RELEASE_APPROVAL_KEY,scope:'SCHOOL',schoolId:ids.school,createdById:ids.authority,config:{status:'AUTHORIZED_PILOT_RELEASE',bindingSha256,auditLogId}},update:{isActive:true,config:{status:'AUTHORIZED_PILOT_RELEASE',bindingSha256,auditLogId}}});
      await tx.auditLog.upsert({where:{id:auditLogId},create:{id:auditLogId,userId:ids.authority,schoolId:ids.school,action:'V4_PILOT_RELEASE_AUTHORIZED',resourceType:'PolicyConfig',resourceId:lesson.approvalRecordId,details:{bindingSha256,syntheticTestOnly:true,fixture:SYNTHETIC_MARKER}},update:{details:{bindingSha256,syntheticTestOnly:true,fixture:SYNTHETIC_MARKER}}});
    }
  },{timeout:30000,...(target.mode==='preview'?{isolationLevel:'Serializable' as const}:{})});
  return {...ids,fixture:SYNTHETIC_MARKER,packageHashes:selections.map(([,hash])=>hash)};
}

export async function runSchoolDaySeed(){
  // Guard BEFORE constructing a client, and never load .env.local or redirect to DIRECT_URL.
  const {url}=syntheticSeedTarget();
  const db=new PrismaClient({datasources:{db:{url}}});
  try {console.log(JSON.stringify(await seedSchoolDay(db)));} finally {await db.$disconnect();}
}
if(process.argv[1]&&/seed-school-day\.(?:ts|js)$/.test(process.argv[1])) void runSchoolDaySeed().catch(error=>{console.error(error instanceof Error&&/^school_day_[a-z_]+$/.test(error.message)?error.message:'school_day_seed_failed');process.exitCode=1;});
