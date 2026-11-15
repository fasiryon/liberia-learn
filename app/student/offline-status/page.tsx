"use client";

import { useEffect, useState } from "react";

import { getQueue, retryFailedOperations, subscribeToQueueChanges } from "@/lib/offline-queue";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
import { studentConflictMessage } from "@/lib/offline/conflictCopy";

type Item = { id: string; type?: string; entity?: string; status: string; conflict?: { resolutionHint?: string } | null };
const itemName = (item: Item) => (item.entity ?? item.type ?? "offline-item").replace(/-/g, " ");

export default function StudentOfflineStatusPage() {
  const [online, setOnline] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const queue = await getQueue();
      if (!active) return;
      setOnline(navigator.onLine);
      setItems(queue);
      setLoaded(true);
    }

    const update = () => { if (active) void refresh().catch(() => null); };
    update();
    const unsubscribe = subscribeToQueueChanges(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Conflicts are kept, not retried: they are listed apart from work that is still waiting to sync.
  const conflicts = items.filter((item) => item.status === "conflict");
  const failed = items.filter((item) => item.status === "failed");
  const waiting = items.filter((item) => item.status !== "conflict" && item.status !== "failed");

  async function retry(id: string) {
    setRetrying(id);
    setRetryError(null);
    try {
      await retryFailedOperations([id]);
      if (navigator.onLine) await flushSubmissionQueue();
      setItems(await getQueue());
    } catch {
      setRetryError("Could not sync. Your work is still saved on this device.");
    } finally {
      setRetrying(null);
    }
  }

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

        {failed.length > 0 && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6" aria-label="Not synced">
            <h2 className="text-sm font-semibold">Not synced</h2>
            <p className="mt-2 text-sm">Could not sync. Your work is still saved on this device.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {failed.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--ll-border)] px-4 py-3">
                  {itemName(item)} - Failed to sync. Saved on this device.{" "}
                  <button type="button" className="underline font-semibold" disabled={retrying !== null} onClick={() => { void retry(item.id); }}>
                    {retrying === item.id ? "Trying again…" : "Try again"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {retryError && <p role="alert">{retryError}</p>}

        {!loaded && <p role="status">Checking saved work…</p>}
        {waiting.length > 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-sm font-semibold">Waiting to sync</h2>
            <p className="mt-2 text-sm">{waiting.length} item{waiting.length === 1 ? "" : "s"}. Saved on this device.</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--ll-text)]">
              {waiting.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3">
                  {itemName(item)} - {item.status}
                </li>
              ))}
            </ul>
          </section>
        ) : loaded && conflicts.length === 0 && failed.length === 0 ? (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 text-sm text-[var(--ll-text)]">
            All activity synced
          </section>
        ) : null}
      </div>
    </main>
  );
}
