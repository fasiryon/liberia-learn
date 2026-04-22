"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SUBJECTS = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
] as const;

const ASSEMBLY_STAGES = [
  "Intro",
  "Core 1",
  "Core 2",
  "Core 3",
  "Practice",
  "Review",
  "Assessment",
];

type UnitLesson = {
  id: string;
  contentId: string;
  contentType: string;
  lessonType: string | null;
  orderInUnit: number | null;
  status: string;
  title: string;
};

type UnitRow = {
  id: string;
  unitId: string;
  name: string;
  description: string | null;
  subject: string;
  grade: number;
  lessonCount: number;
  lessons: UnitLesson[];
};

function mapUnitsError(message: string | null | undefined) {
  if (message === "unit_assembly_disabled") {
    return "This feature is not available yet.";
  }

  return message ?? "Failed to load units";
}

export default function AdminCurriculumUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState(0);
  const [form, setForm] = useState({
    subject: "MATH",
    gradeLevel: 5,
    unitTitle: "",
    unitDescription: "",
  });

  useEffect(() => {
    if (!submitting) {
      setProgressStage(0);
      return;
    }

    const interval = window.setInterval(() => {
      setProgressStage((current) =>
        current < ASSEMBLY_STAGES.length - 1 ? current + 1 : current
      );
    }, 15000);

    return () => window.clearInterval(interval);
  }, [submitting]);

  async function loadUnits() {
    setLoadingUnits(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum/units", {
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(mapUnitsError(data.error));
      }

      setUnits(data.units ?? []);
    } catch (loadError: any) {
      setError(mapUnitsError(loadError.message));
    } finally {
      setLoadingUnits(false);
    }
  }

  useEffect(() => {
    loadUnits();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          gradeLevel: Number(form.gradeLevel),
          unitTitle: form.unitTitle.trim(),
          unitDescription: form.unitDescription.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(mapUnitsError(data.error));
      }

      setForm((current) => ({ ...current, unitTitle: "", unitDescription: "" }));
      await loadUnits();
      setExpandedUnitId(data.unitId ?? null);
    } catch (submitError: any) {
      setError(mapUnitsError(submitError.message));
    } finally {
      setSubmitting(false);
    }
  }

  const groupedCounts = useMemo(() => {
    return units.reduce<Record<string, number>>((accumulator, unit) => {
      const key = `${unit.subject}|${unit.grade}`;
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [units]);

  const textbookGroups = useMemo(() => {
    return Object.entries(groupedCounts)
      .filter(([, count]) => count >= 2)
      .map(([key, count]) => {
        const [subject, grade] = key.split("|");
        return {
          key,
          subject,
          grade: Number(grade),
          count,
        };
      });
  }, [groupedCounts]);

  async function handleDownloadTextbook(subject: string, gradeLevel: number) {
    const key = `${subject}|${gradeLevel}`;
    setDownloadingKey(key);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/curriculum/textbook?subject=${encodeURIComponent(subject)}&gradeLevel=${gradeLevel}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to compile textbook");
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${subject.toLowerCase().replace(/_/g, "-")}-grade${gradeLevel}-textbook.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (downloadError: any) {
      setError(downloadError.message ?? "Failed to compile textbook");
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#14b8a622,_transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin/curriculum" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Curriculum / AI Factory
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Curriculum Units</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Assemble coherent units from existing approved lessons and generate only the missing artifacts.
            </p>
          </div>
          <button
            type="button"
            onClick={loadUnits}
            className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)]"
          >
            Refresh
          </button>
        </div>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Create Unit</h2>
              <p className="text-xs text-[var(--ll-text-faint)]">
                Existing real lessons are reused first. Missing unit stages are generated with the AI factory.
              </p>
            </div>
            <span className="rounded-full bg-[var(--ll-surface)] px-3 py-1 text-xs text-[var(--ll-text)]">
              {units.length} units assembled
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1">
                <span className="block text-xs font-medium text-[var(--ll-text-muted)]">Subject</span>
                <select
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                >
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="block text-xs font-medium text-[var(--ll-text-muted)]">Grade level</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={form.gradeLevel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      gradeLevel: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="block text-xs font-medium text-[var(--ll-text-muted)]">Unit title</span>
                <input
                  type="text"
                  value={form.unitTitle}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, unitTitle: event.target.value }))
                  }
                  placeholder="e.g. Number Sense"
                  required
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="block text-xs font-medium text-[var(--ll-text-muted)]">Unit description</span>
              <textarea
                value={form.unitDescription}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unitDescription: event.target.value }))
                }
                rows={4}
                placeholder="Optional summary of the concepts this unit should cover."
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || !form.unitTitle.trim()}
              className="rounded-xl bg-[var(--ll-yellow)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Assembling Unit..." : "Assemble Unit"}
            </button>
          </form>

          {submitting ? (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 p-4">
              <p className="text-sm font-semibold text-[var(--ll-yellow)]">
                Assembling unit... generating 7 lessons (this takes about 2 minutes)
              </p>
              <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
                {ASSEMBLY_STAGES.map((stage, index) => {
                  const isActive = index === progressStage;
                  const isComplete = index < progressStage;
                  return (
                    <div
                      key={stage}
                      className={`rounded-xl border px-3 py-2 text-center text-xs ${
                        isComplete
                          ? "border-emerald-400 bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                          : isActive
                          ? "border-cyan-400 bg-[var(--ll-silver-soft)] text-[var(--ll-silver)]"
                          : "border-[var(--ll-border)] bg-[var(--ll-bg)]/60 text-[var(--ll-text-muted)]"
                      }`}
                    >
                      {stage}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Textbooks</h2>
              <p className="text-xs text-[var(--ll-text-faint)]">
                Download textbook PDFs when a subject and grade has at least two assembled units.
              </p>
            </div>
          </div>

          {textbookGroups.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">Assemble at least two units in a subject and grade to unlock textbook compilation.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {textbookGroups.map((group) => {
                const busy = downloadingKey === group.key;
                return (
                  <div
                    key={group.key}
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--ll-text)]">
                      {group.subject.replace(/_/g, " ")} Grade {group.grade}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{group.count} units available</p>
                    <button
                      type="button"
                      onClick={() => handleDownloadTextbook(group.subject, group.grade)}
                      disabled={busy}
                      className="mt-3 rounded-xl bg-[var(--ll-silver-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-silver-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? "Compiling textbook..." : "Download Textbook PDF"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Unit List</h2>
              <p className="text-xs text-[var(--ll-text-faint)]">
                Subject and grade combinations currently assembled in this school.
              </p>
            </div>
            <div className="text-right text-xs text-[var(--ll-text-muted)]">
              {Object.entries(groupedCounts).map(([key, count]) => (
                <div key={key}>
                  {key.replace("|", " Grade ")}: {count}
                </div>
              ))}
            </div>
          </div>

          {loadingUnits ? (
            <p className="text-sm text-[var(--ll-text-muted)]">Loading units...</p>
          ) : units.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">No units assembled yet.</p>
          ) : (
            <div className="space-y-3">
              {units.map((unit) => {
                const expanded = expandedUnitId === unit.unitId;
                return (
                  <div key={unit.unitId} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ll-text)]">{unit.name}</p>
                        <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                          {unit.subject.replace(/_/g, " ")} | Grade {unit.grade} | {unit.lessonCount} lessons
                        </p>
                        {unit.description ? (
                          <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text)]">{unit.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedUnitId((current) =>
                              current === unit.unitId ? null : unit.unitId
                            )
                          }
                          className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs font-semibold text-[var(--ll-text)] hover:border-[var(--ll-border)]"
                        >
                          {expanded ? "Hide Lessons" : "View Lessons"}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 space-y-2">
                        {unit.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-[var(--ll-text)]">{lesson.title}</p>
                              <p className="text-xs text-[var(--ll-text-faint)]">{lesson.contentId}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-[var(--ll-surface)] px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--ll-text)]">
                                {lesson.lessonType ?? "lesson"}
                              </span>
                              <span className="rounded-full bg-[var(--ll-yellow)]/20 px-3 py-1 text-[11px] text-[var(--ll-yellow)]">
                                #{lesson.orderInUnit ?? "-"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
