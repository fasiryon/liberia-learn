"use client";

import { useEffect, useState } from "react";
import { Card, StatCard } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";

type TeacherContentData = {
  totalPublished: number;
  bySchool: Array<{
    schoolId: string | null;
    schoolName: string;
    lessonCount: number;
  }>;
  topAssigned: Array<{
    contentId: string;
    title: string;
    subject: string | null;
    grade: number | null;
    teacherAuthorName: string | null;
    assignmentCount: number;
  }>;
};

export function TeacherContentPanel() {
  const [data, setData] = useState<TeacherContentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/moe/teacher-lessons", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="ll-section rounded-xl p-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
          Teacher-created curriculum
        </p>
        <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">Teacher Content</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
          Lessons authored by teachers, approved by school administrators, and assigned to classes.
        </p>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      ) : !data ? (
        <p className="mt-4 text-sm text-[var(--ll-text-muted)]">
          Teacher content data is unavailable right now.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StatCard
              label="Published Teacher Lessons"
              value={data.totalPublished}
              subtitle="Approved nationally"
              valueClassName="text-[var(--ll-accent)]"
            />
            <StatCard
              label="Schools Publishing"
              value={data.bySchool.length}
              subtitle="With at least one approved lesson"
              valueClassName="text-[var(--ll-text)]"
            />
            <StatCard
              label="Most-Assigned Lessons"
              value={data.topAssigned.length}
              subtitle="Tracked below"
              valueClassName="text-[var(--ll-text)]"
            />
          </div>

          {data.bySchool.length > 0 && (
            <Card className="mt-4 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                Per-school breakdown
              </p>
              <div className="mt-3 space-y-2">
                {data.bySchool
                  .slice()
                  .sort((a, b) => b.lessonCount - a.lessonCount)
                  .map((row) => (
                    <div
                      key={row.schoolId ?? row.schoolName}
                      className="flex items-center justify-between border-b border-[var(--ll-border)] pb-2 text-sm last:border-b-0 last:pb-0"
                    >
                      <span className="text-[var(--ll-text)]">{row.schoolName}</span>
                      <span className="font-semibold text-[var(--ll-accent)]">{row.lessonCount}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {data.topAssigned.length > 0 && (
            <Card className="mt-4 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                Top assigned teacher lessons
              </p>
              <div className="mt-3 space-y-2">
                {data.topAssigned.map((lesson) => (
                  <div
                    key={lesson.contentId}
                    className="flex items-center justify-between border-b border-[var(--ll-border)] pb-2 text-sm last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[var(--ll-text)]">{lesson.title}</p>
                      <p className="text-xs text-[var(--ll-text-muted)]">
                        {[
                          lesson.subject?.replace(/_/g, " "),
                          lesson.grade != null ? `Grade ${lesson.grade}` : null,
                          lesson.teacherAuthorName ? `by ${lesson.teacherAuthorName}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 font-semibold text-[var(--ll-accent)]">
                      {lesson.assignmentCount} {lesson.assignmentCount === 1 ? "class" : "classes"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
