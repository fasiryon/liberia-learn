"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AlignedContent = {
  contentId: string;
  title: string;
  grade: number;
};

type Standard = {
  code: string;
  description: string;
  alignedContent: AlignedContent[];
};

type Band = {
  band: string;
  bandLabel: string;
  standards: Standard[];
};

type SubjectGroup = {
  subject: string;
  hasStandards: boolean;
  bands: Band[];
};

type StandardsBrowserResponse = {
  subjects: SubjectGroup[];
  generatedAt: string;
};

const SUBJECT_LABEL: Record<string, string> = {
  MATH: "Mathematics",
  SCIENCE: "Science",
  COMPUTER_SCIENCE: "Computer Science",
  ENGINEERING: "Engineering",
  LITERACY: "Literacy",
  ENGLISH: "English",
  CIVICS: "Civics",
  ARTS: "Arts",
  PE: "Physical Education",
  CAREER: "Career Education",
};

export function TeacherStandardsBrowser() {
  const [data, setData] = useState<StandardsBrowserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/standards", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((json: StandardsBrowserResponse) => {
        if (!active) return;
        setData(json);
        const firstWithStandards = json.subjects.find((s) => s.hasStandards);
        setActiveSubject(firstWithStandards?.subject ?? json.subjects[0]?.subject ?? null);
      })
      .catch((err) => active && setError(String(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const activeGroup = useMemo(
    () => data?.subjects.find((s) => s.subject === activeSubject) ?? null,
    [data, activeSubject]
  );

  const filteredBands = useMemo(() => {
    if (!activeGroup) return [];
    const q = query.trim().toLowerCase();
    if (!q) return activeGroup.bands;
    return activeGroup.bands
      .map((band) => ({
        ...band,
        standards: band.standards.filter(
          (s) => s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        ),
      }))
      .filter((band) => band.standards.length > 0);
  }, [activeGroup, query]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-[var(--ll-surface)]" />;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Could not load standards: {error}
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MOE Curriculum Standards</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Browse curriculum standards by subject and grade band, and see which lessons already
          cover each one. This is the general teaching-standards layer, separate from the WAEC
          exam-syllabus map used for WAEC Prep.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--ll-border)] pb-4">
        {data.subjects.map((subject) => (
          <button
            key={subject.subject}
            type="button"
            onClick={() => setActiveSubject(subject.subject)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeSubject === subject.subject
                ? "bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]"
                : "border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
            }`}
          >
            {SUBJECT_LABEL[subject.subject] ?? subject.subject}
            {!subject.hasStandards ? (
              <span className="text-xs text-[var(--ll-text-faint)]">(none yet)</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeGroup ? (
        activeGroup.hasStandards ? (
          <div className="space-y-6">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by code or description"
              className="w-full max-w-md rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
            />
            {filteredBands.map((band) => (
              <section key={band.band}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">
                  {band.bandLabel}
                </h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {band.standards.map((standard) => (
                    <div
                      key={standard.code}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"
                    >
                      <p className="text-xs font-semibold text-[var(--ll-text-faint)]">{standard.code}</p>
                      <p className="mt-1 text-sm">{standard.description}</p>
                      <div className="mt-3 border-t border-[var(--ll-border)] pt-3">
                        {standard.alignedContent.length > 0 ? (
                          <ul className="space-y-1">
                            {standard.alignedContent.map((content) => (
                              <li key={content.contentId}>
                                <Link
                                  href={`/teacher/lesson/${content.contentId}`}
                                  className="text-xs font-semibold text-[var(--ll-yellow)] hover:opacity-80"
                                >
                                  Grade {content.grade}: {content.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-[var(--ll-text-faint)]">
                            Not yet aligned to any lesson.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm text-[var(--ll-text-muted)]">
            No standards are defined yet for {SUBJECT_LABEL[activeGroup.subject] ?? activeGroup.subject}.
            This is an honest content gap, not a missing feature.
          </p>
        )
      ) : null}
    </div>
  );
}
