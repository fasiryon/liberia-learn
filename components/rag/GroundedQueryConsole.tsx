"use client";

import { useState } from "react";

type Source = {
  id: string;
  title: string;
  excerpt: string;
  sourceType: string;
  sourceLabel: string | null;
  similarity: number;
};

type QueryResult = {
  answer: string;
  sources: Source[];
  retrievalWeak: boolean;
};

type RetrievalMode = "classroom" | "policy" | "mixed";

export default function GroundedQueryConsole() {
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [mode, setMode] = useState<RetrievalMode>("classroom");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitQuery() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          subject: subject || undefined,
          grade: grade ? Number(grade) : undefined,
          mode,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Query failed");
      }

      setResult(payload);
    } catch (err: any) {
      setError(err?.message ?? "Query failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Grounded Retrieval
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Ask approved curriculum and MOE sources
        </h1>
        <p className="text-sm text-slate-600">
          Answers are limited to retrieved LiberiaLearn content and return source
          provenance.
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_120px_160px]">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a grounded question"
          className="min-h-32 rounded-2xl border border-slate-300 p-4 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
        <input
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          placeholder="Grade"
          inputMode="numeric"
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as RetrievalMode)}
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-500"
        >
          <option value="classroom">Classroom</option>
          <option value="policy">Policy</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submitQuery}
          disabled={loading || question.trim().length < 8}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "Searching..." : "Run grounded query"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      {result ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Answer</h2>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {result.retrievalWeak ? "Weak Retrieval" : "Grounded"}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {result.answer}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Sources</h2>
            <div className="mt-4 space-y-4">
              {result.sources.map((source) => (
                <article key={source.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {source.title}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {source.sourceType}
                    {source.sourceLabel ? ` | ${source.sourceLabel}` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {source.excerpt}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
