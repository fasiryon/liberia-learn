"use client";

import { useEffect, useState } from "react";

type Version = {
  id: string;
  bodyHtml: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  author: { id: string; name: string | null } | null;
};

interface VersionHistoryProps {
  lessonId: string;
  onRestore: (bodyHtml: string) => void;
}

export function VersionHistory({ lessonId, onRestore }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/teacher/lessons/${lessonId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => setError("Failed to load versions"))
      .finally(() => setLoading(false));
  }, [open, lessonId]);

  function wordCount(html: string) {
    return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  }

  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span>Version history</span>
        <span className="text-[var(--ll-text-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--ll-border)] px-4 pb-4 pt-3">
          {loading && <p className="text-xs text-[var(--ll-text-muted)]">Loading...</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {!loading && !error && versions.length === 0 && (
            <p className="text-xs text-[var(--ll-text-muted)]">No saved versions yet.</p>
          )}
          <ul className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-[var(--ll-border)] px-3 py-2"
              >
                <div className="text-xs">
                  <p className="font-medium">
                    {new Date(v.createdAt).toLocaleString()} — {v.author?.name ?? "Unknown"}
                  </p>
                  <p className="text-[var(--ll-text-muted)]">{wordCount(v.bodyHtml)} words</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(v.bodyHtml)}
                  className="ml-4 rounded-lg border border-[var(--ll-border)] px-3 py-1 text-xs hover:bg-[var(--ll-border)]"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
