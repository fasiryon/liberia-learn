"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Megaphone, Pin, PlusCircle, Trash2, Eye, EyeOff } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  isPinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  author: { name: string | null };
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  STUDENTS: "Students",
  TEACHERS: "Teachers",
  GUARDIANS: "Guardians",
};

export default function AdminAnnouncementsPage() {
  const [tab, setTab] = useState<"published" | "drafts">("published");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/announcements?filter=${tab}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load announcements");
      setAnnouncements(data.announcements ?? []);
    } catch (err: any) {
      setError(err.message ?? "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tab]);

  async function create() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          isPinned,
          expiresAt: expiresAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create announcement");
      setTitle("");
      setBody("");
      setAudience("ALL");
      setIsPinned(false);
      setExpiresAt("");
      setShowForm(false);
      if (tab !== "published") setTab("published");
      else void load();
    } catch (err: any) {
      setError(err.message ?? "Failed to create announcement");
    } finally {
      setSaving(false);
    }
  }

  async function unpublish(id: string) {
    await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishedAt: null }),
    });
    void load();
  }

  async function deleteAnnouncement(id: string) {
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-[var(--ll-yellow)] hover:underline">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            Admin Dashboard
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-[var(--ll-yellow)]" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-[var(--ll-text)]">Announcements</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Post school-wide announcements visible to students, teachers, and guardians.
          </p>
        </div>

        <AdminNav />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(["published", "drafts"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  tab === t
                    ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)]"
                    : "border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:border-[var(--ll-border-strong)]"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" strokeWidth={1.5} />
            New Announcement
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4">
            <p className="text-sm font-semibold text-[var(--ll-text)]">Create Announcement</p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-xs text-[var(--ll-text-muted)]">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Term 2 begins Monday"
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--ll-text-muted)]">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Announcement details..."
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)] resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--ll-text-muted)]">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
                >
                  {Object.entries(AUDIENCE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--ll-text-muted)]">Expires (optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value ? `${e.target.value}T23:59:59.000Z` : "")}
                  className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm text-[var(--ll-text-muted)]">Pin to top</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={create}
                disabled={saving || !title.trim() || !body.trim()}
                className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Publishing..." : "Publish Now"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-[var(--ll-border)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface-muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && !showForm && <p className="text-sm text-red-400">{error}</p>}

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]/60" />
            ))
          ) : announcements.length === 0 ? (
            <div className="rounded-xl border border-[var(--ll-border)] p-8 text-center">
              <p className="text-sm text-[var(--ll-text-muted)]">No {tab} announcements yet.</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.isPinned && <Pin className="h-3.5 w-3.5 text-[var(--ll-yellow)]" strokeWidth={2} />}
                    <p className="text-sm font-semibold text-[var(--ll-text)]">{a.title}</p>
                    <span className="rounded-full bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--ll-text-faint)]">
                      {AUDIENCE_LABELS[a.audience] ?? a.audience}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ll-text-muted)] line-clamp-2">{a.body}</p>
                  <p className="mt-1 text-[10px] text-[var(--ll-text-faint)]">
                    {a.publishedAt
                      ? `Published ${new Date(a.publishedAt).toLocaleDateString()}`
                      : "Draft"}
                    {a.expiresAt ? ` · Expires ${new Date(a.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.publishedAt && (
                    <button
                      type="button"
                      onClick={() => void unpublish(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface-muted)]"
                      title="Unpublish"
                    >
                      <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteAnnouncement(a.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
