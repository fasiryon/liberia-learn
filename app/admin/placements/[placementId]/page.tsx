"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlacementResponseItem } from "@/lib/placementDetail";
import { placementBandStyles, placementReviewStatusStyles } from "@/lib/placement";

type PlacementDetail = {
  id: string;
  createdAt: string;
  band: "foundational" | "developing" | "proficient" | "advanced";
  levelLabel: string;
  estimatedGrade: number;
  rawScore: number;
  totalQuestions: number;
  responses: PlacementResponseItem[];
  aiAnalysis: {
    overallNarrative: string;
    strengths: string[];
    areasForGrowth: string[];
    teacherNote: string;
    confidenceExplanation: string;
    recommendedNextSteps: string[];
  } | null;
  teacherDecision: string | null;
  teacherGrade: number | null;
  teacherReason: string | null;
  reviewedAt: string | null;
  status: "pending" | "confirmed" | "overridden";
  student: {
    id: string;
    name: string;
    currentGrade: number | null;
    timeTakenSeconds: number;
  };
};

export default function AdminPlacementDetailPage({ params }: { params: { placementId: string } }) {
  const [data, setData] = useState<PlacementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch(`/api/admin/placements/${params.placementId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.placement) {
          throw new Error(payload?.error ?? "Failed to load placement");
        }
        if (active) {
          setData(payload.placement);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [params.placementId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-6xl space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-900/70" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {error ?? "Placement not found."}
          </div>
          <Link href="/admin/placements" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Back to placements
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Admin Placement Review</p>
            <h1 className="text-3xl font-bold">{data.student.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Placement taken on {new Date(data.createdAt).toLocaleDateString("en-LR")}
            </p>
          </div>
          <Link href="/admin/placements" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Back to placements
          </Link>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Student info</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current grade</p>
                <p className="mt-2 text-2xl font-bold">Grade {data.student.currentGrade ?? "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Time taken</p>
                <p className="mt-2 text-lg font-semibold">{Math.max(1, Math.round(data.student.timeTakenSeconds / 60))} min</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Teacher decision</p>
                <p className="mt-2 text-lg font-semibold">{data.teacherDecision ?? "Pending"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Placement outcome</h2>
            <p className="mt-4 text-sm text-slate-400">Recommended grade</p>
            <p className="mt-2 text-5xl font-black text-emerald-300">Grade {data.estimatedGrade}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementBandStyles[data.band]}`}>
                {data.levelLabel}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${placementReviewStatusStyles[data.status]}`}>
                {data.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {data.aiAnalysis?.confidenceExplanation ?? "No confidence explanation was saved for this placement."}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">Student Responses</h2>
          <div className="mt-4 space-y-4">
            {data.responses.map((response, index) => (
              <article key={response.questionId} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="mb-3 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <span>Question {index + 1}</span>
                  {response.difficulty ? <span>Difficulty {response.difficulty}/5</span> : null}
                  {response.concept ? <span>{response.concept}</span> : null}
                  {response.subject ? <span>{response.subject}</span> : null}
                </div>
                <h3 className="text-lg font-semibold text-slate-100">{response.question}</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Selected answer</p>
                    <p className="mt-2 text-sm text-slate-100">{response.selectedAnswerText ?? "No answer recorded"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Correct answer</p>
                    <p className="mt-2 text-sm text-slate-100">{response.correctAnswerText ?? "-"}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Correctness</p>
                    <p className={`mt-2 text-sm font-semibold ${response.isCorrect ? "text-green-300" : "text-red-300"}`}>
                      {response.isCorrect ? "Correct" : "Incorrect"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Concept</p>
                    <p className="mt-2 text-sm text-slate-100">{response.concept ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Why this question</p>
                    <p className="mt-2 text-sm text-slate-100">{response.whyThisQuestion ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Common mistake</p>
                    <p className="mt-2 text-sm text-slate-100">{response.commonMistake ?? "-"}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
