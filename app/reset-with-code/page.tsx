"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ResetWithCodePage() {
  const [step, setStep] = useState<"code" | "password">("code");
  const [adminCode, setAdminCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(adminCode.trim())) {
      setError("Please enter the 6-digit code provided by your school admin.");
      return;
    }
    setError(null);
    setStep("password");
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-with-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: adminCode.trim(), password }),
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
      <div className="w-full max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 backdrop-blur">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[var(--ll-text)]">Enter Reset Code</h1>
          <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
            Ask your school admin for a 6-digit reset code.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[var(--ll-yellow)]">
              Password reset successfully. You can now sign in.
            </p>
            <Link href="/login" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Go to login
            </Link>
          </div>
        ) : step === "code" ? (
          <form onSubmit={handleCodeSubmit} className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text)]">
                6-digit reset code
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-center text-2xl tracking-[0.4em] text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                placeholder="000000"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
            >
              Continue
            </button>

            <div className="text-center text-xs text-[var(--ll-text-muted)]">
              Have a reset link instead?{" "}
              <Link href="/forgot-password" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
                Use email
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-sm">
            <p className="text-xs text-[var(--ll-text-muted)]">
              Code accepted. Set your new password below.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text)]">New Password</label>
              <input
                required
                type="password"
                minLength={8}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text)]">Confirm Password</label>
              <input
                required
                type="password"
                minLength={8}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("code"); setError(null); }}
              className="w-full text-center text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
            >
              Back to code entry
            </button>
          </form>
        )}

        <div className="text-center">
          <Link href="/login" className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)]">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
