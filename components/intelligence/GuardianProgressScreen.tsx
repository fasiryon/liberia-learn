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
      <Card className="ll-empty p-6">
        <h2 className="text-xl font-semibold text-[var(--ll-text)]">Progress view</h2>
        <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
          Progress details will appear here once your child starts completing learning work.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <p className="text-sm text-[var(--ll-text)]">
          This page focuses on simple home support. Internal school follow-up details are not shown here.
        </p>
      </Card>
      <GuardianProgressCard data={data} />
    </div>
  );
}
