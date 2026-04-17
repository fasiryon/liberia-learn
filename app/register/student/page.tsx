"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

function StudentRegistrationForm() {
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") ?? "";

  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    grade: "1",
    schoolCode: prefillCode,
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/register/student", {
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
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Registration complete</p>
          <h1 className="mt-2 text-2xl font-bold">Welcome to LiberiaLearn!</h1>
          <p className="mt-3 text-sm text-slate-300">Your login ID is:</p>
          <p className="mt-2 rounded-xl bg-slate-950 px-4 py-3 font-mono text-lg font-bold text-emerald-300">{loginId}</p>
          <p className="mt-3 text-xs text-slate-400">Save this ID — you will use it to sign in.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        <Link href="/login" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
          ← Back to login
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Student registration</p>
          <h1 className="mt-2 text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-300">
            You need your school&apos;s registration code. Ask your teacher or principal.
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs text-slate-400">Full name</span>
              <input
                required
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="As it appears on your school records"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-slate-400">Date of birth</span>
              <input
                required
                type="date"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-slate-400">Grade</span>
              <select
                value={form.grade}
                onChange={set("grade")}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs text-slate-400">School code</span>
              <input
                required
                value={form.schoolCode}
                onChange={set("schoolCode")}
                placeholder="e.g. LIB-MONT-A1B2"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm uppercase"
              />
            </label>

            <label>
              <span className="text-xs text-slate-400">Email (optional)</span>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="your@email.com"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-slate-400">Phone (optional)</span>
              <input
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+231 XX XXX XXXX"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-slate-400">Password</span>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={set("password")}
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              />
            </label>

            <label>
              <span className="text-xs text-slate-400">Confirm password</span>
              <input
                required
                type="password"
                minLength={8}
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Repeat your password"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              />
            </label>

            <button
              disabled={busy}
              className="sm:col-span-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>

            {status && (
              <p
                className={`sm:col-span-2 rounded-xl border px-3 py-3 text-sm ${
                  status.ok
                    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                    : "border-red-500/30 bg-red-950/40 text-red-300"
                }`}
              >
                {status.message}
              </p>
            )}
          </form>

          <p className="mt-4 text-xs text-slate-400">
            Are you a parent or guardian?{" "}
            <Link href="/register/guardian" className="text-emerald-300 hover:underline">
              Register as guardian
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function StudentRegistrationPage() {
  return (
    <Suspense fallback={null}>
      <StudentRegistrationForm />
    </Suspense>
  );
}
