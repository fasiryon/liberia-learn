"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SUBJECTS = [
  "MATH",
  "SCIENCE",
  "LITERACY",
  "CIVICS",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "ARTS",
  "PE",
  "CAREER",
];

export default function CurriculumGeneratorPage() {
  const router = useRouter();

  const [grade, setGrade] = useState(5);
  const [subject, setSubject] = useState("MATH");
  const [topic, setTopic] = useState("");
  const [moeCodes, setMoeCodes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    contentId: string;
    title: string;
    objectivesCount: number;
  } | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const codes = moeCodes
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/curriculum/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          subject,
          topic: topic.trim(),
          ...(codes.length > 0 ? { moeAlignmentCodes: codes } : {}),
        }),
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setResult({
        contentId: data.contentId,
        title: data.payloadPreview.title,
        objectivesCount: data.payloadPreview.objectivesCount,
      });
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/teacher"
          className="inline-block text-sm text-emerald-300 hover:text-emerald-200"
        >
          &larr; Back to Teacher Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-50">
          Curriculum Generator
        </h1>
        <p className="text-sm text-slate-400">
          Generate AI-powered lessons aligned to Liberian MOE standards.
        </p>

        <form
          onSubmit={handleGenerate}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-5"
        >
          {/* Grade */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Grade
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='e.g. "Fractions and Mixed Numbers"'
              required
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* MOE Codes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              MOE Alignment Codes (optional, comma-separated)
            </label>
            <input
              type="text"
              value={moeCodes}
              onChange={(e) => setMoeCodes(e.target.value)}
              placeholder="e.g. LR-MATH-G4_6-02, LR-MATH-G4_6-03"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate Lesson"}
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
            <h2 className="text-lg font-semibold text-emerald-300">
              Lesson Generated
            </h2>
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
      </div>
    </main>
  );
}
