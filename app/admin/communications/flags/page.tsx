"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Shield } from "lucide-react";

type FlagItem = {
  id: string;
  preview: string;
  senderRole: string;
  recipientRole: string;
  flagReason: string | null;
  flaggedAt: string | null;
  flagReviewedAt: string | null;
  flagResolution: string | null;
  createdAt: string;
};

type Filter = "pending" | "dismissed" | "actioned" | "all";

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-LR", { month: "short", day: "numeric" });
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesOpen, setNotesOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/messages/flags?filter=${filter}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load flags");
      const data = await res.json();
      setFlags(Array.isArray(data.flags) ? data.flags : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(id: string, resolution: "DISMISSED" | "ACTIONED") {
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, notes: notes[id] ?? "" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      await load();
      setNotesOpen(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActioning(null);
    }
  }

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
      active
        ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)] border border-[var(--ll-yellow)]/30"
        : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
    }`;

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/communications" className="text-xs text-[var(--ll-yellow)] hover:opacity-80">
            &larr; Back to Communications
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-red-400" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold">Flagged Messages</h1>
            {filter === "pending" && flags.length > 0 && (
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-bold text-red-400">
                {flags.length} pending
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[var(--ll-yellow)]/20 bg-[var(--ll-yellow)]/5 px-4 py-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ll-yellow)]" strokeWidth={1.5} />
          <p className="text-xs text-[var(--ll-text-muted)]">
            Message previews are limited to 80 characters. Full content is not accessible to administrators.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {(["pending", "dismissed", "actioned", "all"] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={tabClass(filter === f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : flags.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-10 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No {filter} flags.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-400">
                        {flag.senderRole}
                      </span>
                      <span className="text-[11px] text-[var(--ll-text-faint)]">→ {flag.recipientRole}</span>
                      <span className="text-[11px] text-[var(--ll-text-faint)]">flagged {timeAgo(flag.flaggedAt)}</span>
                      {flag.flagReason && (
                        <span className="text-[11px] text-amber-400">({flag.flagReason})</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--ll-text)]">&ldquo;{flag.preview}&rdquo;</p>
                    {flag.flagResolution && (
                      <p className="text-xs text-[var(--ll-text-faint)]">
                        Resolved: {flag.flagResolution} — {timeAgo(flag.flagReviewedAt)}
                      </p>
                    )}
                  </div>

                  {!flag.flagReviewedAt && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReview(flag.id, "DISMISSED")}
                        disabled={actioning === flag.id}
                        className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-muted)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)] disabled:opacity-50"
                      >
                        {actioning === flag.id ? "…" : "Dismiss"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotesOpen(notesOpen === flag.id ? null : flag.id)}
                        disabled={actioning === flag.id}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        Action Taken
                      </button>
                    </div>
                  )}
                </div>

                {notesOpen === flag.id && (
                  <div className="space-y-2 border-t border-[var(--ll-border)] pt-3">
                    <textarea
                      value={notes[flag.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [flag.id]: e.target.value }))}
                      rows={2}
                      placeholder="Notes on action taken (optional)…"
                      className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-xs text-[var(--ll-text)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleReview(flag.id, "ACTIONED")}
                      disabled={actioning === flag.id}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {actioning === flag.id ? "Saving…" : "Confirm Action Taken"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
