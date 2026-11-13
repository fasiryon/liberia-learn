import type {PrismaClient,Weekday} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {hash} from '../../lib/content-factory/v4/generation';
import {validatePreviewTarget} from './preview-target.mjs';
import {SCHOOL_DAY_IDS as ids,SYNTHETIC_MARKER} from '../e2e/school-day-contract';
import {GRADE4_SCHOOLDAY_ACCEPTED,loadSchooldayPackage} from '../../lib/curriculum/v4/schooldayPackage';
import {previewPolicySchema,pilotApprovalBinding,LEARNING_PREVIEW_POLICY_KEY,PILOT_RELEASE_APPROVAL_KEY} from '../../lib/curriculum/v4/learningPreview';

const fail=(code:string):never=>{throw Error(`preview_reanchor_${code}`);};
const same=(a:readonly string[],b:readonly string[])=>a.length===b.length&&[...a].sort().join('\n')===[...b].sort().join('\n');
const subjects=['MATH','SCIENCE','ENGLISH','CIVICS','COMPUTER_SCIENCE','ENGINEERING','ENGLISH','ENGLISH'];
const weekdays:Weekday[]=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
export type ReanchorInput={schoolId:string;classId:string;date:string};

/** Operator-only synthetic maintenance. No seed/reset, user writes, API, migration or canonical records. */
export async function reanchorPreviewDay(db:PrismaClient,input:ReanchorInput,env:NodeJS.ProcessEnv=process.env){
  // Validate before starting any transaction, even for callers other than the CLI.
  const target=validatePreviewTarget(env);
  if(input.schoolId!==ids.school||input.classId!==ids.class)fail('scope_refused');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date))fail('date_refused');
  const date=new Date(`${input.date}T00:00:00.000Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==input.date)fail('date_refused');
  const today=new Date();today.setUTCHours(0,0,0,0);
  if(date.getTime()<today.getTime()||date.getTime()>today.getTime()+14*86400000)fail('date_window_refused');
  const startsAt=date.toISOString(),endsAt=new Date(date.getTime()+86400000).toISOString();
  const dayOfWeek=weekdays[date.getUTCDay()];
  const students=[ids.student,'g4-e2e-student-2','g4-e2e-student-3'];
  const studentUsers=[ids.studentUser,'g4-e2e-student-user-2','g4-e2e-student-user-3'];
  const entries=Object.entries(GRADE4_SCHOOLDAY_ACCEPTED);
  const periodIds=entries.map((_,i)=>`g4-e2e-period-${i+1}`);
  try{
    return await db.$transaction(async tx=>{
      const identity=await tx.$queryRaw<Array<{database:string;username:string;superuser:boolean;createdb:boolean;createrole:boolean;bypassrls:boolean;replication:boolean}>>`
        SELECT current_database() AS database, current_user AS username,
          rolsuper AS superuser, rolcreatedb AS createdb, rolcreaterole AS createrole,
          rolbypassrls AS bypassrls, rolreplication AS replication
        FROM pg_roles WHERE rolname=current_user`;
      if(identity.length!==1||identity[0].database!=='postgres'||identity[0].username!=='preview_app'||
        [identity[0].superuser,identity[0].createdb,identity[0].createrole,identity[0].bypassrls,identity[0].replication].some(flag=>flag!==false))fail('role_refused');
      const school=await tx.school.findUnique({where:{id:ids.school}});
      const rosterClass=await tx.class.findUnique({where:{id:ids.class}});
      if(!school||school.status!=='ACTIVE'||school.name!==`${SYNTHETIC_MARKER} ${ids.school}`||
        !rosterClass||rosterClass.schoolId!==ids.school||rosterClass.teacherId!==ids.teacher||rosterClass.gradeLevel!==4||rosterClass.name!==SYNTHETIC_MARKER||rosterClass.subject!=='MATH')fail('class_refused');
      const roster=await tx.enrollment.findMany({where:{classId:ids.class}});
      const learners=await tx.student.findMany({where:{id:{in:students}}});
      if(!same(roster.map(r=>r.studentId),students)||learners.length!==3||learners.some(s=>s.deletedAt!==null||s.currentGrade!==4||s.userId!==studentUsers[students.indexOf(s.id)]))fail('roster_refused');
      const users=await tx.user.findMany({where:{id:{in:[...studentUsers,ids.teacher,ids.admin,ids.authority]}}});
      for(const [id,role] of [...studentUsers.map(id=>[id,'STUDENT']),[ids.teacher,'TEACHER'],[ids.admin,'ADMIN']]){
        const user=users.find(u=>u.id===id);
        if(!user||user.role!==role||user.schoolId!==ids.school||user.isPlatformAdmin!==false||!user.hashedPwd)fail('reviewer_refused');
      }
      const authority=users.find(u=>u.id===ids.authority);
      if(!authority||authority.role!=='ADMIN'||authority.schoolId!==ids.school||authority.isPlatformAdmin!==true||authority.hashedPwd!==null)fail('authority_refused');
      if(await tx.user.count({where:{isPlatformAdmin:true,hashedPwd:{not:null}}})!==0)fail('platform_password_refused');
      const profile=await tx.teacherProfile.findUnique({where:{userId:ids.teacher}});
      if(!profile||profile.schoolId!==ids.school||!profile.isOnboarded)fail('teacher_refused');
      const periods=await tx.timetable.findMany({where:{OR:[{classId:ids.class},{id:{in:periodIds}}]}});
      if(!same(periods.map(p=>p.id),periodIds))fail('periods_refused');
      const oldDay=periods[0].dayOfWeek;
      for(const [i,id] of periodIds.entries()){
        const period=periods.find(p=>p.id===id)!;
        const hhmm=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
        if(period.schoolId!==ids.school||period.classId!==ids.class||period.teacherId!==ids.teacher||period.dayOfWeek!==oldDay||period.subject!==subjects[i]||period.periodLabel!==`P${i+1}`||period.room!==SYNTHETIC_MARKER||period.startTime!==hhmm(480+i*40)||period.endTime!==hhmm(515+i*40))fail('period_binding_refused');
      }
      const policies=await tx.policyConfig.findMany({where:{OR:[{id:ids.policy},{policyKey:LEARNING_PREVIEW_POLICY_KEY,scope:'SCHOOL',schoolId:ids.school,isActive:true}]}});
      if(policies.length!==1)fail('policy_refused');
      const row=policies[0],parsed=previewPolicySchema.safeParse(row.config);
      if(row.id!==ids.policy||row.policyKey!==LEARNING_PREVIEW_POLICY_KEY||row.scope!=='SCHOOL'||row.schoolId!==ids.school||!row.isActive||row.createdById!==ids.authority||!parsed.success)fail('policy_refused');
      const policy=parsed.data;
      const previousConfigSha256=hash(row.config);
      if(!policy.enabled||policy.revokedAt!==null||policy.schoolId!==ids.school||!same(policy.classIds,[ids.class])||!same(policy.studentUserIds,studentUsers)||policy.lessons.length!==8||!policy.offlineDelivery||policy.offlineMaxAgeSeconds!==300)fail('policy_scope_refused');
      const approvals=[];
      for(const [i,[selection,packageHash]] of entries.entries()){
        const lesson=policy.lessons.find(l=>l.selection===selection);
        if(!lesson||lesson.packageHash!==packageHash||lesson.revokedAt!==null||!new RegExp(`^g4-e2e-approval-${i+1}(?:-g4-preview-reanchor-[a-f0-9-]{36})?$`).test(lesson.approvalRecordId)||lesson.classIds!==undefined||lesson.timetable?.length!==1||
          lesson.timetable[0].classId!==ids.class||lesson.timetable[0].timetableId!==periodIds[i]||lesson.timetable[0].subject!==subjects[i]||Object.values(lesson.reviews).some(value=>value!==SYNTHETIC_MARKER))fail('lesson_refused');
        // Verify actual sealed bytes before any writes. Never substitute a fixture projection.
        if(loadSchooldayPackage(selection).identity.packageHash!==packageHash)fail('package_refused');
        const approval=await tx.policyConfig.findUnique({where:{id:lesson.approvalRecordId}});
        const config=approval?.config as {status?:string;bindingSha256?:string;auditLogId?:string}|null;
        const binding=pilotApprovalBinding(policy,selection,packageHash);
        if(!approval||approval.policyKey!==PILOT_RELEASE_APPROVAL_KEY||approval.scope!=='SCHOOL'||approval.schoolId!==ids.school||!approval.isActive||approval.createdById!==ids.authority||config?.status!=='AUTHORIZED_PILOT_RELEASE'||config.bindingSha256!==binding||!config.auditLogId)fail('approval_refused');
        const audit=await tx.auditLog.findUnique({where:{id:config.auditLogId}});
        const details=audit?.details as {bindingSha256?:string;syntheticTestOnly?:boolean;fixture?:string}|null;
        if(!audit||audit.userId!==ids.authority||audit.schoolId!==ids.school||audit.action!=='V4_PILOT_RELEASE_AUTHORIZED'||audit.resourceType!=='PolicyConfig'||audit.resourceId!==approval.id||details?.bindingSha256!==binding||details.syntheticTestOnly!==true||details.fixture!==SYNTHETIC_MARKER)fail('audit_refused');
        approvals.push({id:approval.id,selection,packageHash});
      }
      const operationId=`g4-preview-reanchor-${randomUUID()}`;
      const changed=policy.startsAt!==startsAt||policy.endsAt!==endsAt||oldDay!==dayOfWeek;
      const next=previewPolicySchema.parse({...policy,startsAt,endsAt,lessons:policy.lessons.map(lesson=>({...lesson,approvalRecordId:changed?`g4-e2e-approval-${entries.findIndex(([selection])=>selection===lesson.selection)+1}-${operationId}`:lesson.approvalRecordId}))});
      if(changed){
        const updated=await tx.timetable.updateMany({where:{schoolId:ids.school,classId:ids.class,id:{in:periodIds}},data:{dayOfWeek}});
        if(updated.count!==8)fail('period_count_refused');
        await tx.policyConfig.update({where:{id:ids.policy},data:{config:next}});
        for(const [i,approval] of approvals.entries()){
          const bindingSha256=pilotApprovalBinding(next,approval.selection,approval.packageHash);
          const auditLogId=`${operationId}-approval-${i+1}`,newApprovalId=next.lessons.find(lesson=>lesson.selection===approval.selection)!.approvalRecordId;
          await tx.policyConfig.create({data:{id:newApprovalId,policyKey:PILOT_RELEASE_APPROVAL_KEY,scope:'SCHOOL',schoolId:ids.school,createdById:ids.authority,isActive:true,config:{status:'AUTHORIZED_PILOT_RELEASE',bindingSha256,auditLogId}}});
          await tx.auditLog.create({data:{id:auditLogId,userId:ids.authority,schoolId:ids.school,action:'V4_PILOT_RELEASE_AUTHORIZED',resourceType:'PolicyConfig',resourceId:newApprovalId,details:{bindingSha256,syntheticTestOnly:true,fixture:SYNTHETIC_MARKER,actor:'synthetic-fixture-authority',reanchorOperationId:operationId}}});
          await tx.policyConfig.update({where:{id:approval.id},data:{isActive:false}});
        }
      }
      // Append-only audit, including repeat/no-op invocations. This is an operator action, not a user login.
      await tx.auditLog.create({data:{id:operationId,schoolId:ids.school,action:'SYNTHETIC_PREVIEW_DAY_REANCHORED',resourceType:'PolicyConfig',resourceId:ids.policy,
        details:{syntheticTestOnly:true,fixture:SYNTHETIC_MARKER,operator:'private-console',previousConfigSha256,classId:ids.class,date:input.date,previousWeekday:oldDay,weekday:dayOfWeek,previousStartsAt:policy.startsAt,previousEndsAt:policy.endsAt,startsAt,endsAt,periods:8,packageHashes:entries.map(([,hash])=>hash),changed,canonicalRecordWrites:false}}});
      return {status:changed?'REANCHORED':'ALREADY_ANCHORED',projectRef:target.projectRef,date:input.date,schoolId:ids.school,classId:ids.class,weekday:dayOfWeek,startsAt,endsAt,periods:8,auditId:operationId};
    },{isolationLevel:'Serializable',timeout:30000});
  }catch(error){
    if(error instanceof Error&&/^preview_reanchor_[a-z_]+$/.test(error.message))throw error;
    // Never propagate query text, connection strings, passwords or raw driver errors.
    throw Error('preview_reanchor_failed');
  }
}
