"use client";

import { useState } from "react";
import Link from "next/link";

export default function GuardianRegistrationPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    schoolCode: "",
    studentFullName: "",
    studentDateOfBirth: "",
    password: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setStatus({ ok: false, message: "Please provide an email address or phone number." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/register/guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, message: data.error || "Registration failed. Please try again." });
        return;
      }
      setLoginId(data.loginId);
      setStatus({ ok: true, message: "Account created! Your login ID is shown below." });
    } catch {
      setStatus({ ok: false, message: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (loginId) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] flex items-center justify-center px-4">
        <section className="w-full max-w-md rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Registration complete</p>
          <h1 className="mt-2 text-2xl font-bold">Welcome to LiberiaLearn!</h1>
          <p className="mt-3 text-sm text-[var(--ll-text)]">Your guardian login ID is:</p>
          <p className="mt-2 rounded-xl bg-[var(--ll-bg)] px-4 py-3 font-mono text-lg font-bold text-[var(--ll-yellow)]">{loginId}</p>
          <p className="mt-3 text-xs text-[var(--ll-text-muted)]">Save this ID — you will use it to sign in.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-xl bg-[var(--ll-yellow-soft)] px-6 py-3 text-sm font-bold text-[var(--ll-text-faint)]">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-xl px-4 py-8">
        <Link href="/login" className="text-xs font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          ← Back to login
        </Link>

        <section className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 shadow-none shadow-black/30">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Guardian registration</p>
          <h1 className="mt-2 text-3xl font-bold">Create a guardian account</h1>
          <p className="mt-2 text-sm text-[var(--ll-text)]">
            You need your child&apos;s school code and their exact full name and date of birth as registered.
            Guardian data rights and deletion requests are explained in the{" "}
            <Link href="/legal/data-for-minors" className="text-[var(--ll-yellow)] hover:underline">
              Data Policy for Minors
            </Link>.
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs text-[var(--ll-text-muted)]">Your full name</span>
              <input
                required
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="Your full name"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-[var(--ll-text-muted)]">Email address</span>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="your@email.com"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-[var(--ll-text-muted)]">Phone number</span>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+231 XX XXX XXXX"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>
            <p className="sm:col-span-2 -mt-2 text-xs text-[var(--ll-text-faint)]">At least one of email or phone is required.</p>

            <label className="sm:col-span-2">
              <span className="text-xs text-[var(--ll-text-muted)]">School code</span>
              <input
                required
                value={form.schoolCode}
                onChange={set("schoolCode")}
                placeholder="e.g. LIB-MONT-A1B2"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 font-mono text-sm uppercase"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs text-[var(--ll-text-muted)]">Student&apos;s full name</span>
              <input
                required
                value={form.studentFullName}
                onChange={set("studentFullName")}
                placeholder="Exactly as registered at school"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-[var(--ll-text-muted)]">Student&apos;s date of birth</span>
              <input
                required
                type="date"
                value={form.studentDateOfBirth}
                onChange={set("studentDateOfBirth")}
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>

            <div />

            <label>
              <span className="text-xs text-[var(--ll-text-muted)]">Password</span>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={set("password")}
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-[var(--ll-text-muted)]">Confirm password</span>
              <input
                required
                type="password"
                minLength={8}
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Repeat your password"
                className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
            </label>

            <button
              disabled={busy}
              className="sm:col-span-2 rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-bold text-[var(--ll-text-faint)] disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create guardian account"}
            </button>

            {status && (
              <p
                className={`sm:col-span-2 rounded-xl border px-3 py-3 text-sm ${
                  status.ok
                    ? "border-emerald-500/30 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                    : "border-red-500/30 bg-red-950/40 text-red-300"
                }`}
              >
                {status.message}
              </p>
            )}
          </form>

          <p className="mt-4 text-xs text-[var(--ll-text-muted)]">
            Registering as a student?{" "}
            <Link href="/register/student" className="text-[var(--ll-yellow)] hover:underline">
              Student registration
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
