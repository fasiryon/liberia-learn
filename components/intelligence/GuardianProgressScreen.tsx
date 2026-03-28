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

  return <GuardianProgressCard data={data} />;
}
