"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, Eye, EyeOff, Trash2, Pencil, X, Check } from "lucide-react";

type SchoolEvent = {
  id: string;
  title: string;
  type: string;
  eventDate: string;
  endDate: string | null;
  description: string | null;
  visibility: string;
  sendPush: boolean;
  sendSms: boolean;
  published: boolean;
  createdAt: string;
};

const EVENT_TYPES = ["EXAM", "HOLIDAY", "MEETING", "TRIP", "ANNOUNCEMENT"];
const VISIBILITY_OPTIONS = ["ALL", "TEACHERS", "STUDENTS", "GUARDIANS"];
const TYPE_COLORS: Record<string, string> = {
  EXAM:         "bg-red-500/15 text-red-400 border-red-500/20",
  HOLIDAY:      "bg-green-500/15 text-green-400 border-green-500/20",
  MEETING:      "bg-amber-500/15 text-amber-400 border-amber-500/20",
  TRIP:         "bg-blue-500/15 text-blue-400 border-blue-500/20",
  ANNOUNCEMENT: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

type FilterTab = "ALL" | "EXAM" | "HOLIDAY" | "MEETING" | "ANNOUNCEMENT";

type FormState = {
  title: string;
  type: string;
  eventDate: string;
  endDate: string;
  description: string;
  visibility: string;
  sendPush: boolean;
  sendSms: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  type: "EXAM",
  eventDate: "",
  endDate: "",
  description: "",
  visibility: "ALL",
  sendPush: true,
  sendSms: false,
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "ALL" ? events : events.filter((e) => e.type === filter);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(event: SchoolEvent) {
    setEditId(event.id);
    setForm({
      title: event.title,
      type: event.type,
      eventDate: event.eventDate.slice(0, 10),
      endDate: event.endDate ? event.endDate.slice(0, 10) : "",
      description: event.description ?? "",
      visibility: event.visibility,
      sendPush: event.sendPush,
      sendSms: event.sendSms,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSave(publishNow: boolean) {
    if (!form.title || !form.eventDate) {
      setError("Title and date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, publishNow };
      let res: Response;
      if (editId) {
        res = await fetch(`/api/admin/events/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
        return;
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setError("Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(event: SchoolEvent) {
    try {
      await fetch(`/api/admin/events/${event.id}/publish`, { method: "PATCH" });
      await load();
    } catch { /* silent */ }
  }

  async function handleDelete(event: SchoolEvent) {
    if (!confirm(`Delete "${event.title}"?`)) return;
    try {
      await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
      await load();
    } catch { /* silent */ }
  }

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6 px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-[var(--ll-accent)]" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-[var(--ll-text)]">School Events</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New Event
          </button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--ll-text)]">{editId ? "Edit Event" : "New Event"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--ll-text-muted)] mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Event title"
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ll-text-muted)] mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
                >
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ll-text-muted)] mb-1">Visibility</label>
                <select
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
                >
                  {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ll-text-muted)] mb-1">Event Date *</label>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ll-text-muted)] mb-1">End Date (optional)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--ll-text-muted)] mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Event details…"
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--ll-text)]">
                  <input
                    type="checkbox"
                    checked={form.sendPush}
                    onChange={(e) => setForm({ ...form, sendPush: e.target.checked })}
                    className="h-4 w-4 accent-[var(--ll-accent)]"
                  />
                  Send Push Notification
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--ll-text)]">
                  <input
                    type="checkbox"
                    checked={form.sendSms}
                    onChange={(e) => setForm({ ...form, sendSms: e.target.checked })}
                    className="h-4 w-4 accent-[var(--ll-accent)]"
                  />
                  Send SMS Reminder
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(false)}
                className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
              >
                <Check className="h-4 w-4" strokeWidth={2} />
                Publish
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["ALL", "EXAM", "HOLIDAY", "MEETING", "ANNOUNCEMENT"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                filter === tab
                  ? "border-[var(--ll-accent)] bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]"
                  : "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-muted)]"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--ll-text-muted)]">Loading events…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--ll-text-muted)]">No events yet. Click &ldquo;New Event&rdquo; to add one.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)]">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--ll-border)] bg-[var(--ll-surface-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--ll-text-faint)]">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--ll-text-faint)]">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--ll-text-faint)]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--ll-text-faint)]">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--ll-text-faint)]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--ll-text-faint)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ll-border)]">
                {filtered.map((event) => (
                  <tr key={event.id} className="hover:bg-[var(--ll-surface-muted)]/50">
                    <td className="px-4 py-3 font-semibold text-[var(--ll-text)]">{event.title}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TYPE_COLORS[event.type] ?? "bg-gray-500/15 text-gray-400 border-gray-500/20"}`}>
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">
                      {new Date(event.eventDate).toLocaleDateString("en-LR", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">{event.visibility}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${event.published ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"}`}>
                        {event.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(event)}
                          className="text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(event)}
                          className="text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                          title={event.published ? "Unpublish" : "Publish"}
                        >
                          {event.published ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(event)}
                          className="text-red-400 hover:text-red-300"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
