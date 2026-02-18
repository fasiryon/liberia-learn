"use client";

import { useEffect, useState } from "react";
import { getQueue, clearQueue } from "@/lib/offline-queue";

export default function SyncManager() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function doSync() {
    const queue = await getQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/student/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: queue }),
      });
      const data = await res.json();
      if (res.ok) {
        await clearQueue();
        setSyncResult(`${data.synced} lesson(s) synced`);
        setTimeout(() => setSyncResult(null), 5000);
      }
    } catch {
      // Will retry next time we're online
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    // Sync on mount if online
    if (navigator.onLine) doSync();

    // Sync when coming back online
    const handler = () => doSync();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!syncResult && !syncing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {syncing && (
        <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm text-amber-300">
          Syncing offline work...
        </div>
      )}
      {syncResult && (
        <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300">
          {syncResult}
        </div>
      )}
    </div>
  );
}
