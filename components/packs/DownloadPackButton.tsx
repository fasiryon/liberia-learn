"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  classId?: string;
  weekStart?: string;
  audience?: "student" | "teacher";
  compact?: boolean;
};

type Status = "idle" | "generating" | "ready" | "error";

export function DownloadPackButton({ classId, weekStart, audience, compact }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [packInfo, setPackInfo] = useState<{ url: string; lessonCount: number } | null>(null);

  async function handleDownload() {
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/packs/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, weekStart, audience }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate pack");
      }
      setPackInfo({ url: data.downloadUrl, lessonCount: data.lessonCount });
      setStatus("ready");
      // Trigger browser download
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = `lessons-pack-${weekStart ?? "this-week"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleDownload}
          disabled={status === "generating"}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text)] hover:border-[var(--ll-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "generating" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : status === "ready" ? (
            <CheckCircle2 className="h-3 w-3 text-[var(--ll-accent)]" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          {status === "generating"
            ? "Generating…"
            : status === "ready"
            ? "Downloaded"
            : "Week pack"}
        </button>
        {status === "error" && error && (
          <p className="text-[10px] text-[var(--ll-danger)]">{error}</p>
        )}
        {status === "ready" && packInfo && (
          <a
            href={packInfo.url}
            className="text-[10px] text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)] underline"
          >
            Download again ({packInfo.lessonCount} lessons)
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === "generating"}
        className="ll-command ll-focus justify-between disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
          {status === "generating" ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--ll-text-faint)]" strokeWidth={1.5} />
          ) : status === "ready" ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--ll-accent)]" strokeWidth={1.5} />
          ) : status === "error" ? (
            <AlertCircle className="h-4 w-4 text-[var(--ll-danger)]" strokeWidth={1.5} />
          ) : (
            <Download className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
          )}
          {status === "generating"
            ? "Generating pack…"
            : status === "ready"
            ? `Pack ready — ${packInfo?.lessonCount ?? 0} lessons`
            : status === "error"
            ? "Pack failed — retry"
            : "Download This Week's Pack"}
        </span>
      </button>
      {status === "error" && error && (
        <p className="rounded-lg bg-[var(--ll-danger)]/10 px-3 py-2 text-xs text-[var(--ll-danger)]">
          {error}
        </p>
      )}
      {status === "ready" && packInfo && (
        <a
          href={packInfo.url}
          className="text-center text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)] underline"
        >
          Click to re-download
        </a>
      )}
    </div>
  );
}
