"use client";

// app/moe/login/MoeLoginClient.tsx
//
// Branded login form for Ministry of Education officials.
// Visually distinct from the school portal (deep navy palette, MOE branding).
//
// Auth flow:
//  1. Submit credentials via NextAuth signIn("credentials")
//  2. Fetch session and verify role === MOE_OFFICIAL
//  3. If not MOE_OFFICIAL: sign out, show "This portal is restricted to Ministry officials."
//  4. If MOE_OFFICIAL: redirect to /moe/dashboard

import { FormEvent, useState } from "react";
import { signIn, signOut, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PublicFooter } from "@/components/PublicFooter";

const MOE_RESTRICTED_ERROR = "This portal is restricted to Ministry officials.";

export default function MoeLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    });

    if (res?.error) {
      setLoading(false);
      // Do not reveal whether the email exists — show a generic message
      setError("Invalid credentials. Please check your email and password.");
      return;
    }

    // Verify the authenticated user has MOE_OFFICIAL role
    const session = await getSession();
    const userRole = (session?.user as any)?.role ?? "";
    const isPlatformAdmin = (session?.user as any)?.isPlatformAdmin ?? false;

    if (userRole !== "MOE_OFFICIAL" && !isPlatformAdmin) {
      // Sign the user out to prevent a dangling authenticated session
      await signOut({ redirect: false });
      setLoading(false);
      setError(MOE_RESTRICTED_ERROR);
      return;
    }

    router.push("/moe/dashboard");
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#020d1f]">
      {/* Deep navy radial background — distinct from school portal's emerald gradient */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#1e3a5f33,_transparent_60%),radial-gradient(ellipse_at_bottom,_#0f2d5533,_transparent_60%)]" />

      <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-blue-800/30 bg-[#0a1e3d]/80 p-8 shadow-2xl shadow-blue-950/60 backdrop-blur">

        {/* Ministry branding header */}
        <div className="flex flex-col items-center gap-3 text-center">
          {/* MOE crest placeholder */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-400/40 bg-blue-900/60 shadow-lg shadow-blue-900/40">
            <span className="text-sm font-black tracking-widest text-blue-200">MOE</span>
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-50">
              Ministry of Education
            </h1>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-blue-400">
              Republic of Liberia
            </p>
          </div>

          <div className="mt-1 border-t border-blue-800/40 pt-3 w-full">
            <p className="text-sm text-slate-300">
              Ministry of Education — National Education Platform
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Restricted access — authorised officials only
            </p>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-blue-300">
              Official Email
            </label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-blue-800/50 bg-blue-950/60 px-3 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              placeholder="official@moe.gov.lr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-blue-300">
              Password
            </label>
            <input
              required
              type="password"
              className="w-full rounded-lg border border-blue-800/50 bg-blue-950/60 px-3 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2.5 text-xs text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/50 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0a1e3d] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in to MOE Portal"}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-600">
          MOE accounts are provisioned by the Ministry ICT Directorate.
          <br />
          Contact your administrator if you do not have access.
        </div>
      </div>
      </div>
      <PublicFooter />
    </main>
  );
}
