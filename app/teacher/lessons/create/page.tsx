"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LessonEditor } from "@/components/editor/LessonEditor";

const SUBJECTS = [
  "MATH", "SCIENCE", "LITERACY", "SOCIAL_STUDIES",
  "ENGLISH", "CS", "ENGINEERING_FOUNDATIONS", "CIVICS",
] as const;
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
type Tab = "scratch" | "fork";

export default function LessonCreatePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("scratch");
  const [form, setForm] = useState({ title: "", subject: "MATH" as string, grade: 1 });
  const [objectives, setObjectives] = useState<string[]>([""]);
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedContentId, setSavedContentId] = useState<string | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [forkQuery, setForkQuery] = useState("");
  const [forkResults, setForkResults] = useState<{ id: string; contentId: string; title: string; grade: number; subject: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((data) => setClasses(data.classes ?? []))
      .catch(() => null);
  }, []);

  const triggerAutoSave = useCallback((html: string, titleVal: string) => {
    if (!savedContentId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/teacher/lessons/${savedContentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: titleVal, bodyHtml: html, learningObjectives: objectives.filter(Boolean) }),
        });
        setAutoSavedAt(new Date().toLocaleTimeString());
      } catch { /* silent */ }
    }, 30000);
  }, [savedContentId, objectives]);

  function handleBodyChange(html: string) {
    setBodyHtml(html);
    triggerAutoSave(html, form.title);
  }

  async function searchForkable() {
    if (!forkQuery.trim()) return;
    const r = await fetch(`/api/teacher/lessons/forkable?q=${encodeURIComponent(forkQuery)}`);
    const data = await r.json();
    setForkResults(data.lessons ?? []);
  }

  async function selectFork(contentId: string) {
    const r = await fetch(`/api/teacher/lessons/${contentId}/fork`, { method: "POST" });
    const data = await r.json();
    if (!r.ok) { setError(data.error ?? "Fork failed"); return; }
    router.push(`/teacher/lessons/${data.id}/edit`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyHtml.trim() || bodyHtml === "<p></p>") { setError("Lesson body is required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classId || (classes[0]?.id ?? ""),
          title: form.title.trim(),
          content: bodyHtml,
          assessmentQuestions: ["Review question 1"],
          estimatedMinutes: 45,
          status: "draft",
          source: "TEACHER",
          subject: form.subject,
          grade: form.grade,
          learningObjectives: objectives.filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create lesson");
      setSavedContentId(data.contentId);
      router.push("/teacher/lessons");
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <Link href="/teacher/lessons" className="text-sm text-[var(--ll-yellow)]">Back to my lessons</Link>
          <h1 className="mt-2 text-2xl font-bold">Create Lesson</h1>
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--ll-border)] p-1 w-fit">
          {(["scratch", "fork"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${tab === t ? "bg-[var(--ll-border)] font-medium" : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"}`}>
              {t === "scratch" ? "From scratch" : "Fork AI lesson"}
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>}
        {autoSavedAt && <p className="text-xs text-[var(--ll-text-muted)]">Auto-saved {autoSavedAt}</p>}

        {tab === "fork" ? (
          <div className="space-y-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <p className="text-sm text-[var(--ll-text-muted)]">Search approved AI-generated lessons to use as a starting point.</p>
            <div className="flex gap-2">
              <input value={forkQuery} onChange={(e) => setForkQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchForkable()}
                placeholder="Search by title…"
                className="flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm" />
              <button type="button" onClick={searchForkable}
                className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">Search</button>
            </div>
            <div className="space-y-2">
              {forkResults.map((l) => (
                <div key={l.contentId} className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] px-4 py-2">
                  <div>
                    <p className="text-sm font-medium">{l.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">G{l.grade} · {l.subject.replace(/_/g, " ")}</p>
                  </div>
                  <button type="button" onClick={() => selectFork(l.contentId)}
                    className="rounded-lg bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-semibold text-[var(--ll-text-faint)]">Fork</button>
                </div>
              ))}
              {forkQuery && forkResults.length === 0 && (
                <p className="text-sm text-[var(--ll-text-muted)]">No lessons found. Try a different search term.</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-xs text-[var(--ll-text-muted)]">Title *</label>
                  <input required value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Introduction to Fractions"
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">Subject</label>
                  <select value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm">
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--ll-text-muted)]">Grade</label>
                  <select value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm">
                    {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                {classes.length > 0 && (
                  <div>
                    <label className="block text-xs text-[var(--ll-text-muted)]">Class</label>
                    <select value={classId} onChange={(e) => setClassId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm">
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Learning objectives (max 8)</label>
                <div className="mt-1 space-y-2">
                  {objectives.map((obj, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={obj}
                        onChange={(e) => setObjectives((prev) => prev.map((o, j) => j === i ? e.target.value : o))}
                        placeholder={`Objective ${i + 1}`}
                        className="flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm" />
                      {objectives.length > 1 && (
                        <button type="button" onClick={() => setObjectives((prev) => prev.filter((_, j) => j !== i))}
                          className="text-xs text-red-400 hover:text-red-300">Remove</button>
                      )}
                    </div>
                  ))}
                  {objectives.length < 8 && (
                    <button type="button" onClick={() => setObjectives((prev) => [...prev, ""])}
                      className="text-xs text-[var(--ll-yellow)]">+ Add objective</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--ll-text-muted)]">Lesson body *</label>
                <div className="mt-1"><LessonEditor onChange={handleBodyChange} /></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving || !form.title.trim()}
                className="rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50">
                {saving ? "Saving…" : "Create Lesson"}
              </button>
              <Link href="/teacher/lessons" className="rounded-xl border border-[var(--ll-border)] px-5 py-3 text-sm">Cancel</Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
