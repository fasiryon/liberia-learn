// app/login/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  // Callback URL (defaults to dashboard, but respects ?callbackUrl=... when present)
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cb = params.get("callbackUrl");
      if (cb) {
        setCallbackUrl(cb);
      }
    }
  }, []);

  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const [email, setEmail] = useState("student@school.lr");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    setLoading(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_55%),radial-gradient(circle_at_bottom,_#0ea5e933,_transparent_55%)]" />

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-slate-950">
            L
          </div>
          <h1 className="mt-1 text-lg font-semibold text-slate-50">
            Sign in to LiberiaLearn
          </h1>
          <p className="text-xs text-slate-400">
            Access your personalized lessons, assignments, and progress.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Demo account:{" "}
            <span className="font-mono">
              student@school.lr / password123
            </span>
          </p>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(["student", "teacher", "admin"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRole(option)}
              className={`rounded-full border px-2.5 py-1.5 capitalize ${
                role === option
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              {role === "student" ? "Student ID or Email" : "Email address"}
            </label>
            <input
              required
              type="email"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder={
                role === "student"
                  ? "student123@school.lr"
                  : "teacher@school.lr"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              required
              type="password"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500">
          <Link href="/" className="text-emerald-300 hover:text-emerald-200">
            Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
