"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Preferences = {
  attendance: boolean;
  examResults: boolean;
  lowPerformance: boolean;
};

export default function GuardianSettingsClient() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [updatePhoneHref, setUpdatePhoneHref] = useState("/admin/guardian-link");
  const [preferences, setPreferences] = useState<Preferences>({
    attendance: true,
    examResults: true,
    lowPerformance: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/guardian/settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load settings");
        if (!active) return;
        setPhoneNumber(payload.phoneNumber ?? "");
        setUpdatePhoneHref(payload.updatePhoneHref ?? "/admin/guardian-link");
        setPreferences(payload.preferences);
      })
      .catch((err: Error) => {
        if (active) setMessage(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/guardian/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save settings");
      setMessage("Settings updated.");
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof Preferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/guardian" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Back to Guardian Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Guardian Settings</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Choose which SMS updates you want to receive for your child.
          </p>
        </div>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
          <div className="rounded-xl bg-[var(--ll-bg)]/70 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Phone number</p>
            <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
              {loading ? "Loading..." : phoneNumber || "No phone number on file"}
            </p>
            <Link href={updatePhoneHref} className="mt-3 inline-flex text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Update phone number
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["attendance", "Attendance"],
              ["examResults", "Exam results"],
              ["lowPerformance", "Low performance warnings"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key as keyof Preferences)}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-left"
              >
                <span className="text-sm text-[var(--ll-text)]">{label}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    preferences[key as keyof Preferences]
                      ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                      : "bg-[var(--ll-surface)] text-[var(--ll-text-muted)]"
                  }`}
                >
                  {preferences[key as keyof Preferences] ? "On" : "Off"}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <p className="text-sm text-[var(--ll-text-muted)]">Standard SMS rates may apply</p>
          </div>
          {message ? <p className="mt-3 text-sm text-[var(--ll-text)]">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
