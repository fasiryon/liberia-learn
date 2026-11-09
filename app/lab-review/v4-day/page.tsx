import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/components/experience/day/day.css";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";
import { schoolDayForGrade } from "@/lib/learner-experience/day/loadSchoolDay";
import { dayCoverage, GRADES, gradeLabel } from "@/lib/learner-experience/day/schoolDay";

// Reviewer index of the K-12 school days. Dev-only and reviewer-only (same gate as /lab-review/v4-lessons).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "School days review · LiberiaLearn", robots: { index: false, follow: false } };

export default function SchoolDaysIndexPage() {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const days = GRADES.map((grade) => ({ grade, day: schoolDayForGrade(grade) }));
  return <main className="ll7-day ll3-scope" data-school-days-index>
    <h1 className="ll7-day-title">School days, Kindergarten to Grade 12</h1>
    <p className="ll7-day-rehearsal">Reviewer rehearsal. Every day is the Chief of Staff resolved day for that grade. A period with no approved lesson says so.</p>
    <ul className="ll7-day-list ll7-day-list--G3_5">
      {days.map(({ grade, day }) => { const c = dayCoverage(day);
        return <li key={grade}><Link className="ll7-day-slot" href={`/lab-review/v4-day/${grade === 0 ? "k" : grade}`} data-grade={gradeLabel(grade)}>
          <span className="ll7-day-slot-text"><span className="ll7-day-slot-name">Grade {gradeLabel(grade)}</span>
            <span className="ll7-day-slot-time">{c.lessons} lesson period{c.lessons === 1 ? "" : "s"} · {c.gaps} gap{c.gaps === 1 ? "" : "s"}</span></span>
        </Link></li>; })}
    </ul>
  </main>;
}
