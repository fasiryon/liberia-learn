"use client";

import Link from "next/link";

interface StudentSidebarProps {
  school: string;
  teacherName: string;
  studentName: string;
}

export function StudentSidebar({
  school,
  teacherName,
  studentName,
}: StudentSidebarProps) {
  return (
    <aside className="w-full md:w-64 rounded-3xl border border-white/5 bg-slate-950/70 p-4 shadow-lg shadow-black/40 backdrop-blur flex flex-col gap-4">
      <div className="rounded-2xl bg-slate-900/80 p-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Student
        </p>
        <p className="text-sm font-semibold text-slate-100">{studentName}</p>
        <p className="text-[11px] text-slate-400 mt-1">{school}</p>
        <p className="text-[11px] text-slate-400">Teacher: {teacherName}</p>
      </div>

      <nav className="flex flex-col gap-2 text-sm">
        <Link
          href="/"
          className="rounded-xl bg-slate-900/80 px-4 py-2 hover:bg-slate-800 transition"
        >
          Dashboard
        </Link>

        <Link
          href="/student/placement"
          className="rounded-xl bg-slate-900/80 px-4 py-2 hover:bg-slate-800 transition"
        >
          Placement Test
        </Link>

        <Link
          href="/assignments"
          className="rounded-xl bg-slate-900/80 px-4 py-2 hover:bg-slate-800 transition"
        >
          Assignments
        </Link>

        <Link
          href="/ai-tutor"
          className="rounded-xl bg-slate-900/80 px-4 py-2 hover:bg-slate-800 transition"
        >
          AI Tutor
        </Link>
      </nav>
    </aside>
  );
}
