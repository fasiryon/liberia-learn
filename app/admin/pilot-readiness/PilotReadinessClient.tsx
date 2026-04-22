"use client";

import { useEffect, useState } from "react";
import { PilotReadinessScreen } from "@/components/intelligence/PilotReadinessScreen";

export default function PilotReadinessClient() {
  const [data, setData] = useState<{
    readinessScore: number;
    readinessLevel: "not_ready" | "partial" | "ready";
    blockingIssues: Array<{ code: string; label: string; detail: string }>;
    nonBlockingIssues: Array<{ code: string; label: string; detail: string }>;
    teacherActivationStatus: "not_started" | "active" | "engaged";
    dataFlowStatus: "inactive" | "partial" | "active";
    guardianStatus: "inactive" | "active";
    sections: Array<{
      id: string;
      title: string;
      ready: boolean;
      score: number;
      weight: number;
      checks: Array<{ label: string; ready: boolean; detail: string }>;
    }>;
    latestEval: { runAt: string; passed: boolean } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/pilot-readiness", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load pilot readiness");
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

  return (
    <PilotReadinessScreen
      readinessScore={data.readinessScore}
      readinessLevel={data.readinessLevel}
      blockingIssues={data.blockingIssues}
      nonBlockingIssues={data.nonBlockingIssues}
      teacherActivationStatus={data.teacherActivationStatus}
      dataFlowStatus={data.dataFlowStatus}
      guardianStatus={data.guardianStatus}
      sections={data.sections}
      latestEval={data.latestEval}
    />
  );
}
