import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SchoolDayJourney } from "@/components/experience/day/SchoolDayJourney";
import { loadV4Preview, V4_REVIEW_BASE_PATH } from "@/lib/curriculum/v4/preview";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";
import { resolveLessonLinks, schoolDayForGrade } from "@/lib/learner-experience/day/loadSchoolDay";

// Reviewer rehearsal of one grade's school day (school-day/1.0.0). Dev-only and reviewer-only like the V4 lesson
// review route (middleware gate); 404 in production builds. Lessons open in that route's Lesson Player V2 only when it
// can load the exact pinned version. Nothing is saved, scored, recorded or released.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "School day review · LiberiaLearn", robots: { index: false, follow: false } };

const GRADE = /^(k|[1-9]|1[0-2])$/;

export default function SchoolDayReviewPage({ params, searchParams }: { params: { grade: string }; searchParams?: { at?: string } }) {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  if (!GRADE.test(params.grade)) notFound();
  const day = schoolDayForGrade(params.grade === "k" ? 0 : Number(params.grade));
  const at = typeof searchParams?.at === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(searchParams.at) ? searchParams.at : null;
  const lessons = resolveLessonLinks(day, V4_REVIEW_BASE_PATH, (selection) => loadV4Preview(selection).ok === true);
  return <SchoolDayJourney day={day} lessons={lessons} clockAt={at}
    attendance={{ status: "NOT_RECORDED", note: "Your teacher takes attendance. This review shows no attendance record." }} />;
}
