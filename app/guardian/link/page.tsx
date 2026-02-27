"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "loading" | "success" | "error" | "auth";

export default function GuardianLinkPage() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing link token.");
      return;
    }

    setStatus("loading");
    fetch("/api/guardian/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          setStatus("auth");
          setMessage("Please sign in to link your student.");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data?.error ?? "Unable to link student.");
          return;
        }
        setStatus("success");
        setMessage("Student linked successfully.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

  const loginHref = token ? `/login?next=${encodeURIComponent(`/guardian/link?token=${token}`)}` : "/login";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-lg font-semibold">Link Student</h1>

        {status === "loading" && (
          <p className="text-sm text-slate-400">Linking your student...</p>
        )}

        {status === "success" && (
          <p className="text-sm text-emerald-300">{message}</p>
        )}

        {status === "auth" && (
          <div className="space-y-2">
            <p className="text-sm text-amber-300">{message}</p>
            <Link
              href={loginHref}
              className="inline-flex rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950"
            >
              Sign in
            </Link>
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-red-400">{message}</p>
        )}

        <Link href="/guardian" className="text-xs text-emerald-300 hover:text-emerald-200">
          Back to Guardian Dashboard
        </Link>
      </div>
    </main>
  );
}
