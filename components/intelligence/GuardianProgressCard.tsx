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
    <Card className="p-6 sm:p-7">
      <h2 className="text-xl font-semibold text-[var(--ll-text)]">Your child&apos;s progress</h2>
      <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
        A simple view to help you support learning at home.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-[var(--ll-bg)]/60 p-4">
          <p className="text-xs text-[var(--ll-text-faint)]">Average score</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">
            {Math.round(data.avgScore * 100)}%
          </p>
        </div>
        <div className="rounded-xl bg-[var(--ll-bg)]/60 p-4">
          <p className="text-xs text-[var(--ll-text-faint)]">Learning progress</p>
          <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
            {masteryLabel(data.masteryLevel)}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--ll-bg)]/60 p-4">
          <p className="text-xs text-[var(--ll-text-faint)]">Recent direction</p>
          <p className="mt-2 text-xl font-semibold text-[var(--ll-text)]">
            {trendLabel(data.improvementTrend)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-[var(--ll-yellow)]/10 p-4">
          <p className="text-sm font-semibold text-[var(--ll-yellow)]">Doing well</p>
          <p className="mt-2 text-sm text-[var(--ll-text)]">
            {data.doingWell ?? "Steady effort is showing in the learning record."}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--ll-yellow-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--ll-yellow)]">Needs support</p>
          <p className="mt-2 text-sm text-[var(--ll-text)]">
            {data.needsHelp ?? "Keep checking in on confidence and daily practice."}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4">
          <p className="text-sm font-semibold text-[var(--ll-text)]">What you can do this week</p>
          <div className="mt-2 space-y-2">
            {data.supportSuggestions.length === 0 ? (
              <p className="text-sm text-[var(--ll-text)]">
                Keep encouraging steady routines at home.
              </p>
            ) : (
              data.supportSuggestions.slice(0, 3).map((suggestion) => (
                <p key={suggestion} className="text-sm text-[var(--ll-text)]">
                  {"- "}
                  {suggestion}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-[var(--ll-text-muted)]">
        {data.hasSuggestedSupport
          ? "A little extra encouragement at home could help right now."
          : "Keep supporting the habits that are already helping."}
      </p>
    </Card>
  );
}
