import Link from "next/link";
import { Card } from "@/components/ui/Card";

export type TeacherConfusionItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  lessonId: string | null;
  conceptTag: string;
  conceptLabel: string;
  confusionType: string;
  severity: string;
  detectedAt: string;
};

function badgeClasses(severity: string) {
  if (severity === "high") {
    return "border-red-500/20 bg-red-500/15 text-red-300";
  }
  if (severity === "medium") {
    return "border-amber-500/20 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]";
  }
  return "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text)]";
}

function severityLabel(severity: string) {
  return severity === "high" ? "High priority" : severity === "medium" ? "Medium priority" : "Low priority";
}

export function ConfusionList({
  items,
  emptyMessage,
}: {
  items: TeacherConfusionItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="ll-empty p-5">
        <p className="text-sm text-[var(--ll-text-muted)]">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(item.severity)}`}
                >
                  {severityLabel(item.severity)}
                </span>
                {item.studentName ? (
                  <Link
                    href={`/teacher/intelligence/${item.studentId}`}
                    className="text-sm font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
                  >
                    {item.studentName}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-[var(--ll-text)]">
                    {item.studentId}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-[var(--ll-text)]">{item.conceptLabel}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                {item.confusionType.replace(/_/g, " ")}
              </p>
            </div>
            <div className="grid gap-1 text-xs text-[var(--ll-text-faint)] lg:text-right">
              <span>{item.lessonId ? `Lesson ${item.lessonId}` : "General pattern"}</span>
              <span>{new Date(item.detectedAt).toLocaleString("en-LR")}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
