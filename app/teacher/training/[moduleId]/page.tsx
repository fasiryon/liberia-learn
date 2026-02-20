"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Module = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  estimatedMinutes: number;
};

type Progress = {
  moduleId: string;
  status: "not_started" | "in_progress" | "complete";
  startedAt: string | null;
  completedAt: string | null;
};

export default function TeacherTrainingDetailPage() {
  const router = useRouter();
  const params = useParams<{ moduleId: string }>();
  const moduleId = params?.moduleId;
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<Module | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!moduleId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/training?moduleId=${moduleId}`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setModule(data.modules?.[0] ?? null);
      setProgress(
        data.progress?.find((p: Progress) => p.moduleId === moduleId) ?? null
      );
    } catch {
      setError("Failed to load module.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateProgress(status: "in_progress" | "complete") {
    if (!moduleId) return;
    setError(null);
    const res = await fetch("/api/teacher/training/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update progress.");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
        <p className="text-sm text-slate-400">Loading module...</p>
      </main>
    );
  }

  if (!module) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
        <p className="text-sm text-slate-400">Module not found.</p>
      </main>
    );
  }

  const status = progress?.status ?? "not_started";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/teacher/training" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to training
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              status === "complete"
                ? "bg-emerald-500/20 text-emerald-300"
                : status === "in_progress"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-slate-700/40 text-slate-300"
            }`}
          >
            {status.replace("_", " ")}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold">{module.title}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {module.estimatedMinutes} minutes
          </p>
          {module.description && (
            <p className="text-sm text-slate-300 mt-3">{module.description}</p>
          )}
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {module.content ?? "Module content coming soon."}
          </p>

          <div className="flex flex-wrap gap-2">
            {status === "not_started" && (
              <button
                onClick={() => updateProgress("in_progress")}
                className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30"
              >
                Start module
              </button>
            )}
            {status !== "complete" && (
              <button
                onClick={() => updateProgress("complete")}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Mark complete
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>
      </div>
    </main>
  );
}
