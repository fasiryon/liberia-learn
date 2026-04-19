"use client";

import Link from "next/link";

interface StudentSidebarProps {
  school: string;
  teacherName: string;
  studentName: string;
}

const navLinkClass =
  "rounded-lg bg-[var(--ll-surface-muted)] px-4 py-2 transition hover:bg-[var(--ll-surface)]";

export function StudentSidebar({
  school,
  teacherName,
  studentName,
}: StudentSidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 shadow-none md:w-64">
      <div className="rounded-lg bg-[var(--ll-surface-muted)] p-4">
        <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-faint)]">
          Student
        </p>
        <p className="text-sm font-semibold text-[var(--ll-text)]">{studentName}</p>
        <p className="mt-1 text-[11px] text-[var(--ll-text-muted)]">{school}</p>
        <p className="text-[11px] text-[var(--ll-text-muted)]">Teacher: {teacherName}</p>
      </div>

      <nav className="flex flex-col gap-2 text-sm">
        <Link href="/" className={navLinkClass}>
          Dashboard
        </Link>

        <Link href="/student/placement" className={navLinkClass}>
          Placement Test
        </Link>

        <Link href="/assignments" className={navLinkClass}>
          Assignments
        </Link>

        <Link href="/student/adaptive" className={navLinkClass}>
          My Practice
        </Link>

        <Link href="/student/exams" className={navLinkClass}>
          Exams
        </Link>

        <Link href="/student/certifications" className={navLinkClass}>
          Certifications
        </Link>

        <Link href="/student/textbooks" className={navLinkClass}>
          Textbooks
        </Link>

        <Link href="/student/transcript" className={navLinkClass}>
          Transcript
        </Link>

        <Link href="/ai-tutor" className={navLinkClass}>
          AI Tutor
        </Link>
      </nav>
    </aside>
  );
}
