"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AlertPrefs = {
  alertLowGrade: boolean;
  alertInactive: boolean;
  alertNewSubmission: boolean;
  alertGuardianMessage: boolean;
  dailyDigest: boolean;
  digestHour: number;
};

const TOGGLES: Array<{ key: keyof AlertPrefs; label: string; help: string; isBoolean: true }> = [
  {
    key: "alertLowGrade",
    label: "Low Grade Alert",
    help: "Notify me when a student's rolling average drops below 60%.",
    isBoolean: true,
  },
  {
    key: "alertInactive",
    label: "Inactive Student Alert",
    help: "Notify me when a student hasn't logged in for 5+ days.",
    isBoolean: true,
  },
  {
    key: "alertNewSubmission",
    label: "New Submission Alert",
    help: "Notify me when a student submits a homework assignment.",
    isBoolean: true,
  },
  {
    key: "alertGuardianMessage",
    label: "Guardian Message Alert",
    help: "Notify me when a guardian sends a new message.",
    isBoolean: true,
  },
  {
    key: "dailyDigest",
    label: "Daily Digest",
    help: "Receive a single daily summary push instead of individual alerts.",
    isBoolean: true,
  },
];

export default function TeacherAlertPrefsPage() {
  const [prefs, setPrefs] = useState<AlertPrefs>({
    alertLowGrade: true,
    alertInactive: true,
    alertNewSubmission: true,
    alertGuardianMessage: true,
    dailyDigest: false,
    digestHour: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/alert-prefs")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setPrefs(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: keyof AlertPrefs, value: boolean | number) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/teacher/alert-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setMessage("Saved.");
    } catch (err: any) {
      setMessage(err.message);
      setPrefs(prefs); // revert
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] flex items-center justify-center">
        <p className="text-sm text-[var(--ll-text-muted)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">
        <div>
          <Link href="/teacher" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-2">Alert Preferences</h1>
          <p className="text-sm text-[var(--ll-text-muted)] mt-1">
            Choose which push notifications you receive.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 space-y-6">
          {TOGGLES.map(({ key, label, help }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--ll-text)]">{label}</p>
                <p className="text-xs text-[var(--ll-text-muted)] mt-0.5">{help}</p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleToggle(key, !prefs[key])}
                className={`relative h-7 w-12 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
                  prefs[key] ? "bg-[var(--ll-yellow)]" : "bg-[var(--ll-surface-muted)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    prefs[key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}

          {prefs.dailyDigest && (
            <div className="pt-4 border-t border-[var(--ll-border)]">
              <label className="block text-sm font-semibold text-[var(--ll-text)] mb-2">
                Digest time (UTC hour)
              </label>
              <select
                value={prefs.digestHour}
                onChange={(e) => handleToggle("digestHour", parseInt(e.target.value, 10))}
                disabled={saving}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00 UTC
                  </option>
                ))}
              </select>
            </div>
          )}

          {message && (
            <p className={`text-sm ${message === "Saved." ? "text-[var(--ll-yellow)]" : "text-red-400"}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
