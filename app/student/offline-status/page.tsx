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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ll-yellow)]">LiberiaLearn</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--ll-text)]">Offline Status</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{online ? "Online" : "Offline"}</p>
        </header>

        {items.length > 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <p className="text-sm text-[var(--ll-text)]">{items.length} items waiting to sync</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ll-text)]">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3">
                  {(item.type ?? "offline-item").replace(/-/g, " ")} - {item.status}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 text-sm text-[var(--ll-text)]">
            All activity synced
          </section>
        )}
      </div>
    </main>
  );
}
