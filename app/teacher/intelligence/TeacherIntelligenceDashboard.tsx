"use client";

import { useEffect, useState } from "react";
import { TeacherDashboardScreen, type TeacherDashboardSummary } from "@/components/intelligence/TeacherDashboardScreen";
import type { TeacherConfusionItem } from "@/components/intelligence/ConfusionList";
import type { TeacherInterventionItem } from "@/components/intelligence/InterventionTable";
import { teacherWelcomeStorageKey } from "@/app/teacher/TeacherWelcomeGate";

export default function TeacherIntelligenceDashboard() {
  const [summary, setSummary] = useState<TeacherDashboardSummary | null>(null);
  const [confusions, setConfusions] = useState<TeacherConfusionItem[]>([]);
  const [interventions, setInterventions] = useState<TeacherInterventionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const [summaryRes, confusionsRes, interventionsRes] = await Promise.all([
        fetch("/api/teacher/performance", { cache: "no-store" }),
        fetch("/api/teacher/confusions", { cache: "no-store" }),
        fetch("/api/teacher/interventions", { cache: "no-store" }),
      ]);

      if (!summaryRes.ok) {
        const payload = await summaryRes.json();
        throw new Error(payload.error ?? "Failed to load summary");
      }
      if (!confusionsRes.ok) {
        const payload = await confusionsRes.json();
        throw new Error(payload.error ?? "Failed to load confusion signals");
      }
      if (!interventionsRes.ok) {
        const payload = await interventionsRes.json();
        throw new Error(payload.error ?? "Failed to load interventions");
      }

      setSummary(await summaryRes.json());
      setConfusions(await confusionsRes.json());
      setInterventions(await interventionsRes.json());
    } catch (loadError: any) {
      setError(loadError?.message ?? "Failed to load intelligence dashboard");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("teacher_has_seen_intelligence", "true");
      window.localStorage.setItem(teacherWelcomeStorageKey, "true");
    }
    void load();
  }, []);

  async function handleAction(id: string, status: "actioned" | "dismissed") {
    setError(null);
    try {
      const response = await fetch("/api/teacher/interventions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update intervention");
      }

      setInterventions((current) => current.filter((item) => item.id !== id));
      setSummary((current) =>
        current
          ? {
              ...current,
              activeInterventions: Math.max(0, current.activeInterventions - 1),
            }
          : current
      );
    } catch (actionError: any) {
      setError(actionError?.message ?? "Failed to update intervention");
    }
  }

  return (
    <TeacherDashboardScreen
      summary={summary}
      confusions={confusions}
      interventions={interventions}
      error={error}
      busy={busy}
      onAction={handleAction}
    />
  );
}
