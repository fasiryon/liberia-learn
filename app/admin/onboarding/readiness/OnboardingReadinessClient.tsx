"use client";

import { useEffect, useState } from "react";
import { OnboardingReadinessScreen } from "@/components/intelligence/OnboardingReadinessScreen";

export default function OnboardingReadinessClient() {
  const [data, setData] = useState<{
    percentComplete: number;
    missingSteps: string[];
    readinessScore: number;
    readinessLevel: "not_ready" | "partial" | "ready";
    steps: Array<{ id: string; title: string; complete: boolean; href: string; missing: string[] }>;
  } | null>(null);
  const [steps, setSteps] = useState<
    Array<{ id: string; title: string; complete: boolean; href: string; missing: string[] }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/onboarding/readiness", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load onboarding readiness");
        }
        return payload;
      })
      .then((payload) => {
        setData(payload);
        setSteps(payload.steps ?? []);
      })
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!steps.length) {
    return <div className="h-48 animate-pulse rounded-xl bg-[var(--ll-bg)]/70" />;
  }

  return (
    <OnboardingReadinessScreen
      steps={steps}
      percentComplete={data?.percentComplete ?? 0}
      missingSteps={data?.missingSteps ?? []}
      readinessScore={data?.readinessScore ?? 0}
      readinessLevel={data?.readinessLevel ?? "not_ready"}
    />
  );
}
