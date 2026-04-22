import { Card } from "@/components/ui/Card";
import {
  ConfusionList,
  type TeacherConfusionItem,
} from "@/components/intelligence/ConfusionList";
import {
  InterventionTable,
  type TeacherInterventionItem,
} from "@/components/intelligence/InterventionTable";
import { buildAdvisoryActions } from "@/lib/intelligence/advisoryActions";
import HelpTooltip from "@/components/ui/HelpTooltip";

function trendLabel(trend: string) {
  if (trend === "improving") return "Improving";
  if (trend === "declining") return "Needs support";
  return "Stable";
}

function masteryLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function TeacherStudentIntelligenceScreen({
  student,
  summary,
  confusions,
  interventions,
  hasGuardianSupportRecommendation,
}: {
  student: {
    id: string;
    name: string | null;
    currentGrade: number | null;
    className: string | null;
  };
  summary: {
    avgScore: number;
    masteryLevel: string;
    improvementTrend: string;
    confusionCount: number;
    pendingInterventions: number;
  };
  confusions: TeacherConfusionItem[];
  interventions: TeacherInterventionItem[];
  hasGuardianSupportRecommendation: boolean;
}) {
  const groupedConcepts = Object.entries(
    confusions.reduce((acc: Record<string, TeacherConfusionItem[]>, signal) => {
      (acc[signal.conceptLabel] ??= []).push(signal);
      return acc;
    }, {})
  ).sort((a, b) => b[1].length - a[1].length);
  const suggestedActions = buildAdvisoryActions({
    confusions,
    interventions,
  });
  const highSeverityCount = confusions.filter((item) => item.severity === "high").length;
  const mediumSeverityCount = confusions.filter(
    (item) => item.severity === "medium"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">
          {student.name ?? "Student"}
        </h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          {student.className ?? "Class not assigned"}
          {student.currentGrade ? ` • Grade ${student.currentGrade}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-[var(--ll-text-faint)]">Average score</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">
            {Math.round(summary.avgScore * 100)}%
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <p className="text-xs text-[var(--ll-text-faint)]">Mastery Score</p>
            <HelpTooltip text="How well a student has demonstrated understanding across lessons and exams" />
          </div>
          <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
            {masteryLabel(summary.masteryLevel)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-[var(--ll-text-faint)]">Trend</p>
          <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
            {trendLabel(summary.improvementTrend)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-[var(--ll-text-faint)]">Home support cue</p>
          <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
            {hasGuardianSupportRecommendation
              ? "Guardian encouragement may help reinforce progress."
              : "No guardian follow-up suggested right now."}
          </p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">Needs attention now</h2>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              A compact view of the strongest current student-support signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-red-200">
              High {highSeverityCount}
            </span>
            <span className="rounded-full border border-amber-500/20 bg-[var(--ll-yellow-soft)] px-3 py-1 text-[var(--ll-yellow)]">
              Medium {mediumSeverityCount}
            </span>
            <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-3 py-1 text-[var(--ll-text)]">
              Pending {summary.pendingInterventions}
            </span>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Suggested Support</h2>
          <p className="text-sm text-[var(--ll-yellow)]">
            AI suggestions. Teacher review required.
          </p>
        </div>
        {suggestedActions.length === 0 ? (
          <Card className="ll-empty p-5">
            <p className="text-sm text-[var(--ll-text-muted)]">
              No support suggestions are currently surfaced for this student.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {suggestedActions.map((action) => (
              <Card key={`${action.type}-${action.reason}`} className="p-5">
                <p className="text-xs text-[var(--ll-text-faint)]">{action.type.replace(/_/g, " ")}</p>
                <p className="mt-2 text-sm text-[var(--ll-text)]">{action.reason}</p>
                <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
                  Confidence {Math.round(action.confidence * 100)}%
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Priority concepts</h2>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Grouped from recent signals to support quick instructional follow-up.
          </p>
        </div>
        {groupedConcepts.length === 0 ? (
          <Card className="ll-empty p-5">
            <p className="text-sm text-[var(--ll-text-muted)]">
              No confusion history recorded for this student yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groupedConcepts.map(([concept, entries]) => (
              <Card key={concept} className="p-5">
                <p className="text-sm font-semibold text-[var(--ll-text)]">{concept}</p>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  {entries.length} signal{entries.length === 1 ? "" : "s"} recorded
                </p>
                <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
                  Highest severity {entries.some((item) => item.severity === "high") ? "high" : entries.some((item) => item.severity === "medium") ? "medium" : "low"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--ll-text)]">Recent learning patterns</h2>
        <ConfusionList
          items={confusions}
          emptyMessage="No confusion history recorded for this student yet."
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">
            Intervention Queue
          </h2>
          <HelpTooltip text="Students who may need additional support based on recent activity" />
        </div>
        <InterventionTable
          items={interventions}
          emptyMessage="No interventions are pending for this student."
        />
      </section>
    </div>
  );
}
