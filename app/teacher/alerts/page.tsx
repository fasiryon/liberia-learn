"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardTopBar } from "@/components/DashboardTopBar";

type AlertItem = {
  id: string;
  alertType: string;
  severity: string;
  reason: string;
  studentId: string | null;
  weakConcept: string | null;
  weakLesson: string | null;
  recommendedAction: string | null;
  action: {
    label: string;
    actionType: string;
    targetStudents: string[];
    targetClassId: string | null;
    evidence: string;
    status: "available" | "needs_review" | "unsupported";
    href: string | null;
  } | null;
  studentHref: string | null;
  createdAt: string;
};

type Filter = "all" | "active" | "reviewed" | "dismissed";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  active: "Active",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
};

export default function TeacherAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});
  const [draftedActions, setDraftedActions] = useState<Record<string, string>>({});
  const [executionStatus, setExecutionStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    const param = filter === "active" ? "" : `?filter=${filter}`;
    fetch(`/api/teacher/alerts${param}`)
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  async function handleAction(alertId: string, action: "reviewed" | "dismissed") {
    setLocalDismissed((prev) => new Set([...prev, alertId]));
    await fetch("/api/teacher/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId, action }),
    }).catch(() => null);
  }

  async function handleTeacherAction(alert: AlertItem) {
    if (!alert.action || alert.action.status === "unsupported") return;
    setActionMessages((current) => ({ ...current, [alert.id]: "Preparing action..." }));
    try {
      const response = await fetch("/api/teacher/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id, actionType: alert.action.actionType }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to prepare action.");
      if (data?.teacherActionId) {
        setDraftedActions((current) => ({ ...current, [alert.id]: data.teacherActionId }));
        setExecutionStatus((current) => ({ ...current, [alert.id]: "draft" }));
      }
      setActionMessages((current) => ({
        ...current,
        [alert.id]:
          alert.action?.status === "needs_review"
            ? "Action drafted for teacher review."
            : "Action ready for teacher review.",
      }));
    } catch (error: any) {
      setActionMessages((current) => ({
        ...current,
        [alert.id]: error?.message ?? "Unable to prepare action.",
      }));
    }
  }

  async function handleExecute(alert: AlertItem) {
    const actionId = draftedActions[alert.id];
    if (!actionId) return;
    if (!confirm("Confirm and execute this teacher action?")) return;
    setExecutionStatus((current) => ({ ...current, [alert.id]: "confirmed" }));
    setActionMessages((current) => ({ ...current, [alert.id]: "Executing action..." }));
    try {
      const response = await fetch("/api/teacher/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to execute action.");
      setExecutionStatus((current) => ({ ...current, [alert.id]: data.status ?? "executed" }));
      setActionMessages((current) => ({ ...current, [alert.id]: data.message ?? "Action executed." }));
    } catch (error: any) {
      setExecutionStatus((current) => ({ ...current, [alert.id]: "failed" }));
      setActionMessages((current) => ({ ...current, [alert.id]: error?.message ?? "Unable to execute action." }));
    }
  }

  const highCount = alerts.filter(
    (a) => !localDismissed.has(a.id) && (a.severity === "high" || a.severity === "critical")
  ).length;

  const visible = alerts.filter((a) => !localDismissed.has(a.id));

  return (
    <div className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-4xl space-y-5">
        <DashboardTopBar
          roleLabel="Teacher"
          roleBadgeBg="bg-[var(--ll-silver-soft)] border-[var(--ll-silver)]/20"
          roleAccent="text-[var(--ll-text-muted)]"
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-[var(--ll-text-faint)]">
              <Link href="/teacher/dashboard" className="hover:text-[var(--ll-text-muted)]">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-[var(--ll-text-muted)]">Alerts</span>
            </nav>
            <h1 className="mt-2 text-xl font-semibold text-[var(--ll-text)]">Teacher Alerts</h1>
            {highCount > 0 && (
              <p className="mt-1 text-sm text-orange-400">
                {highCount} high-priority alert{highCount !== 1 ? "s" : ""} need immediate attention.
              </p>
            )}
          </div>
          <Link
            href="/teacher/dashboard"
            className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "reviewed", "dismissed"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setLocalDismissed(new Set());
                setFilter(f);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "border-[var(--ll-yellow)]/40 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                  : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:border-[var(--ll-border-strong)] hover:text-[var(--ll-text)]"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--ll-text-faint)]">
              {filter === "all" ? "No alerts in the last 30 days." : `No ${filter} alerts.`}
            </p>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 text-xs text-[var(--ll-text-faint)] underline hover:text-[var(--ll-text-muted)]"
              >
                Show all alerts
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3" data-testid="alerts-list">
            {visible.map((alert) => (
              <div
                key={alert.id}
                data-testid="alert-card"
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          alert.severity === "high" || alert.severity === "critical"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-orange-500/15 text-orange-300"
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs font-medium text-[var(--ll-text-muted)]">
                        {alert.alertType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-[var(--ll-text-faint)]">
                        {new Date(alert.createdAt).toLocaleDateString("en-US")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-[var(--ll-text)]">{alert.reason}</p>
                    {alert.recommendedAction && (
                      <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                        → {alert.recommendedAction}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {alert.action && alert.action.status !== "unsupported" && (
                      <button
                        type="button"
                        onClick={() => handleTeacherAction(alert)}
                        disabled={Boolean(draftedActions[alert.id])}
                        className="rounded-md bg-[var(--ll-yellow-soft)] px-2.5 py-1 text-xs font-medium text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow)]"
                      >
                        {draftedActions[alert.id] ? "Draft ready" : alert.action.label}
                      </button>
                    )}
                    {draftedActions[alert.id] && executionStatus[alert.id] !== "executed" && (
                      <button
                        type="button"
                        onClick={() => handleExecute(alert)}
                        className="rounded-md border border-[var(--ll-yellow)]/40 px-2.5 py-1 text-xs font-medium text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow)]/10"
                      >
                        Confirm & Execute
                      </button>
                    )}
                    {alert.studentHref && (
                      <Link
                        href={alert.studentHref}
                        className="rounded-md border border-[var(--ll-border)] px-2.5 py-1 text-xs font-medium text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]"
                      >
                        View student
                      </Link>
                    )}
                    {filter !== "reviewed" && (
                      <button
                        type="button"
                        onClick={() => handleAction(alert.id, "reviewed")}
                        className="rounded-md border border-[var(--ll-border)] px-2.5 py-1 text-xs font-medium text-[var(--ll-text-muted)] hover:border-[var(--ll-border-strong)]"
                      >
                        Mark reviewed
                      </button>
                    )}
                    {filter !== "dismissed" && (
                      <button
                        type="button"
                        onClick={() => handleAction(alert.id, "dismissed")}
                        className="rounded-md px-2.5 py-1 text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
                {actionMessages[alert.id] ? (
                  <p className="mt-3 text-xs text-[var(--ll-text-muted)]">
                    {executionStatus[alert.id] ? `${executionStatus[alert.id]} - ` : ""}
                    {actionMessages[alert.id]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[var(--ll-text-faint)]">
          Showing alerts from the last 30 days.{" "}
          <Link href="/teacher/dashboard" className="hover:text-[var(--ll-text-muted)]">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
