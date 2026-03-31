import { Card } from "@/components/ui/Card";
import { GuardianProgressCard } from "@/components/intelligence/GuardianProgressCard";

export function GuardianProgressScreen({
  data,
}: {
  data:
    | {
        avgScore: number;
        masteryLevel: string;
        improvementTrend: string;
        hasSuggestedSupport: boolean;
        supportSuggestions: string[];
        doingWell?: string;
        needsHelp?: string;
      }
    | null;
}) {
  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-slate-100">Progress view</h2>
        <p className="mt-2 text-sm text-slate-400">
          Progress details will appear here once your child starts completing learning work.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-slate-300">
          Family guidance is simplified and non-actionable. Internal school follow-up detail is not shown in guardian views.
        </p>
      </Card>
      <GuardianProgressCard data={data} />
    </div>
  );
}
