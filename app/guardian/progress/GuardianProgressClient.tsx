"use client";

import { useEffect, useState } from "react";
import { GuardianProgressScreen } from "@/components/intelligence/GuardianProgressScreen";

type ProgressResponse = {
  studentId: string;
  studentName: string;
  children: { studentId: string; name: string }[];
  hasEvidence: boolean;
  avgScore?: number;
  masteryLevel?: string;
  improvementTrend?: string;
  hasSuggestedSupport?: boolean;
  supportSuggestions?: string[];
  doingWell?: string;
  needsHelp?: string;
};

export default function GuardianProgressClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const query = selectedId ? `?studentId=${encodeURIComponent(selectedId)}` : "";
    fetch(`/api/guardian/performance${query}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load guardian progress");
        }
        return payload as ProgressResponse;
      })
      .then((payload) => setData(payload))
      .catch((loadError: Error) => setError(loadError.message));
  }, [selectedId]);

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div aria-busy="true" aria-label="Loading progress" className="h-48 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />;
  }

  const children = data.children ?? [];

  return (
    <div className="space-y-4">
      {children.length > 1 && (
        <label className="flex flex-col gap-1 text-sm text-[var(--ll-text)]">
          <span>Child</span>
          <select
            className="min-h-11 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 text-[var(--ll-text)]"
            value={data.studentId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {children.map((child) => (
              <option key={child.studentId} value={child.studentId}>
                {child.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <GuardianProgressScreen
        data={
          data.hasEvidence
            ? {
                avgScore: data.avgScore ?? 0,
                masteryLevel: data.masteryLevel ?? "developing",
                improvementTrend: data.improvementTrend ?? "stable",
                hasSuggestedSupport: data.hasSuggestedSupport ?? false,
                supportSuggestions: data.supportSuggestions ?? [],
                doingWell: data.doingWell,
                needsHelp: data.needsHelp,
              }
            : null
        }
      />
    </div>
  );
}
