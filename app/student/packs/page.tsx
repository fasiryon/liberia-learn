"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { DownloadPackButton } from "@/components/packs/DownloadPackButton";

type Pack = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  blobUrl: string | null;
  sizeBytes: number | null;
  lessonCount: number | null;
  createdAt: string;
  failureReason: string | null;
  expiresAt: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function weekLabel(start: string) {
  const s = new Date(start);
  return `Week of ${s.toLocaleDateString("en-LR", { month: "long", day: "numeric", year: "numeric" })}`;
}

export default function StudentPacksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/packs/history", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPacks(d.packs ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <Link href="/student/today" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
            &larr; Today
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[var(--ll-text)]">My Offline Packs</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Download this week&apos;s lessons for offline use &mdash; works without internet at school.
          </p>
        </div>

        <DownloadPackButton audience="student" />

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--ll-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : packs.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">
            No packs yet. Tap the button above to generate your first pack.
          </p>
        ) : (
          <div className="space-y-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--ll-text)]">{weekLabel(pack.weekStart)}</p>
                  <p className="mt-0.5 text-xs text-[var(--ll-text-faint)]">
                    {pack.lessonCount ?? "?"} lessons
                    {pack.sizeBytes ? ` · ${formatBytes(pack.sizeBytes)}` : ""}
                  </p>
                </div>
                {pack.status === "ready" && pack.blobUrl ? (
                  <a
                    href={pack.blobUrl}
                    download
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text)]"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                ) : pack.status === "failed" ? (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--ll-danger)]">
                    <AlertCircle className="h-3 w-3" />
                    Failed
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
