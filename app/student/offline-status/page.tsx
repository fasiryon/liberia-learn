"use client";

import { useEffect, useState } from "react";

import { getQueue } from "@/lib/offline-queue";

export default function StudentOfflineStatusPage() {
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<Array<{ id: string; type?: string; status: string }>>([]);

  useEffect(() => {
    async function refresh() {
      setOnline(navigator.onLine);
      setItems(await getQueue());
    }

    refresh().catch(() => null);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">LiberiaLearn</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Offline Status</h1>
          <p className="mt-2 text-sm text-slate-400">{online ? "Online" : "Offline"}</p>
        </header>

        {items.length > 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-200">{items.length} items waiting to sync</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  {(item.type ?? "offline-item").replace(/-/g, " ")} - {item.status}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-200">
            All activity synced
          </section>
        )}
      </div>
    </main>
  );
}
