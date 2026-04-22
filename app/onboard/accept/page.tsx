"use client";

import { Suspense, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_55%)]" />
        <div className="w-full max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 shadow-none shadow-emerald-500/20 backdrop-blur text-center">
          <p className="text-sm text-red-400">Invalid or missing invite link.</p>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/40 hover:bg-[var(--ll-yellow-soft)]"
          >
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_55%)]" />
        <div className="w-full max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 shadow-none shadow-emerald-500/20 backdrop-blur text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ll-yellow)] text-lg font-black text-[var(--ll-text-faint)] mx-auto">
            L
          </div>
          <h1 className="text-lg font-semibold text-[var(--ll-text)]">Account created!</h1>
          <p className="text-xs text-[var(--ll-text-muted)]">
            You can now sign in with your email and password.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/40 hover:bg-[var(--ll-yellow-soft)]"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/onboard/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_55%)]" />

      <div className="w-full max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 shadow-none shadow-emerald-500/20 backdrop-blur">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ll-yellow)] text-lg font-black text-[var(--ll-text-faint)]">
            L
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">
            Create your account
          </h1>
          <p className="text-xs text-[var(--ll-text-muted)]">
            Complete setup to join LiberiaLearn.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--ll-text)]">
              Full Name
            </label>
            <input
              required
              type="text"
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--ll-text)]">
              Password
            </label>
            <input
              required
              type="password"
              minLength={8}
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[var(--ll-text)]">
              Confirm Password
            </label>
            <input
              required
              type="password"
              minLength={8}
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
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
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/40 hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center text-[11px] text-[var(--ll-text-faint)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
