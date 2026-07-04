"use client";

// Phase 4A — Admin content media review interface (/admin/content-media).
// Grid of lessons with generated/curated images, filters, per-lesson regenerate
// + manual upload, and bulk regenerate by subject. Admin-only.

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";

type MediaItem = {
  contentId: string;
  title: string | null;
  subject: string;
  grade: number;
  category: string;
  status: string;
  cost: number;
  inlineCount: number;
  heroPreview: string | null;
  heroMeta: { provider?: string; credit?: string; license?: string } | null;
};

const CATEGORIES = ["", "VISUAL", "PHOTO", "ABSTRACT", "FAILED"];
const BANDS = ["", "K-3", "4-8", "9-12"];
const SUBJECTS = [
  "", "MATH", "SCIENCE", "BIOLOGY", "CHEMISTRY", "PHYSICS", "SOCIAL_STUDIES",
  "GEOGRAPHY", "HISTORY", "CIVICS", "ECONOMICS", "LITERACY", "ENGLISH",
  "COMPUTER_SCIENCE", "ENGINEERING_FOUNDATIONS",
];

const STATUS_COLOR: Record<string, string> = {
  GENERATED: "text-emerald-400 border-emerald-500/40",
  CURATED: "text-sky-400 border-sky-500/40",
  SKIPPED: "text-[var(--ll-text-muted)] border-[var(--ll-border)]",
  FAILED: "text-red-400 border-red-500/40",
  PENDING: "text-amber-400 border-amber-500/40",
};

export default function ContentMediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [band, setBand] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkSubject, setBulkSubject] = useState("SCIENCE");
  const [bulkLimit, setBulkLimit] = useState(10);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (band) qs.set("band", band);
    if (subject) qs.set("subject", subject);
    qs.set("page", String(page));
    const res = await fetch(`/api/admin/content-media?${qs}`);
    const data = await res.json();
    if (res.ok) {
      setItems(data.items);
      setStatusCounts(data.statusCounts ?? {});
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [category, band, subject, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function regenerate(contentId: string) {
    setActing(contentId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/content-media/${contentId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Regenerate failed");
      setMessage(`Regenerated ${contentId}: ${data.status} (${data.category}${data.provider ? ", " + data.provider : ""})`);
      await load();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setActing(null);
    }
  }

  async function uploadReplacement(contentId: string, file: File) {
    setActing(contentId);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/content-media/${contentId}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      setMessage(`Uploaded replacement for ${contentId}`);
      await load();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setActing(null);
    }
  }

  async function bulkRegenerate() {
    setActing("__bulk__");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/content-media/bulk-regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: bulkSubject, limit: bulkLimit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Bulk regenerate failed");
      setMessage(
        `Bulk ${data.subject}: processed ${data.processed} → ${data.generated} generated, ${data.curated} curated, ${data.skipped} skipped, ${data.failed} failed ($${data.cost})`
      );
      await load();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-shell mx-auto max-w-6xl">
        <AdminNav />
        <h1 className="mt-6 text-2xl font-semibold">Content Media Review</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Hero and inline illustrations across the approved lesson corpus. {total.toLocaleString()} lessons match filters.
        </p>

        {/* Status summary */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(statusCounts).map(([s, n]) => (
            <span key={s} className={`rounded-full border px-3 py-1 ${STATUS_COLOR[s] ?? "border-[var(--ll-border)]"}`}>
              {s}: {n.toLocaleString()}
            </span>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block text-[var(--ll-text-muted)]">Category</span>
            <select value={category} onChange={(e) => { setPage(0); setCategory(e.target.value); }} className="mt-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1.5">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c || "All"}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-[var(--ll-text-muted)]">Grade band</span>
            <select value={band} onChange={(e) => { setPage(0); setBand(e.target.value); }} className="mt-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1.5">
              {BANDS.map((b) => <option key={b} value={b}>{b || "All"}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-[var(--ll-text-muted)]">Subject</span>
            <select value={subject} onChange={(e) => { setPage(0); setSubject(e.target.value); }} className="mt-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1.5">
              {SUBJECTS.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
            </select>
          </label>

          {/* Bulk */}
          <div className="ml-auto flex items-end gap-2 rounded-lg border border-[var(--ll-border)] p-2">
            <label className="text-xs">
              <span className="block text-[var(--ll-text-muted)]">Bulk subject</span>
              <select value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} className="mt-1 rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1.5">
                {SUBJECTS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span className="block text-[var(--ll-text-muted)]">Limit</span>
              <input type="number" min={1} max={25} value={bulkLimit} onChange={(e) => setBulkLimit(Number(e.target.value))} className="mt-1 w-16 rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1.5" />
            </label>
            <button onClick={bulkRegenerate} disabled={acting === "__bulk__"} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-50">
              {acting === "__bulk__" ? "Running…" : "Bulk regenerate"}
            </button>
          </div>
        </div>

        {message ? <p className="mt-3 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-3 py-2 text-xs">{message}</p> : null}

        {/* Grid */}
        {loading ? (
          <p className="mt-8 text-sm text-[var(--ll-text-muted)]">Loading…</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.contentId} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3">
                <div className="aspect-[16/9] overflow-hidden rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]">
                  {item.heroPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.heroPreview} alt={item.title ?? item.contentId} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--ll-text-muted)]">
                      {item.category === "ABSTRACT" ? "No media (abstract)" : "No image"}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--ll-text-muted)]">{item.subject} · G{item.grade} · {item.category}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_COLOR[item.status] ?? "border-[var(--ll-border)]"}`}>{item.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium">{item.title ?? item.contentId}</p>
                {item.heroMeta?.credit ? (
                  <p className="mt-0.5 text-[10px] text-[var(--ll-text-muted)]">by {item.heroMeta.credit} · {item.heroMeta.provider}</p>
                ) : null}
                {item.inlineCount > 0 ? <p className="text-[10px] text-[var(--ll-text-muted)]">{item.inlineCount} inline</p> : null}

                <div className="mt-3 flex gap-2">
                  <button onClick={() => regenerate(item.contentId)} disabled={acting === item.contentId} className="flex-1 rounded-lg border border-[var(--ll-border)] px-2 py-1.5 text-xs font-semibold hover:bg-[var(--ll-bg)] disabled:opacity-50">
                    {acting === item.contentId ? "…" : "Regenerate"}
                  </button>
                  <button onClick={() => fileRefs.current[item.contentId]?.click()} disabled={acting === item.contentId} className="flex-1 rounded-lg border border-[var(--ll-border)] px-2 py-1.5 text-xs font-semibold hover:bg-[var(--ll-bg)] disabled:opacity-50">
                    Upload
                  </button>
                  <input
                    ref={(el) => { fileRefs.current[item.contentId] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadReplacement(item.contentId, f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 disabled:opacity-40">Prev</button>
          <span className="text-[var(--ll-text-muted)]">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
