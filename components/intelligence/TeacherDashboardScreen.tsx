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
import HelpTooltip from "@/components/ui/HelpTooltip";
import { buildAdvisoryActions } from "@/lib/intelligence/advisoryActions";

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
  const suggestedActions = buildAdvisoryActions({
    confusions: filteredConfusions,
    interventions: sortedInterventions,
  });

  const highSeverityCount = sortedConfusions.filter(
    (item) => item.severity === "high"
  ).length;
  const mediumSeverityCount = sortedConfusions.filter(
    (item) => item.severity === "medium"
  ).length;
  const urgentInterventionCount = sortedInterventions.filter(
    (item) => interventionPriority(item) >= 2
  ).length;
  const topAttentionItems = filteredConfusions.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Teacher Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Review class performance, students who may need help, and suggested support.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Confusion Alerts</h2>
              <HelpTooltip text="Students flagged by AI as struggling with the current lesson" />
            </div>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Prioritized items for the next classroom follow-up.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                High priority
              </p>
              <p className="mt-2 text-2xl font-semibold text-red-300">
                {highSeverityCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                Support queue
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                {urgentInterventionCount}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
            High {highSeverityCount}
          </span>
          <span className="rounded-full border border-amber-500/20 bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]">
            Medium {mediumSeverityCount}
          </span>
          <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-3 py-1 text-xs font-semibold text-[var(--ll-text)]">
            Action queue {urgentInterventionCount}
          </span>
        </div>
        {topAttentionItems.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {topAttentionItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                  {item.severity} severity
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                  {item.conceptLabel}
                </p>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  {item.studentName ?? "Student"} needs follow-up on this concept.
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">Suggested Support</h2>
            <p className="mt-1 text-sm text-[var(--ll-yellow)]">
              AI suggestions. Teacher review required.
            </p>
          </div>
          {suggestedActions.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-muted)]">
              No support suggestions are being surfaced from the current class activity.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {suggestedActions.map((action) => (
                <div key={`${action.type}-${action.reason}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{action.type.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-sm text-[var(--ll-text)]">{action.reason}</p>
                  <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
                    Confidence {Math.round(action.confidence * 100)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">
              Students who may need help
            </h2>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Start with higher priority items first, then recent patterns.
            </p>
          </div>
          {studentOptions.length > 0 ? (
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="min-h-11 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2 text-sm text-[var(--ll-text)]"
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">Intervention Queue</h2>
            <HelpTooltip text="Students who may need additional support based on recent activity" />
          </div>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Suggestions stay advisory until a teacher reviews them.
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
