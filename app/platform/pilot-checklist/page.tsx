"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type School = { id: string; name: string; county: string | null };
type ChecklistItem = {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  completedAt: string | null;
};

export default function PlatformPilotChecklistPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSchools() {
    const res = await fetch("/api/platform/schools", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setSchools(data.schools ?? []);
  }

  async function loadChecklist(targetSchoolId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pilot-checklist?schoolId=${targetSchoolId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load checklist");
      setItems(data.checklist ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load checklist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchools();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(item: ChecklistItem) {
    if (!schoolId) return;
    setSavingId(item.id);
    try {
      const res = await fetch("/api/pilot-checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, itemId: item.id, completed: !item.completedAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      await loadChecklist(schoolId);
    } catch (err: any) {
      setError(err.message ?? "Failed to update checklist");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilot Checklist (Platform)</h1>
        <p className="text-sm text-slate-400 mt-1">Manage checklist completion across pilot schools.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Select School</label>
          <select
            value={schoolId}
            onChange={(e) => {
              const value = e.target.value;
              setSchoolId(value);
              if (value) loadChecklist(value);
            }}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Choose school...</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.county ? `(${s.county})` : ""}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading checklist...</p>
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
            {schoolId && items.length === 0 && (
              <p className="text-sm text-slate-400">No checklist items found.</p>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
