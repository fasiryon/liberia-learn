"use client";

import { useEffect, useState } from "react";
import { GuardianProgressScreen } from "@/components/intelligence/GuardianProgressScreen";

export default function GuardianProgressClient() {
  const [data, setData] = useState<{
    avgScore: number;
    masteryLevel: string;
    improvementTrend: string;
    hasSuggestedSupport: boolean;
    supportSuggestions: string[];
    doingWell: string;
    needsHelp: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guardian/performance", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load guardian progress");
        }
        return payload;
      })
      .then((payload) => setData(payload))
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="h-48 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />;
  }

  return <GuardianProgressScreen data={data} />;
}
