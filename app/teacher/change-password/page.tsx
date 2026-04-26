"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/teacher/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to change password.");
      }
      router.push("/teacher/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-12 text-[var(--ll-text)]">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
            Account Security
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--ll-text)]">Set your password</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Your account was created with a temporary password. Choose a new password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">
              Temporary password
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 text-base text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)] focus:ring-1 focus:ring-[var(--ll-yellow)]/40"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">
              New password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 text-base text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)] focus:ring-1 focus:ring-[var(--ll-yellow)]/40"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 text-base text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)] focus:ring-1 focus:ring-[var(--ll-yellow)]/40"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-full bg-[var(--ll-yellow)] px-6 py-3 text-sm font-bold text-[var(--ll-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Set new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
