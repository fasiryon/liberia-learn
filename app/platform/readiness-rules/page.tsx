"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Rule = {
  name: string;
  max: number;
  definition: string;
};

export default function ReadinessRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform/readiness-rules", { cache: "no-store" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setRules(data.rules ?? []);
      })
      .catch((err) => setError(err.message ?? "Failed to load rules"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilot Readiness Rules</h1>
        <p className="text-sm text-slate-400 mt-1">Transparency view of scoring components and weights.</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="space-y-4">
            {rules.map((r) => (
              <div key={r.name} className="border-b border-slate-800/60 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">{r.name}</p>
                  <span className="text-xs text-slate-400">Max {r.max} pts</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{r.definition}</p>
              </div>
            ))}
            {rules.length === 0 && <p className="text-sm text-slate-400">No rules found.</p>}
          </div>
        )}
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </section>
    </div>
  );
}
