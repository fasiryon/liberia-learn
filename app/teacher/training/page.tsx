"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Module = {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
};

type Progress = {
  moduleId: string;
  status: "not_started" | "in_progress" | "complete";
  startedAt: string | null;
  completedAt: string | null;
};

export default function TeacherTrainingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/training", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setModules(data.modules ?? []);
      setProgress(data.progress ?? []);
    } catch {
      setError("Failed to load training modules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progressMap = useMemo(() => {
    const map = new Map<string, Progress>();
    progress.forEach((p) => map.set(p.moduleId, p));
    return map;
  }, [progress]);

  async function updateProgress(moduleId: string, status: "in_progress" | "complete") {
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Teacher Training</h1>
            <p className="text-sm text-slate-400">
              Complete your core training modules to get started.
            </p>
          </div>
          <Link
            href="/teacher"
            className="text-sm text-emerald-300 hover:text-emerald-200"
          >
            &larr; Back to dashboard
          </Link>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">Loading modules...</p>
        ) : modules.length === 0 ? (
          <p className="text-sm text-slate-400">No training modules available.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => {
              const status = progressMap.get(module.id)?.status ?? "not_started";
              return (
                <div
                  key={module.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">{module.title}</h2>
                      <p className="text-xs text-slate-400">
                        {module.estimatedMinutes} mins
                      </p>
                    </div>
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
                  <p className="text-sm text-slate-400">
                    {module.description ?? "Training module details coming soon."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/teacher/training/${module.id}`}
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      Open module
                    </Link>
                    {status === "not_started" && (
                      <button
                        onClick={() => updateProgress(module.id, "in_progress")}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30"
                      >
                        Start
                      </button>
                    )}
                    {status !== "complete" && (
                      <button
                        onClick={() => updateProgress(module.id, "complete")}
                        className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        Mark complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
