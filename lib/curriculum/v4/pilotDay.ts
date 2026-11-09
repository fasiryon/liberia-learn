/** Read-only links over the existing Timetable and exact Learning Preview loader.
 * This resolves authorized content, not curriculum planning, assignments or grades.
 * CoS resolved-days remain the sole planning authority for the day-shell UI. */
import type {PrismaClient,Weekday} from "@prisma/client";
import {isLearningPreviewEnabled,LEARNING_PREVIEW_POLICY_KEY,previewPolicySchema,loadStudentLearningPreview} from "./learningPreview";

type DayDatabase=Pick<PrismaClient,"user"|"policyConfig"|"auditLog"|"timetable">;
type User=Parameters<typeof loadStudentLearningPreview>[1];
export type PilotDayPeriod={timetableId:string;classId:string;subject:string;periodLabel:string;startTime:string|null;endTime:string|null}&(
  {status:"ADMITTED";selection:string;packageHash:string;href:string}|
  {status:"GAP";reason:"UNBOUND"|"AMBIGUOUS_BINDING"|"NOT_ADMITTED"}
);
export type PilotDay={date:string;status:"PILOT_ONLY";canonicalRecordWrites:false;periods:PilotDayPeriod[]};
const WEEKDAYS:readonly Weekday[]=["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

/** Dates and bells use Liberia local time, UTC. A day link is not a reusable grant:
 * the player rechecks current authorization and sealed bytes on every delivery.
 * Null is a concealed/disabled day; unsupported or denied periods are explicit gaps.
 * Exceptions propagate to the server boundary; never produce a fallback link. */
export async function resolvePilotDay(db:DayDatabase,user:User,date:Date,now=Date.now(),env:Record<string,string|undefined>=process.env):Promise<PilotDay|null>{
  if(!isLearningPreviewEnabled(env)||user.role!=="STUDENT"||!user.schoolId||!Number.isFinite(now)||!(date instanceof Date)||!Number.isFinite(date.getTime()))return null;
  const current=await db.user.findUnique({where:{id:user.id},select:{id:true,role:true,schoolId:true,school:{select:{status:true}},student:{select:{deletedAt:true,enrollments:{select:{Class:{select:{id:true,schoolId:true}}}}}}}});
  if(!current||current.role!=="STUDENT"||current.schoolId!==user.schoolId||current.school?.status!=="ACTIVE"||!current.student||current.student.deletedAt)return null;
  const policies=await db.policyConfig.findMany({where:{policyKey:LEARNING_PREVIEW_POLICY_KEY,scope:"SCHOOL",schoolId:current.schoolId,isActive:true},select:{config:true},take:2});
  if(policies.length!==1)return null;
  const parsed=previewPolicySchema.safeParse(policies[0].config);
  if(!parsed.success)return null;
  const policy=parsed.data,startsAt=Date.parse(policy.startsAt),endsAt=Date.parse(policy.endsAt);
  if(!policy.enabled||policy.revokedAt!==null||policy.schoolId!==current.schoolId||!policy.studentUserIds.includes(current.id)||now<startsAt||now>=endsAt)return null;
  const dayStart=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
  if(dayStart>=endsAt||dayStart+86400000<=startsAt)return null;
  const classIds=current.student.enrollments.map(e=>e.Class).filter(c=>c.schoolId===current.schoolId&&policy.classIds.includes(c.id)).map(c=>c.id);
  if(!classIds.length)return null;
  // Reuse existing timetable records and tenant scoping. Read no assignments or
  // historical learning data. Bound unexpectedly large results instead of truncating.
  const slots=await db.timetable.findMany({where:{schoolId:current.schoolId,classId:{in:classIds},class:{schoolId:current.schoolId},dayOfWeek:WEEKDAYS[date.getUTCDay()]},select:{id:true,schoolId:true,classId:true,subject:true,periodLabel:true,startTime:true,endTime:true},take:257});
  if(slots.length>256)return null;
  const periods:PilotDayPeriod[]=[];
  for(const slot of [...slots].sort((a,b)=>(a.startTime??"99:99").localeCompare(b.startTime??"99:99")||a.id.localeCompare(b.id))){
    if(slot.schoolId!==current.schoolId||!classIds.includes(slot.classId))return null;
    const base={timetableId:slot.id,classId:slot.classId,subject:slot.subject,periodLabel:slot.periodLabel,startTime:slot.startTime,endTime:slot.endTime};
    // Subject is a consistency check on an explicit id binding, never a search key.
    const matches=policy.lessons.filter(lesson=>lesson.timetable?.some(binding=>binding.timetableId===slot.id&&binding.classId===slot.classId&&binding.subject===slot.subject));
    if(matches.length!==1){periods.push({...base,status:"GAP",reason:matches.length?"AMBIGUOUS_BINDING":"UNBOUND"});continue;}
    const entry=matches[0];
    // The canonical loader re-reads membership, approval/audit and policy, including
    // the exact timetable binding, and verifies all package files and map binding.
    const loaded=await loadStudentLearningPreview(db,user,entry.selection,now,{timetableId:slot.id,classId:slot.classId,subject:slot.subject});
    if(!loaded||loaded.identity.selection!==entry.selection||loaded.identity.packageHash!==entry.packageHash){periods.push({...base,status:"GAP",reason:"NOT_ADMITTED"});continue;}
    periods.push({...base,status:"ADMITTED",selection:entry.selection,packageHash:entry.packageHash,href:`/learn/preview/${encodeURIComponent(entry.selection)}`});
  }
  return {date:new Date(dayStart).toISOString().slice(0,10),status:"PILOT_ONLY",canonicalRecordWrites:false,periods};
}
