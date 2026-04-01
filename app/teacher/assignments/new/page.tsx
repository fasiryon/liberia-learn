import Link from "next/link";

export default function TeacherAssignmentNewPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/teacher/assignments" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Assignments
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Create Assignment</h1>
          <p className="mt-2 text-sm text-slate-400">
            Assignment creation in this branch starts from your scheduled lessons and lesson content.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/teacher/schedule"
            className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 hover:border-emerald-400/30"
          >
            <p className="text-sm font-semibold text-slate-100">Open Schedule</p>
            <p className="mt-2 text-sm text-slate-400">
              Start from today&apos;s or upcoming lessons where assignments are linked.
            </p>
          </Link>
          <Link
            href="/teacher/curriculum"
            className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 hover:border-emerald-400/30"
          >
            <p className="text-sm font-semibold text-slate-100">Explore Curriculum</p>
            <p className="mt-2 text-sm text-slate-400">
              Review lesson content before creating or accepting assignment work.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
