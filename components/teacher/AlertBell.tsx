"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export type AlertBellItem = {
  id: string;
  alertType: string;
  severity: string;
  reason: string;
  studentHref: string | null;
  recommendedAction: string | null;
};

type Props = {
  alerts: AlertBellItem[];
  onMarkReviewed: (id: string) => void;
  onDismiss: (id: string) => void;
};

export function AlertBell({ alerts, onMarkReviewed, onDismiss }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = alerts.length;
  const top5 = alerts.slice(0, 5);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="alert-bell-button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${count} teacher alert${count !== 1 ? "s" : ""}`}
        className="relative inline-flex items-center justify-center rounded-lg border border-[var(--ll-border-strong)] p-2 text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface-muted)] hover:text-[var(--ll-text)]"
      >
        <Bell className="h-4 w-4" strokeWidth={1.5} />
        {count > 0 && (
          <span
            data-testid="alert-bell-badge"
            className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-0.5 text-[10px] font-bold leading-none text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="alert-bell-dropdown"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-[var(--ll-border)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-muted)]">
              Alerts{count > 0 ? ` (${count})` : ""}
            </p>
            <Link
              href="/teacher/alerts"
              onClick={() => setOpen(false)}
              className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
            >
              View all
            </Link>
          </div>

          {top5.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--ll-text-faint)]">
              No active alerts.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-[var(--ll-border)] overflow-y-auto">
              {top5.map((alert) => (
                <li key={alert.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        alert.severity === "high" || alert.severity === "critical"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-orange-500/15 text-orange-300"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-[var(--ll-text-muted)]">
                        {alert.alertType.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--ll-text)]">{alert.reason}</p>
                      {alert.recommendedAction && (
                        <p className="mt-0.5 text-xs text-[var(--ll-text-faint)]">
                          → {alert.recommendedAction}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {alert.studentHref && (
                      <Link
                        href={alert.studentHref}
                        onClick={() => setOpen(false)}
                        className="text-xs font-medium text-[var(--ll-yellow)] hover:underline"
                      >
                        View student →
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onMarkReviewed(alert.id);
                      }}
                      className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                    >
                      Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDismiss(alert.id);
                      }}
                      className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[var(--ll-border)] px-4 py-3">
            <Link
              href="/teacher/alerts"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center text-xs font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              data-testid="alert-bell-view-all"
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
