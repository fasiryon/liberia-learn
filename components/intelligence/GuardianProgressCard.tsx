import { Card } from "@/components/ui/Card";

type GuardianProgressData = {
  avgScore: number;
  masteryLevel: string;
  improvementTrend: string;
  hasSuggestedSupport: boolean;
  supportSuggestions: string[];
  doingWell?: string;
  needsHelp?: string;
};

function masteryLabel(level: string) {
  if (level === "struggling") return "Needs more support";
  if (level === "developing") return "Building confidence";
  if (level === "proficient") return "On track";
  return "Doing very well";
}

function trendLabel(trend: string) {
  if (trend === "improving") return "Improving";
  if (trend === "declining") return "Needs a closer look";
  return "Steady";
}

export function GuardianProgressCard({
  data,
}: {
  data: GuardianProgressData;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-slate-100">Your child&apos;s progress</h2>
      <p className="mt-2 text-sm text-slate-400">
        A simple view to help you support learning at home.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Average score</p>
          <p className="mt-2 text-3xl font-semibold text-slate-100">
            {Math.round(data.avgScore * 100)}%
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Learning progress</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">
            {masteryLabel(data.masteryLevel)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Recent direction</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">
            {trendLabel(data.improvementTrend)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-200">Doing well</p>
          <p className="mt-2 text-sm text-slate-200">
            {data.doingWell ?? "Steady effort is showing in the learning record."}
          </p>
        </div>
        <div className="rounded-2xl bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-200">Needs support</p>
          <p className="mt-2 text-sm text-slate-200">
            {data.needsHelp ?? "Keep checking in on confidence and daily practice."}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900/80 p-4">
          <p className="text-sm font-semibold text-slate-100">What you can do this week</p>
          <div className="mt-2 space-y-2">
            {data.supportSuggestions.length === 0 ? (
              <p className="text-sm text-slate-300">
                Keep encouraging steady routines at home.
              </p>
            ) : (
              data.supportSuggestions.slice(0, 3).map((suggestion) => (
                <p key={suggestion} className="text-sm text-slate-300">
                  • {suggestion}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-slate-400">
        {data.hasSuggestedSupport
          ? "A little extra encouragement at home could help right now."
          : "Keep supporting the habits that are already helping."}
      </p>
    </Card>
  );
}
