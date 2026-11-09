import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLearningPreviewEnabled } from "@/lib/curriculum/v4/learningPreview";
import { resolvePilotDay } from "@/lib/curriculum/v4/pilotDay";
import { SchoolDayJourney } from "@/components/experience/day/SchoolDayJourney";
import { schoolDayForGrade } from "@/lib/learner-experience/day/loadSchoolDay";
import { GRADES, type SchoolDay } from "@/lib/learner-experience/day/schoolDay";
import { cosDayForPilot, parseRehearsalClock, returnBlock, schoolDayFromPilot } from "@/lib/learner-experience/day/pilotSchoolDay";
import { daySessionKey } from "@/lib/learner-experience/day/daySessionKey";

// The student's pilot school day. Same gate and admission as /learn/preview: T2's resolvePilotDay decides which
// periods exist and which open (each in /learn/preview); the CoS resolved days only add planning context. Any
// failure is a 404, never a fallback link. PILOT_ONLY: nothing is saved, graded or written to a record.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "My school day | LiberiaLearn", robots: { index: false, follow: false } };

const ATTENDANCE = { status: "NOT_RECORDED", note: "Your teacher records attendance." } as const;

/** Every CoS resolved day, or none: a malformed plan withholds all planning context rather than part of it. */
function cosDays(): SchoolDay[] {
  try { return GRADES.map(schoolDayForGrade); } catch { return []; }
}

export default async function LearnDayPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> } = {}) {
  noStore();
  if (!isLearningPreviewEnabled()) notFound();
  const resolved = await (async () => {
    try {
      const user = await requireRole("STUDENT");
      return { userId: user.id, pilot: await resolvePilotDay(prisma, user, new Date()) };
    } catch { return null; }
  })();
  const pilot = resolved?.pilot ?? null;
  const userId = resolved?.userId ?? null;
  if (!pilot || pilot.canonicalRecordWrites !== false) notFound();
  if (!pilot.periods.length) {
    return <main className="ll7-day ll3-scope" data-day-source="PILOT_TIMETABLE" data-day-empty="">
      <h1 className="ll7-day-title">My school day</h1>
      <p className="ll7-day-note">There are no classes on your timetable today.</p>
    </main>;
  }
  const { day, lessons } = schoolDayFromPilot(pilot, cosDayForPilot(pilot, cosDays()));
  // B1/B2: a return link may only select a period this student's own resolved day admitted (returnBlock checks it).
  const back = returnBlock(day, lessons, { after: searchParams?.after, at: searchParams?.at });
  // Display-only browser-session state is keyed by the plan, a digest of its full definition (Atlas R1) and a hash of the signed-in user (never the raw id).
  const sessionKey = userId ? daySessionKey(day, lessons, userId) : null;
  return <SchoolDayJourney day={day} lessons={lessons} attendance={ATTENDANCE} initialBlockId={back?.blockId ?? null} initialAnnouncement={back?.announcement ?? null}
    returnedFromBlockId={back?.fromBlockId ?? null} sessionKey={sessionKey} clockAt={parseRehearsalClock(searchParams?.clock)} />;
}
