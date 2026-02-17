"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminSeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; logs: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSeed() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/seed-demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
          &larr; Back to Admin Console
        </Link>

        <h1 className="text-2xl font-bold">Seed Demo Data</h1>
        <p className="text-sm text-slate-400">
          Creates a class, enrolls students, and adds sample homework for your school.
          This is idempotent -- re-running will not duplicate data.
        </p>

        <button
          onClick={handleSeed}
          disabled={loading}
          className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-blue-400 disabled:opacity-50"
        >
          {loading ? "Seeding..." : "Create Demo Class + Seed Data"}
        </button>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2">
            <h2 className="text-lg font-semibold text-emerald-300">Seed Complete</h2>
            <ul className="space-y-1 text-sm text-slate-300">
              {result.logs.map((log, i) => (
                <li key={i} className="font-mono text-xs">{log}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
