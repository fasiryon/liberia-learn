"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/teacher" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Teacher Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Teacher Profile</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add a short teaching bio so students and school staff can understand your classroom focus.
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <label className="block text-sm font-medium text-slate-200">
            Short bio
          </label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="mt-3 min-h-[180px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            placeholder="Example: I teach JSS mathematics and focus on step-by-step problem solving."
            disabled={loading}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving || loading}
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
            {message ? <p className="text-sm text-slate-300">{message}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
