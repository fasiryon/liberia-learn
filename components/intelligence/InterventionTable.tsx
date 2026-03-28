"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/Card";

export type TeacherInterventionItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  recommendationType: string;
  reason: string;
  confidenceScore: number;
  status: string;
  createdAt: string;
  expiresAt?: string | null;
  workflowState?: string;
};

function recommendationLabel(type: string) {
  return type.replace(/_/g, " ");
}

function workflowTone(type: string) {
  if (type === "teacher_attention") {
    return "border-red-500/20 bg-red-500/10 text-red-200";
  }
  if (type === "extra_practice") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export function InterventionTable({
  items,
  emptyMessage,
  onAction,
  disabled = false,
}: {
  items: TeacherInterventionItem[];
  emptyMessage: string;
  onAction?: (id: string, status: "actioned" | "dismissed") => Promise<void>;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${workflowTone(item.recommendationType)}`}
                >
                  {recommendationLabel(item.recommendationType)}
                </span>
                {item.studentName ? (
                  <p className="text-sm font-semibold text-slate-100">
                    {item.studentName}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-slate-300">{item.reason}</p>
              <p className="text-xs text-slate-500">
                Confidence {Math.round(item.confidenceScore * 100)}% |{" "}
                {item.workflowState ?? "Needs review"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled || isPending || !onAction}
                onClick={() =>
                  startTransition(() => {
                    void onAction?.(item.id, "actioned");
                  })
                }
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
              >
                Mark actioned
              </button>
              <button
                type="button"
                disabled={disabled || isPending || !onAction}
                onClick={() =>
                  startTransition(() => {
                    void onAction?.(item.id, "dismissed");
                  })
                }
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
