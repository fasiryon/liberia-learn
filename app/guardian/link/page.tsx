"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function GuardianLinkPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setToken(params.get("token"));
    }
  }, []);

  const handleLink = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/guardian/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.status === 401 || res.status === 403) {
        const next = token ? `/guardian/link?token=${encodeURIComponent(token)}` : "/guardian/link";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Link failed");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4">
        <p className="text-sm text-red-400">
          Missing link token.{" "}
          <Link href="/login" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 shadow-none backdrop-blur">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[var(--ll-text)]">
            Link Student
          </h1>
          <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
            Confirm to link this student to your guardian account.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[var(--ll-yellow)]">
              Student linked successfully.
            </p>
            <Link
              href="/guardian"
              className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
            >
              Go to guardian dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={handleLink} className="space-y-4 text-sm">
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
              {loading ? "Linking..." : "Link Student"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
