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
    return "border-amber-500/20 bg-amber-500/15 text-amber-300";
  }
  return "border-slate-700 bg-slate-800 text-slate-300";
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
      <Card className="p-5">
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClasses(item.severity)}`}
                >
                  {severityLabel(item.severity)}
                </span>
                {item.studentName ? (
                  <Link
                    href={`/teacher/intelligence/${item.studentId}`}
                    className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    {item.studentName}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-slate-100">
                    {item.studentId}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-100">{item.conceptLabel}</p>
              <p className="text-xs text-slate-500">
                {item.confusionType.replace(/_/g, " ")} |{" "}
                {new Date(item.detectedAt).toLocaleString("en-LR")}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {item.lessonId ? `Lesson ${item.lessonId}` : "General pattern"}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
