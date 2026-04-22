"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 shadow-none backdrop-blur">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[var(--ll-text)]">
            Forgot Password
          </h1>
          <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
            Enter your email and we will send a reset link.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[var(--ll-yellow)]">
              If that email is registered, a reset link has been sent. Check
              your inbox.
            </p>
            <Link
              href="/login"
              className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text)]">
                Email address
              </label>
              <input
                required
                type="email"
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                placeholder="you@school.lr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/40 hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
