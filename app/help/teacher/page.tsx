import Link from "next/link";

const STEPS = [
  {
    title: "1. Sign in and view your classes",
    body: `Sign in with your school-issued Google account. Your dashboard shows each class you teach, the number of enrolled students, and recent activity.`,
  },
  {
    title: "2. Assign homework",
    body: `Go to Homework → New Assignment. Select the class, choose a lesson from the curriculum, set a due date, and click Assign. Students see the assignment on their Today page immediately.`,
  },
  {
    title: "3. Review submissions",
    body: `Open the assignment and click Submissions. AI has already scored each submission — review the score and the reasoning, then confirm or adjust before releasing grades to students.`,
  },
  {
    title: "4. Track class progress",
    body: `The class detail page shows each student's lesson completion rate and quiz scores by subject. Students with a red indicator have not started the week's work.`,
  },
  {
    title: "5. Add a lesson to the timetable",
    body: `You can pin a lesson to a specific time slot in the class timetable. Students on that timetable see the lesson highlighted as "Today's lesson" at the top of their dashboard.`,
  },
  {
    title: "6. Send a guardian alert",
    body: `On a student's profile, click Notify Guardian. Select the alert type (e.g. At-Risk or Assignment Due) and confirm. The guardian receives an SMS within a few seconds.`,
  },
];

export default function TeacherHelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-3">
        <Link href="/help" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          ← Help
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Teacher Guide</h1>
        <p className="mt-2 text-[var(--ll-text-muted)]">
          Assign work, review submissions, and keep guardians informed.
        </p>
      </div>

      <div className="space-y-6">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
            <h2 className="font-semibold text-[var(--ll-text)]">{s.title}</h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)] leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
