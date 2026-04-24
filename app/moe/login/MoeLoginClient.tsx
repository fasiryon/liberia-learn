"use client";

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
      setError("Invalid credentials. Please check your email and password.");
      return;
    }

    const session = await getSession();
    const userRole = (session?.user as any)?.role ?? "";
    const isPlatformAdmin = (session?.user as any)?.isPlatformAdmin ?? false;

    if (userRole !== "MOE_OFFICIAL" && !isPlatformAdmin) {
      await signOut({ redirect: false });
      setLoading(false);
      setError(MOE_RESTRICTED_ERROR);
      return;
    }

    router.push("/moe/dashboard");
  };

  return (
    <main className="flex min-h-screen flex-col bg-[var(--ll-bg)]">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 rounded-xl border border-[var(--ll-silver)]/30 bg-[var(--ll-surface)]/80 p-8 shadow-none backdrop-blur">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--ll-silver)]/40 bg-[var(--ll-silver-soft)] shadow-none">
              <span className="text-sm font-black tracking-widest text-[var(--ll-silver)]">MOE</span>
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--ll-text)]">
                Ministry of Education
              </h1>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-[var(--ll-silver)]">
                Republic of Liberia
              </p>
            </div>

            <div className="mt-1 w-full border-t border-[var(--ll-silver)]/30 pt-3">
              <p className="text-sm text-[var(--ll-text)]">
                Ministry of Education - National Education Platform
              </p>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                Restricted access - authorised officials only
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--ll-silver)]">
                Official Email
              </label>
              <input
                required
                type="email"
                className="w-full rounded-lg border border-[var(--ll-silver)]/40 bg-[var(--ll-silver-soft)] px-3 py-2.5 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-[var(--ll-silver)] focus:ring-1 focus:ring-[var(--ll-silver)]/50"
                placeholder="official@moe.gov.lr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--ll-silver)]">
                Password
              </label>
              <input
                required
                type="password"
                className="w-full rounded-lg border border-[var(--ll-silver)]/40 bg-[var(--ll-silver-soft)] px-3 py-2.5 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-[var(--ll-silver)] focus:ring-1 focus:ring-[var(--ll-silver)]/50"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-[var(--ll-danger)]/30 bg-[var(--ll-danger)]/10 px-3 py-2.5 text-xs text-[var(--ll-danger)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-[var(--ll-silver-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text)] shadow-none hover:bg-[var(--ll-silver-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--ll-silver)] focus:ring-offset-2 focus:ring-offset-[var(--ll-surface)] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in to MOE Portal"}
            </button>
          </form>

          <div className="text-center text-[11px] text-[var(--ll-text-faint)]">
            MOE accounts are provisioned by the Ministry ICT Directorate.
            <br />
            Contact your administrator if you do not have access.
          </div>

          <div className="text-center">
            <a href="/" className="text-xs text-[var(--ll-silver)] hover:opacity-80">
              &#8592; Back to LiberiaLearn
            </a>
          </div>
        </div>
      </div>
      <PublicFooter />
    </main>
  );
}
