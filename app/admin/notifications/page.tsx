"use client";

import { useEffect, useState } from "react";

type NotifLog = {
  id: string;
  recipient: string;
  channel: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
};

export default function AdminNotificationsPage() {
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notifications")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification History</h1>
        <p className="text-sm text-[var(--ll-text-muted)] mt-1">SMS and email notifications sent to guardians</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-[var(--ll-surface)]/50 animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center">
          <p className="text-[var(--ll-text-muted)]">No notifications sent yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ll-border)] text-xs text-[var(--ll-text-muted)]">
                <th className="px-4 py-3 text-left">Guardian</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-[var(--ll-border)]/50">
                  <td className="px-4 py-3 text-[var(--ll-text)]">{l.user?.name || l.user?.email || "Unknown"}</td>
                  <td className="px-4 py-3 text-[var(--ll-text-muted)] font-mono text-xs">{l.recipient}</td>
                  <td className="px-4 py-3 text-[var(--ll-text-muted)]">{l.channel}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${l.status === "sent" ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]" : "bg-red-500/20 text-red-300"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--ll-text-faint)]">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{l.error || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
