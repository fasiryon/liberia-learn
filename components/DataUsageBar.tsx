"use client";

import { useEffect, useState } from "react";

const LOW_DATA_KEY = "low_data_mode";

export function DataUsageBar() {
  const [usageBytes, setUsageBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(0);
  const [lowData, setLowData] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      setLowData(localStorage.getItem(LOW_DATA_KEY) === "true");
    }
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then(({ usage = 0, quota = 0 }) => {
        setUsageBytes(usage);
        setQuotaBytes(quota);
      })
      .catch(() => null);
  }, []);

  function toggleLowData() {
    const next = !lowData;
    setLowData(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOW_DATA_KEY, String(next));
    }
  }

  const usageMB = (usageBytes / 1024 / 1024).toFixed(1);
  const quotaMB = quotaBytes > 0 ? Math.round(quotaBytes / 1024 / 1024) : null;
  const pct = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
  const barColor = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-400" : "bg-emerald-500";

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

      {quotaBytes > 0 ? (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(pct, 100).toFixed(1)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--ll-text-muted)]">
            {usageMB} MB cached&nbsp;&nbsp;·&nbsp;&nbsp;{quotaMB} MB available
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--ll-text-muted)]">Storage estimate unavailable</p>
      )}

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
  );
}
