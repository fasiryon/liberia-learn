"use client";

import { useEffect, useState } from "react";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";

export default function TeacherProfileClient() {
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/profile", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load profile");
        if (active) {
          setBio(payload.bio ?? "");
        }
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

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/teacher/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save profile");
      setMessage("Profile updated.");
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <TeacherDashboardBackLink />
          <h1 className="text-3xl font-bold">Teacher Profile</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Add a short teaching bio so students and school staff can understand your classroom focus.
          </p>
        </div>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <label className="block text-sm font-medium text-[var(--ll-text)]">
            Short bio
          </label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="mt-3 min-h-[180px] w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
            placeholder="Example: I teach JSS mathematics and focus on step-by-step problem solving."
            disabled={loading}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving || loading}
              className="rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
            {message ? <p className="text-sm text-[var(--ll-text)]">{message}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
