"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { DownloadPackButton } from "@/components/packs/DownloadPackButton";

type Pack = {
  id: string;
  weekStart: string;
  weekEnd: string;
  audience: string;
  status: string;
  blobUrl: string | null;
  sizeBytes: number | null;
  lessonCount: number | null;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  expiresAt: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function weekLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("en-LR", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-LR", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function TeacherPacksPage() {
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
    <div className="ll-dashboard-shell px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/teacher/dashboard" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
              &larr; Dashboard
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-[var(--ll-text)]">Offline Lesson Packs</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Download a week of lessons + audio as a zip file for offline classroom use.
            </p>
          </div>
          <DownloadPackButton audience="teacher" />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--ll-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pack history…
          </div>
        ) : packs.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-6 py-8 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No packs generated yet. Click &ldquo;Download This Week&apos;s Pack&rdquo; above to create your first pack.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--ll-text)]">
                    {weekLabel(pack.weekStart, pack.weekEnd)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ll-text-faint)]">
                    {pack.audience} pack · {pack.lessonCount ?? "?"} lessons
                    {pack.sizeBytes ? ` · ${formatBytes(pack.sizeBytes)}` : ""}
                    {pack.expiresAt ? ` · expires ${new Date(pack.expiresAt).toLocaleDateString("en-LR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {pack.status === "ready" && pack.blobUrl ? (
                    <a
                      href={pack.blobUrl}
                      download
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  ) : pack.status === "failed" ? (
                    <span className="flex items-center gap-1.5 text-xs text-[var(--ll-danger)]">
                      <AlertCircle className="h-3 w-3" />
                      {pack.failureReason ?? "Failed"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-[var(--ll-text-muted)]">
                      <CheckCircle2 className="h-3 w-3 text-[var(--ll-accent)]" />
                      {pack.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
