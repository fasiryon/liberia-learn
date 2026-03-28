import { Card } from "@/components/ui/Card";
import {
  ConfusionList,
  type TeacherConfusionItem,
} from "@/components/intelligence/ConfusionList";
import {
  InterventionTable,
  type TeacherInterventionItem,
} from "@/components/intelligence/InterventionTable";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">
          {student.name ?? "Student"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {student.className ?? "Class not assigned"}
          {student.currentGrade ? ` | Grade ${student.currentGrade}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-slate-500">Average score</p>
          <p className="mt-2 text-3xl font-semibold text-slate-100">
            {Math.round(summary.avgScore * 100)}%
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">Mastery level</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">
            {masteryLabel(summary.masteryLevel)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">Trend</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">
            {trendLabel(summary.improvementTrend)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">Guardian support cue</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">
            {hasGuardianSupportRecommendation
              ? "Guardian encouragement may help reinforce progress."
              : "No guardian follow-up suggested right now."}
          </p>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Concept focus</h2>
          <p className="text-sm text-slate-400">
            Grouped from recent signals to support quick instructional follow-up.
          </p>
        </div>
        {groupedConcepts.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-slate-400">
              No confusion history recorded for this student yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groupedConcepts.map(([concept, entries]) => (
              <Card key={concept} className="p-5">
                <p className="text-sm font-semibold text-slate-100">{concept}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {entries.length} signal{entries.length === 1 ? "" : "s"} recorded
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Confusion history</h2>
        <ConfusionList
          items={confusions}
          emptyMessage="No confusion history recorded for this student yet."
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">
          Pending interventions
        </h2>
        <InterventionTable
          items={interventions}
          emptyMessage="No interventions are pending for this student."
        />
      </section>
    </div>
  );
}
