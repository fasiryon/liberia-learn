import Link from "next/link";

const STEPS = [
  {
    title: "1. Create your first class",
    body: `Go to Classes → New Class. Enter the class name, subject, and grade level. Save — your class is now ready to enroll students.`,
  },
  {
    title: "2. Enroll students",
    body: `Open Enrollments. Search for students by name or ID and assign them to a class. Students immediately gain access to that subject's lessons on their dashboard.`,
  },
  {
    title: "3. Set up the timetable",
    body: `Under Timetable, assign teachers and time slots to each class. Students see their timetable on the Today page.`,
  },
  {
    title: "4. Link guardians",
    body: `Visit Guardian Links. Enter the guardian's phone number and select the student. The guardian will receive an SMS with a PIN to access progress reports.`,
  },
  {
    title: "5. Invite teachers",
    body: `Go to Invites and generate a teacher invite link. Send the link to the teacher — they sign in with Google and are automatically assigned to your school.`,
  },
  {
    title: "6. Approve curriculum",
    body: `Open Content Review to see lessons awaiting approval. Review each lesson, then click Approve to make it visible to students or Reject to send it back for revision.`,
  },
  {
    title: "7. Monitor the pilot",
    body: `The Dashboard shows active students, lessons completed, and AI cost at a glance. The Pilot Score page gives a readiness rating before external assessment.`,
  },
];

export default function AdminHelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-3">
        <Link href="/help" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          ← Help
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Admin Guide</h1>
        <p className="mt-2 text-[var(--ll-text-muted)]">
          Everything you need to set up and run your school on LiberiaLearn.
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
