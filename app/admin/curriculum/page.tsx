"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SUBJECTS = [
  "MATH", "SCIENCE", "LITERACY", "CIVICS",
  "COMPUTER_SCIENCE", "ENGINEERING", "ARTS", "PE", "CAREER",
];

type CurriculumItem = {
  id: string;
  contentId: string;
  grade: number;
  subject: string;
  contentType: string;
  status: string;
  payload: any;
  createdAt: string;
};

export default function AdminCurriculumPage() {
  const router = useRouter();

  const [grade, setGrade] = useState(4);
  const [subject, setSubject] = useState("MATH");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    contentId: string;
    title: string;
    objectivesCount: number;
  } | null>(null);
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  async function loadItems() {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/curriculum?limit=10", { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setItems(data.items ?? data.content ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => { loadItems(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/curriculum/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, subject, topic: topic.trim() }),
      });
      if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult({
        contentId: data.contentId,
        title: data.payloadPreview.title,
        objectivesCount: data.payloadPreview.objectivesCount,
      });
      // Refresh the list
      loadItems();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
              &larr; Back to Admin Console
            </Link>
            <h1 className="text-2xl font-bold mt-2">Curriculum &amp; AI Factory</h1>
            <p className="text-sm text-slate-400 mt-1">
              Generate AI-powered lessons aligned to Liberian MOE standards.
            </p>
          </div>
        </div>

        {/* Generate form */}
        <form
          onSubmit={handleGenerate}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold">Generate Curriculum for Grade / Subject</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder='e.g. "Fractions and Mixed Numbers"'
                required
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Running AI Factory..." : "Run AI Factory - Generate Lesson"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
            <h2 className="text-lg font-semibold text-emerald-300">Lesson Generated</h2>
            <dl className="space-y-2 text-sm text-slate-300">
              <div>
                <dt className="text-xs text-slate-500">Title</dt>
                <dd className="font-medium">{result.title}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Content ID</dt>
                <dd className="font-mono text-xs">{result.contentId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Objectives</dt>
                <dd>{result.objectivesCount} learning objectives</dd>
              </div>
            </dl>
            <Link
              href={`/student/lesson/${result.contentId}`}
              className="inline-block rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Preview Lesson
            </Link>
          </div>
        )}

        {/* Latest curriculum items */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Latest Curriculum Items</h2>
            <button
              onClick={loadItems}
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              Refresh
            </button>
          </div>

          {loadingItems ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">No curriculum yet -- generate one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {item.payload?.title ?? item.contentId}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Grade {item.grade} - {item.subject} - {item.contentType} - {item.status}
                    </p>
                  </div>
                  <Link
                    href={`/student/lesson/${item.contentId}`}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-50 hover:border-slate-500"
                  >
                    Preview
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
