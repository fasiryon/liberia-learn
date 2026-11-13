"use client";

import { useEffect, useState } from "react";

import { getQueue } from "@/lib/offline-queue";
import { studentConflictMessage } from "@/lib/offline/conflictCopy";

type Item = { id: string; type?: string; entity?: string; status: string; conflict?: { resolutionHint?: string } | null };
const itemName = (item: Item) => (item.entity ?? item.type ?? "offline-item").replace(/-/g, " ");

export default function StudentOfflineStatusPage() {
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

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

  // Conflicts are kept, not retried: they are listed apart from work that is still waiting to sync.
  const conflicts = items.filter((item) => item.status === "conflict");
  const waiting = items.filter((item) => item.status !== "conflict");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ll-yellow)]">LiberiaLearn</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--ll-text)]">Offline Status</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{online ? "Online" : "Offline"}</p>
        </header>

        {conflicts.length > 0 && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6" data-offline-conflicts="">
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">Kept for your teacher</h2>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ll-text)]">
              {conflicts.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3" data-conflict-hint={item.conflict?.resolutionHint}>
                  <span className="font-semibold">{itemName(item)}</span>: {studentConflictMessage(item.conflict?.resolutionHint)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {waiting.length > 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <p className="text-sm text-[var(--ll-text)]">{waiting.length} items waiting to sync</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ll-text)]">
              {waiting.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3">
                  {itemName(item)} - {item.status}
                </li>
              ))}
            </ul>
          </section>
        ) : conflicts.length === 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 text-sm text-[var(--ll-text)]">
            All activity synced
          </section>
        ) : null}
      </div>
    </main>
  );
}
