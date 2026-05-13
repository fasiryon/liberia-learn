"use client";

import Link from "next/link";
import { BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

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
  const [moreOpen, setMoreOpen] = useState(false);

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
        <Link href="/dashboard" className={navLinkClass}>
          Dashboard
        </Link>

        <Link href="/student/today" className={navLinkClass}>
          Today
        </Link>

        <Link href="/assignments" className={navLinkClass}>
          Assignments
        </Link>

        <Link href="/ai-tutor" className={navLinkClass}>
          AI Tutor
        </Link>

        <div className="w-full h-px bg-[var(--ll-border)] my-1" />

        <Link href="/student/adaptive" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
          My Practice
        </Link>

        <Link href="/student/events" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
          Events
        </Link>

        <Link href="/student/discussion" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
          Discussion
        </Link>

        <Link href="/student/exams" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
          Exams
        </Link>

        <Link href="/student/certificates" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
          Certificates
        </Link>

        <Link href="/student/portfolio" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
          My Portfolio
        </Link>

        <Link href="/student/textbooks" className={`${navLinkClass} inline-flex items-center gap-2 text-[var(--ll-text-faint)]`}>
          <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          <span>Textbooks</span>
        </Link>

        <div className="mt-2 border-t border-[var(--ll-border)] pt-2">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={`${navLinkClass} flex w-full items-center justify-between text-left`}
            aria-expanded={moreOpen}
          >
            <span>More</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
          {moreOpen ? (
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/student/transcript" className={`${navLinkClass} text-[var(--ll-text-faint)]`}>
                Transcript
              </Link>
              <Link href="/student/placement" className={navLinkClass}>
                Placement Test
              </Link>
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
