"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import type { DemoHintGroup } from "@/lib/demoHints";
import { DemoHints } from "@/components/DemoHints";

type LoginClientProps = {
  showDemoHints: boolean;
  demoGroups: DemoHintGroup[];
  demoDefaults: { email: string; password: string } | null;
};

/** Map role to default landing page */
function defaultRouteForRole(role: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "GUARDIAN":
      return "/guardian";
    default:
      return "/dashboard";
  }
}

/** Check if a next URL is safe for the given role */
function isNextUrlSafeForRole(url: string, role: string): boolean {
  // Only allow relative paths
  if (!url.startsWith("/")) return false;
  // Block cross-role escalation
  if (role === "STUDENT" && (url.startsWith("/admin") || url.startsWith("/teacher"))) return false;
  if (role === "TEACHER" && url.startsWith("/admin")) return false;
  if (role === "GUARDIAN" && (url.startsWith("/admin") || url.startsWith("/teacher") || url.startsWith("/platform"))) return false;
  return true;
}

export default function LoginClient({ showDemoHints, demoGroups, demoDefaults }: LoginClientProps) {
  const router = useRouter();

  // Explicit redirect target from ?next= or ?callbackUrl= (middleware uses "next")
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNextUrl(params.get("next") || params.get("callbackUrl") || null);
    }
  }, []);

  const [role, setRole] = useState<"student" | "teacher" | "admin" | "guardian">("student");
  const [email, setEmail] = useState(demoDefaults?.email ?? "");
  const [password, setPassword] = useState(demoDefaults?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardianEnabled = FEATURE_FLAGS.ENABLE_GUARDIAN_PORTAL;

  const ROLES_WITH_GUARDIAN = ["student", "teacher", "admin", "guardian"] as const;
  const ROLES_NO_GUARDIAN = ["student", "teacher", "admin"] as const;

  const roleOptions = useMemo(
    () => (guardianEnabled ? ROLES_WITH_GUARDIAN : ROLES_NO_GUARDIAN),
    [guardianEnabled]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setLoading(false);
      setError(res.error);
      return;
    }

    // Fetch session to get the actual role from the server
    const session = await getSession();
    const userRole = (session?.user as any)?.role ?? "STUDENT";
    const isPlatformAdmin = (session?.user as any)?.isPlatformAdmin ?? false;

    // If explicit next URL was provided AND it's safe for this role, use it;
    // otherwise route by role default
    const safeNext = nextUrl && isNextUrlSafeForRole(nextUrl, userRole) ? nextUrl : null;
    const destination = safeNext || (isPlatformAdmin ? "/platform" : defaultRouteForRole(userRole));
    router.push(destination);
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
        </div>

        {showDemoHints && demoGroups.length > 0 && (
          <DemoHints title="Demo Login Hints" groups={demoGroups} />
        )}

        {/* Role selector */}
        <div className={`grid gap-2 text-xs ${guardianEnabled ? "grid-cols-4" : "grid-cols-3"}`}>
          {roleOptions.map((option) => (
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
                  ? "student@school.lr"
                  : role === "guardian"
                  ? "guardian@family.lr"
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
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              Forgot password?
            </Link>
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
