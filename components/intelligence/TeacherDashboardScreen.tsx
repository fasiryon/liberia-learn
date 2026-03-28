"use client";

import { useMemo, useState } from "react";
import { IntelligenceStatCard } from "@/components/intelligence/StatCard";
import {
  ConfusionList,
  type TeacherConfusionItem,
} from "@/components/intelligence/ConfusionList";
import {
  InterventionTable,
  type TeacherInterventionItem,
} from "@/components/intelligence/InterventionTable";
import { Card } from "@/components/ui/Card";

export type TeacherDashboardSummary = {
  teacherId: string;
  schoolId: string;
  studentCount: number;
  avgScore: number;
  studentsStruggling: number;
  activeInterventions: number;
  topConfusionTags: string[];
};

function confusionPriority(item: TeacherConfusionItem): number {
  if (item.severity === "high") return 3;
  if (item.severity === "medium") return 2;
  return 1;
}

function interventionPriority(item: TeacherInterventionItem): number {
  if (item.recommendationType === "teacher_attention") return 3;
  if (item.recommendationType === "extra_practice") return 2;
  return 1;
}

export function TeacherDashboardScreen({
  summary,
  confusions,
  interventions,
  error,
  busy,
  onAction,
}: {
  summary: TeacherDashboardSummary | null;
  confusions: TeacherConfusionItem[];
  interventions: TeacherInterventionItem[];
  error?: string | null;
  busy?: boolean;
  onAction?: (id: string, status: "actioned" | "dismissed") => Promise<void>;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const studentOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const confusion of confusions) {
      if (confusion.studentName) items.set(confusion.studentId, confusion.studentName);
    }
    for (const intervention of interventions) {
      if (intervention.studentName) {
        items.set(intervention.studentId, intervention.studentName);
      }
    }
    return Array.from(items.entries()).map(([id, name]) => ({ id, name }));
  }, [confusions, interventions]);

  const sortedConfusions = useMemo(
    () =>
      [...confusions].sort((a, b) => {
        const priorityGap = confusionPriority(b) - confusionPriority(a);
        if (priorityGap !== 0) return priorityGap;
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      }),
    [confusions]
  );
  const sortedInterventions = useMemo(
    () =>
      [...interventions].sort((a, b) => {
        const priorityGap = interventionPriority(b) - interventionPriority(a);
        if (priorityGap !== 0) return priorityGap;
        return b.confidenceScore - a.confidenceScore;
      }),
    [interventions]
  );

  const filteredConfusions = selectedStudentId
    ? sortedConfusions.filter((item) => item.studentId === selectedStudentId)
    : sortedConfusions;

  const highSeverityCount = sortedConfusions.filter(
    (item) => item.severity === "high"
  ).length;
  const urgentInterventionCount = sortedInterventions.filter(
    (item) => interventionPriority(item) >= 2
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Teacher Intelligence</h1>
        <p className="mt-1 text-sm text-slate-400">
          Review class performance, recent confusion patterns, and advisory interventions.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <IntelligenceStatCard
          label="Class average score"
          value={summary ? `${Math.round(summary.avgScore * 100)}%` : "-"}
        />
        <IntelligenceStatCard
          label="Students struggling"
          value={summary?.studentsStruggling ?? 0}
        />
        <IntelligenceStatCard
          label="Active interventions"
          value={summary?.activeInterventions ?? 0}
        />
        <IntelligenceStatCard
          label="Top confusion tags"
          value={
            summary?.topConfusionTags?.length
              ? summary.topConfusionTags.join(", ")
              : "None"
          }
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Needs Attention</h2>
            <p className="mt-1 text-sm text-slate-400">
              Prioritized items for the next classroom follow-up.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                High-severity signals
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {highSeverityCount}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Urgent interventions
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {urgentInterventionCount}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Recent confusion signals
            </h2>
            <p className="text-sm text-slate-400">
              Start with high-severity signals first, then recent patterns.
            </p>
          </div>
          {studentOptions.length > 0 ? (
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100"
            >
              <option value="">All students</option>
              {studentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <ConfusionList
          items={filteredConfusions}
          emptyMessage="No confusion signals need attention right now."
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Intervention queue</h2>
          <p className="text-sm text-slate-400">
            Recommendations stay advisory until a teacher reviews them.
          </p>
        </div>
        <InterventionTable
          items={sortedInterventions}
          emptyMessage="No pending interventions at the moment."
          onAction={onAction}
          disabled={busy}
        />
      </section>
    </div>
  );
}
