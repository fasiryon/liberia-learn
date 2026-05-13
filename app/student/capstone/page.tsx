"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  description: string | null;
  skills: string[] | null;
  fileUrls: string[] | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  teacherFeedback: string | null;
  submittedAt: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]",
  SUBMITTED: "bg-amber-500/20 text-amber-300",
  APPROVED: "bg-emerald-500/20 text-emerald-300",
  REJECTED: "bg-red-500/20 text-red-300",
};

export default function StudentCapstonePage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/capstone", { cache: "no-store" });
      if (res.status === 403) { setForbidden(true); return; }
      if (res.ok) {
        const data: Project[] = await res.json();
        const latest = data[0] ?? null;
        setProject(latest);
        if (latest) {
          setTitle(latest.title);
          setDescription(latest.description ?? "");
          setSkills((latest.skills ?? []).join(", "));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!project) {
        const res = await fetch("/api/student/capstone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, skills: skills.split(",").map((s) => s.trim()).filter(Boolean) }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
        await load();
        setSuccess("Project created");
      } else {
        const res = await fetch(`/api/student/capstone/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, skills: skills.split(",").map((s) => s.trim()).filter(Boolean) }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
        await load();
        setSuccess("Draft saved");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!project) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/capstone/${project.id}/submit`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      await load();
      setSuccess("Submitted for review!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevise() {
    if (!project) return;
    const res = await fetch(`/api/student/capstone/${project.id}/revise`, { method: "POST" });
    if (res.ok) await load();
  }

  if (loading) {
    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />)}
        </div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <Link href="/student/today" className="text-xs text-[var(--ll-yellow)]">&larr; Today</Link>
          <div className="mt-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">Capstone projects are available for Grade 10 and above.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-3xl space-y-6">
        <Link href="/student/today" className="text-xs text-[var(--ll-yellow)]">&larr; Today</Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">My Capstone Project</h1>

        {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}
        {success && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">{success}</p>}

        {!project && (
          <div className="ll-section p-5 space-y-4">
            <h2 className="font-semibold text-[var(--ll-text)]">Start Your Capstone</h2>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Your capstone project is a final demonstration of what you&apos;ve learned. Choose a topic, describe your work, and submit for teacher review.
            </p>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title"
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project..."
                rows={4}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
              />
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Skills (comma-separated: Math, Science...)"
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
              >
                {saving ? "Creating..." : "Save Draft"}
              </button>
            </div>
          </div>
        )}

        {project?.status === "DRAFT" && (
          <div className="ll-section p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--ll-text)]">Draft</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE.DRAFT}`}>DRAFT</span>
            </div>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title"
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project..."
                rows={4}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
              />
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Skills (comma-separated)"
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text)] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim()}
                  className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
            </div>
          </div>
        )}

        {project?.status === "SUBMITTED" && (
          <div className="ll-section p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--ll-text)]">{project.title}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE.SUBMITTED}`}>AWAITING REVIEW</span>
            </div>
            {project.description && <p className="text-sm text-[var(--ll-text-muted)]">{project.description}</p>}
            {project.submittedAt && (
              <p className="text-xs text-[var(--ll-text-faint)]">Submitted {new Date(project.submittedAt).toLocaleDateString()}</p>
            )}
          </div>
        )}

        {project?.status === "APPROVED" && (
          <div className="ll-section p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--ll-text)]">{project.title}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE.APPROVED}`}>APPROVED</span>
            </div>
            {project.description && <p className="text-sm text-[var(--ll-text-muted)]">{project.description}</p>}
            {project.teacherFeedback && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="text-xs font-semibold text-emerald-400">Teacher feedback</p>
                <p className="mt-1 text-sm text-[var(--ll-text)]">{project.teacherFeedback}</p>
              </div>
            )}
            <p className="text-xs text-[var(--ll-text-faint)]">Added to your portfolio.</p>
          </div>
        )}

        {project?.status === "REJECTED" && (
          <div className="ll-section p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--ll-text)]">{project.title}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE.REJECTED}`}>REVISION REQUIRED</span>
            </div>
            {project.teacherFeedback && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                <p className="text-xs font-semibold text-red-400">Teacher feedback</p>
                <p className="mt-1 text-sm text-[var(--ll-text)]">{project.teacherFeedback}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleRevise}
              className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)]"
            >
              Revise and Resubmit
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
