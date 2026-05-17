import Link from "next/link";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherHelpPage() {
  await requireRole("TEACHER");

  const guideUrl = process.env.TEACHER_GUIDE_BLOB_URL ?? null;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
        <header>
          <Link href="/teacher" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Back to Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Teacher Help Centre</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Everything you need to get the most out of LiberiaLearn.
          </p>
          {guideUrl && (
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/30 hover:bg-[var(--ll-yellow-soft)] transition"
            >
              Download Quick-Start Guide (PDF)
            </a>
          )}
        </header>

        {/* Getting Started */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Getting Started — 5 Key Steps</h2>
          <ol className="space-y-4 list-none">
            {[
              { n: "1", title: "Create a Class", desc: "Go to Classes → New Class. Choose a subject and grade level. Your students will enrol using the class code." },
              { n: "2", title: "Add Students", desc: "Share your school code with students so they can self-register, or use Admin → Import Students to bulk-upload a CSV." },
              { n: "3", title: "Assign a Lesson", desc: "Browse the Curriculum Library, pick a MOE-aligned lesson, and click 'Assign to Class'. It appears in students' Today view instantly." },
              { n: "4", title: "Review Homework", desc: "Open Assignments → Submissions. AI pre-grades each submission — you approve or adjust before grades are released." },
              { n: "5", title: "Message a Guardian", desc: "Open a student's profile → Message Guardian. Guardians receive a push notification and can reply from their portal." },
            ].map(({ n, title, desc }) => (
              <li key={n} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ll-yellow)]/20 text-sm font-bold text-[var(--ll-yellow)]">{n}</span>
                <div>
                  <p className="font-semibold text-sm text-[var(--ll-text)]">{title}</p>
                  <p className="text-sm text-[var(--ll-text-muted)] mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Feature Overview */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Feature Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)]">
                  <th className="pb-2 text-left font-semibold text-[var(--ll-text)]">Feature</th>
                  <th className="pb-2 text-left font-semibold text-[var(--ll-text)]">Where to find it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ll-border)]">
                {[
                  ["Lessons", "/teacher/lessons"],
                  ["Assignments & Grading", "/teacher/assignments"],
                  ["Gradebook & Report Cards", "/teacher/gradebook"],
                  ["AI Tutor Oversight", "/teacher/tutor-analytics"],
                  ["Guardian Messages", "/teacher/messages"],
                  ["Offline Mode", "Automatically enabled on poor connections"],
                  ["Alert Preferences", "/teacher/settings/alerts"],
                ].map(([feat, path]) => (
                  <tr key={feat}>
                    <td className="py-2.5 text-[var(--ll-text)]">{feat}</td>
                    <td className="py-2.5 text-[var(--ll-text-muted)]">{path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Troubleshooting</h2>
          <div className="space-y-4 text-sm">
            {[
              { q: "Students can't see the lesson I assigned", a: "Make sure the lesson is published (not 'Draft'). Go to Curriculum → My Lessons and check the status badge." },
              { q: "Offline mode isn't saving lessons", a: "Students must tap 'Save for Offline' on each lesson while connected. The offline banner appears automatically when connection drops." },
              { q: "I forgot my password", a: "Go to the login page → Forgot Password. A reset link will be sent to your registered email." },
              { q: "AI grades seem wrong", a: "You have full authority to override any AI grade in the Submissions view. Approved grades are final and visible to students." },
              { q: "A guardian isn't receiving messages", a: "Confirm the guardian has linked their account via the guardian portal. Check their notification settings in their profile." },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
                <p className="font-semibold text-[var(--ll-text)]">{q}</p>
                <p className="mt-1 text-[var(--ll-text-muted)]">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Support */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="text-lg font-semibold">Need more help?</h2>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Contact the LiberiaLearn support team at{" "}
            <a href="mailto:liberialearn52@gmail.com" className="text-[var(--ll-yellow)] underline underline-offset-2">
              liberialearn52@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
