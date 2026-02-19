"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ChecklistItem = {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  completedAt: string | null;
};

export default function PilotChecklistPage() {
  const router = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pilot-checklist", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setItems(data.checklist ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load checklist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(item: ChecklistItem) {
    setSavingId(item.id);
    try {
      const res = await fetch("/api/pilot-checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, completed: !item.completedAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to update checklist");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilot Checklist</h1>
        <p className="text-sm text-slate-400 mt-1">Complete the readiness checklist for your school.</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                </div>
                <button
                  onClick={() => toggle(item)}
                  disabled={savingId === item.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    item.completedAt ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {savingId === item.id ? "Saving..." : item.completedAt ? "Completed" : "Mark Complete"}
                </button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-400">No checklist items found.</p>}
          </div>
        )}
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </section>
    </div>
  );
}
