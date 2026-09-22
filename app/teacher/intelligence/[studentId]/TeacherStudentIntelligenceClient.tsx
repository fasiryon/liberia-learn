"use client";

import { useEffect, useState } from "react";
import { TeacherStudentIntelligenceScreen } from "@/components/intelligence/TeacherStudentIntelligenceScreen";
import type { TeacherConfusionItem } from "@/components/intelligence/ConfusionList";
import type { TeacherInterventionItem } from "@/components/intelligence/InterventionTable";

export default function TeacherStudentIntelligenceClient({
  studentId,
}: {
  studentId: string;
}) {
  const [data, setData] = useState<{
    student: { id: string; name: string | null; currentGrade: number | null; className: string | null };
    summary: { avgScore: number; masteryLevel: string; improvementTrend: string; confusionCount: number; pendingInterventions: number };
    signals: TeacherConfusionItem[];
    interventions: TeacherInterventionItem[];
    hasGuardianSupportRecommendation: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [governedSignals, setGovernedSignals] = useState<Array<{
    signalId: string; status: string; teacherExplanation: string[];
  }>>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/teacher/intelligence/${studentId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load student intelligence");
        }
        return payload;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
    };
  }, [studentId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/teacher/learning-authority/grade4-math/misconceptions?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && Array.isArray(payload?.suspectedSignals)) setGovernedSignals(payload.suspectedSignals); })
      .catch(() => {});
    return () => { active = false; };
  }, [studentId]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="h-48 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />;
  }

  return (
    <div className="space-y-5">
    {governedSignals.length > 0 && <section className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4" aria-label="Governed learning handoff">
      <h2 className="font-semibold">Learning evidence for teacher review</h2>
      <p className="mt-1 text-sm">These signals need your professional judgment before any misconception is confirmed.</p>
      <ul className="mt-3 space-y-2">{governedSignals.map((signal) => <li key={signal.signalId} className="rounded-lg border border-amber-400/20 p-3 text-sm">
        <strong>{signal.status.replaceAll("_", " ").toLowerCase()}</strong>: {signal.teacherExplanation.join(" ")}
      </li>)}</ul>
    </section>}
    <TeacherStudentIntelligenceScreen
      student={data.student}
      summary={data.summary}
      confusions={data.signals}
      interventions={data.interventions.filter((item) => item.status === "pending")}
      hasGuardianSupportRecommendation={data.hasGuardianSupportRecommendation}
    />
    </div>
  );
}
