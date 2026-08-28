"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getOfflineStorageSnapshot,
  storageUsagePercent,
  type OfflineStorageSnapshot,
} from "@/lib/offline/storageManagement";

const LOW_DATA_KEY = "low_data_mode";

export function DataUsageBar() {
  const [snapshot, setSnapshot] = useState<OfflineStorageSnapshot | null>(null);
  const [lowData, setLowData] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      setLowData(localStorage.getItem(LOW_DATA_KEY) === "true");
    }
    getOfflineStorageSnapshot().then(setSnapshot).catch(() => setSnapshot(null));
  }, []);

  function toggleLowData() {
    const next = !lowData;
    setLowData(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOW_DATA_KEY, String(next));
    }
  }

  const usageBytes = snapshot?.estimate.usageBytes ?? null;
  const quotaBytes = snapshot?.estimate.quotaBytes ?? null;
  const usageMB = usageBytes == null ? null : (usageBytes / 1024 / 1024).toFixed(1);
  const quotaMB = quotaBytes != null && quotaBytes > 0 ? Math.round(quotaBytes / 1024 / 1024) : null;
  const pct = snapshot ? storageUsagePercent(snapshot.estimate) : null;
  const barColor = pct != null && pct > 80 ? "bg-red-500" : pct != null && pct > 50 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-3 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">
          Offline Storage
        </p>
        {lowData ? (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            Low Data Mode ON
          </span>
        ) : null}
      </div>

      {pct != null && usageMB != null && quotaMB != null ? (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct.toFixed(1)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--ll-text-muted)]">
            {usageMB} MB used · {quotaMB} MB quota ({pct.toFixed(0)}%)
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--ll-text-muted)]">
          {snapshot?.estimate.supported === false ? "Storage estimate unavailable in this browser" : "Checking storage…"}
        </p>
      )}

      {snapshot ? (
        <div className="space-y-1 text-xs text-[var(--ll-text-muted)]">
          <p>
            {snapshot.downloadedLessons.length} downloaded lesson{snapshot.downloadedLessons.length === 1 ? "" : "s"} · {(snapshot.downloadedContentBytes / 1024 / 1024).toFixed(1)} MB content
          </p>
          {snapshot.unsyncedWorkCount > 0 ? (
            <p className="font-medium text-amber-400">
              {snapshot.unsyncedWorkCount} unsynced item{snapshot.unsyncedWorkCount === 1 ? "" : "s"} are protected from cleanup.
            </p>
          ) : null}
          {pct != null && pct >= 80 ? (
            <p className="font-medium text-red-400">Storage is almost full. Remove downloaded lessons to free space.</p>
          ) : null}
          {snapshot.storageError ? (
            <p className="font-medium text-amber-400">Some local storage details are unavailable; saved learner work is retained.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/student/offline-lessons" className="inline-flex text-xs font-semibold text-[var(--ll-yellow)] underline-offset-2 hover:underline">
          Manage offline content
        </Link>
        <button
          type="button"
          onClick={toggleLowData}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text)]"
        >
          <span
            className={`inline-block h-3 w-3 rounded-full border transition-colors ${
              lowData ? "border-amber-400 bg-amber-400" : "border-[var(--ll-border)] bg-[var(--ll-surface)]"
            }`}
          />
          {lowData ? "Disable Low Data Mode" : "Enable Low Data Mode"}
        </button>
      </div>
    </div>
  );
}
