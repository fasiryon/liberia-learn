"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TeacherClass = {
  id: string;
  name: string;
  subject: string;
  gradeLevel: number | null;
};

type StandardOption = {
  code: string;
  description: string;
};

type LessonDraft = {
  title: string;
  content: string;
  assessmentQuestions: string[];
  estimatedMinutes: number;
  generationLineage?: Record<string, string>;
};

type MetadataResponse = {
  classes: TeacherClass[];
  standards: StandardOption[];
};

function mapLessonError(message: string | null | undefined) {
  if (message === "teacher_generation_disabled") {
    return "This feature is not available yet.";
  }

  return message ?? "Failed to load lesson form";
}

export default function TeacherCreateLessonPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    classId: "",
    subject: "",
    gradeLevel: 1,
    objective: "",
    standardCode: "",
  });
  const [draft, setDraft] = useState<LessonDraft | null>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.classId) ?? null,
    [classes, form.classId]
  );

  useEffect(() => {
    async function loadMetadata() {
      try {
        const response = await fetch("/api/teacher/generate-lesson", {
          cache: "no-store",
        });
        const data: MetadataResponse = await response.json();
        if (!response.ok) {
          const message = mapLessonError((data as any).error);
          if ((data as any).error === "teacher_generation_disabled") {
            setFeatureDisabled(true);
            setError(null);
            return;
          }
          throw new Error(message);
        }
        setClasses(data.classes ?? []);
        setStandards(data.standards ?? []);
      } catch (err: any) {
        setError(mapLessonError(err.message));
      } finally {
        setLoading(false);
      }
    }

    loadMetadata();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setForm((current) => ({
      ...current,
      subject: selectedClass.subject,
      gradeLevel: selectedClass.gradeLevel ?? current.gradeLevel,
    }));
  }, [selectedClass]);

  useEffect(() => {
    if (featureDisabled) {
      return;
    }
    if (!form.subject || !form.gradeLevel) {
      setStandards([]);
      return;
    }

    async function loadStandards() {
      setLoadingStandards(true);
      try {
        const params = new URLSearchParams({
          subject: form.subject,
          gradeLevel: String(form.gradeLevel),
        });
        const response = await fetch(`/api/teacher/generate-lesson?${params}`, {
          cache: "no-store",
        });
        const data: MetadataResponse = await response.json();
        if (!response.ok) {
          throw new Error(mapLessonError((data as any).error));
        }
        setStandards(data.standards ?? []);
      } catch (err: any) {
        setError(mapLessonError(err.message));
      } finally {
        setLoadingStandards(false);
      }
    }

    loadStandards();
  }, [featureDisabled, form.subject, form.gradeLevel]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          classId: form.classId,
          objective: form.objective.trim(),
          standardCode: form.standardCode || undefined,
          gradeLevel: Number(form.gradeLevel),
          subject: form.subject,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(mapLessonError(data.error));
      }
      setDraft({
        title: data.title,
        content: data.content,
        assessmentQuestions: data.assessmentQuestions ?? [],
        estimatedMinutes: data.estimatedMinutes,
        generationLineage: data.generationLineage,
      });
      setContentId(null);
    } catch (err: any) {
      setError(mapLessonError(err.message));
    } finally {
      setGenerating(false);
    }
  }

  async function persistLesson(action: "save_draft" | "publish") {
    if (!draft) return;

    setError(null);
    if (action === "save_draft") setSavingDraft(true);
    if (action === "publish") setPublishing(true);

    try {
      const response = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: form.classId,
          title: draft.title.trim(),
          content: draft.content.trim(),
          assessmentQuestions: draft.assessmentQuestions
            .map((question) => question.trim())
            .filter(Boolean),
          estimatedMinutes: Number(draft.estimatedMinutes),
          status: action === "publish" ? "published" : "draft",
          standardCode: form.standardCode || undefined,
          contentId: contentId ?? undefined,
          generationLineage: draft.generationLineage,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(mapLessonError(data.error));
      }

      setContentId(data.contentId);

      if (action === "publish") {
        router.push(
          `/teacher/schedule?published=1&className=${encodeURIComponent(
            data.className ?? selectedClass?.name ?? "class"
          )}`
        );
      }
    } catch (err: any) {
      setError(mapLessonError(err.message));
    } finally {
      setSavingDraft(false);
      setPublishing(false);
    }
  }

  function updateQuestion(index: number, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current.assessmentQuestions];
      next[index] = value;
      return { ...current, assessmentQuestions: next };
    });
  }

  function addQuestion() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        assessmentQuestions: [...current.assessmentQuestions, ""],
      };
    });
  }

  function removeQuestion(index: number) {
    setDraft((current) => {
      if (!current || current.assessmentQuestions.length <= 1) return current;
      return {
        ...current,
        assessmentQuestions: current.assessmentQuestions.filter(
          (_, itemIndex) => itemIndex !== index
        ),
      };
    });
  }

  function discardDraft() {
    setDraft(null);
    setContentId(null);
    setError(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-5xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8">
          <p className="text-sm text-[var(--ll-text-muted)]">Loading lesson generator...</p>
        </div>
      </div>
    );
  }

  if (featureDisabled) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href="/teacher/dashboard"
                className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
              >
                Back to teacher dashboard
              </Link>
              <h1 className="mt-3 text-3xl font-bold">Create with AI</h1>
            </div>
            <Link
              href="/teacher/curriculum"
              className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow)]/10"
            >
              Browse curriculum
            </Link>
          </div>

          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
            <h2 className="text-xl font-semibold">This feature is coming soon.</h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--ll-text-muted)]">
              In the meantime, browse existing lessons in your curriculum.
            </p>
            <Link
              href="/teacher/curriculum"
              className="mt-5 inline-flex rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
            >
              Open teacher curriculum
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/teacher/dashboard"
              className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
            >
              Back to teacher dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold">Create with AI</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ll-text-muted)]">
              Generate a lesson for one of your classes, review it, edit it,
              then save it as a draft or publish it to the class schedule.
            </p>
          </div>
          <Link
            href="/teacher/schedule"
            className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow)]/10"
          >
            Open schedule
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
                Step 1
              </p>
              <h2 className="text-xl font-semibold">Select objective</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Class</label>
              <select
                value={form.classId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    classId: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Subject</label>
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Grade level</label>
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
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">
                MOE standard (optional)
              </label>
              <select
                value={form.standardCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    standardCode: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
              >
                <option value="">
                  {loadingStandards ? "Loading standards..." : "Select standard"}
                </option>
                {standards.map((standard) => (
                  <option key={standard.code} value={standard.code}>
                    {standard.code} - {standard.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs text-[var(--ll-text-muted)]">
              Learning objective
            </label>
            <textarea
              value={form.objective}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  objective: event.target.value,
                }))
              }
              placeholder="e.g. Students will understand equivalent fractions"
              rows={4}
              className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
            />
          </div>

          <button
            type="button"
            disabled={
              generating ||
              !form.classId ||
              !form.subject ||
              !form.objective.trim() ||
              form.gradeLevel < 1 ||
              form.gradeLevel > 12
            }
            onClick={handleGenerate}
            className="mt-5 rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
          >
            {generating ? "Generating your lesson... this takes about 30 seconds" : "Generate Lesson"}
          </button>
        </section>

        {draft && (
          <>
            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
                  Step 2
                </p>
                <h2 className="text-xl font-semibold">Review generated lesson</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">Lesson title</label>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, title: event.target.value }
                          : current
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">Lesson content</label>
                  <textarea
                    value={draft.content}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, content: event.target.value }
                          : current
                      )
                    }
                    rows={16}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs text-[var(--ll-text-muted)]">
                      Assessment questions
                    </label>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
                    >
                      Add question
                    </button>
                  </div>
                  <div className="mt-2 space-y-3">
                    {draft.assessmentQuestions.map((question, index) => (
                      <div key={`${index}-${contentId ?? "new"}`} className="flex gap-2">
                        <textarea
                          value={question}
                          onChange={(event) =>
                            updateQuestion(index, event.target.value)
                          }
                          rows={2}
                          className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="rounded-xl border border-[var(--ll-border)] px-3 text-xs text-[var(--ll-text)]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">
                    Estimated duration (minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={draft.estimatedMinutes}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              estimatedMinutes: Number(event.target.value),
                            }
                          : current
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm md:w-48"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
                  Step 3
                </p>
                <h2 className="text-xl font-semibold">Publish or discard</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => persistLesson("save_draft")}
                  disabled={savingDraft || publishing}
                  className="rounded-xl border border-[var(--ll-border)] px-5 py-3 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-50"
                >
                  {savingDraft ? "Saving draft..." : "Save as Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => persistLesson("publish")}
                  disabled={savingDraft || publishing}
                  className="rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
                >
                  {publishing ? "Publishing..." : "Publish to Class"}
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  disabled={savingDraft || publishing}
                  className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-200 disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
