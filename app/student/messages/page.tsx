"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send, Trash2, Paperclip, X } from "lucide-react";

type MessageItem = {
  id: string;
  body: string;
  senderRole: string;
  fromUserId: string;
  createdAt: string;
  read: boolean;
  deletedBySender: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
};

type Thread = {
  threadKey: string;
  otherId: string;
  otherName: string;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
  nextCursor: string | null;
  messages: MessageItem[];
};

type Teacher = {
  teacherId: string;
  teacherName: string;
  subject: string | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-LR", { month: "short", day: "numeric" });
}

function AttachmentPreview({
  url,
  name,
  type,
}: {
  url: string;
  name: string | null;
  type: string | null;
}) {
  if (type?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img src={url} alt={name ?? "attachment"} className="max-w-[200px] rounded-lg border border-white/10 object-cover" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
    >
      <Paperclip className="h-3 w-3" strokeWidth={1.5} />
      {name ?? "Attachment"}
    </a>
  );
}

export default function StudentMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [confirmRetract, setConfirmRetract] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/student/messages", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setThreads(Array.isArray(data.threads) ? data.threads : []);
      const total = (data.threads as Thread[]).reduce((sum, t) => sum + t.unreadCount, 0);
      setUnreadTotal(total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
    fetch("/api/student/my-teachers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTeachers(d); })
      .catch(() => null);
  }, [loadThreads]);

  // 15s poll on active thread
  useEffect(() => {
    if (!activeThreadKey) return;
    const interval = setInterval(() => { loadThreads(); }, 15_000);
    return () => clearInterval(interval);
  }, [activeThreadKey, loadThreads]);

  const activeThread = threads.find((t) => t.threadKey === activeThreadKey) ?? threads[0] ?? null;

  useEffect(() => {
    if (!activeThread && threads[0]) setActiveThreadKey(threads[0].threadKey);
  }, [activeThread, threads]);

  const myUserId = activeThread?.messages.find((m) => m.senderRole === "STUDENT")?.fromUserId ?? null;

  async function loadEarlierMessages() {
    if (!activeThread?.nextCursor) return;
    setLoadingEarlier(true);
    try {
      const res = await fetch(
        `/api/student/messages?threadKey=${encodeURIComponent(activeThread.threadKey)}&before=${encodeURIComponent(activeThread.nextCursor)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      const older: MessageItem[] = Array.isArray(data.messages) ? data.messages : [];
      setThreads((prev) =>
        prev.map((t) =>
          t.threadKey === activeThread.threadKey
            ? { ...t, messages: [...older, ...t.messages], nextCursor: data.nextCursor ?? null }
            : t
        )
      );
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function handleAttachmentPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/messages/upload-attachment", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPendingAttachment({ url: data.url, name: data.name, type: data.type });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSend(teacherId?: string) {
    const toTeacher = teacherId ?? activeThread?.otherId;
    if (!toTeacher || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/student/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: toTeacher,
          body: draft.trim(),
          attachmentUrl: pendingAttachment?.url ?? null,
          attachmentName: pendingAttachment?.name ?? null,
          attachmentType: pendingAttachment?.type ?? null,
        }),
      });
      const data = await res.json();
      if (res.status === 429) { setError("Daily message limit reached. Try tomorrow."); return; }
      if (!res.ok) throw new Error(data.error ?? "Unable to send message");
      setDraft("");
      setPendingAttachment(null);
      setComposeOpen(false);
      await loadThreads();
      if (data.threadKey) setActiveThreadKey(data.threadKey);
    } catch (err: any) {
      setError(err?.message ?? "Unable to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleRetract(messageId: string) {
    try {
      const res = await fetch(`/api/student/messages/${messageId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to retract");
      }
      setConfirmRetract(null);
      await loadThreads();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-6 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-[var(--ll-yellow)] hover:opacity-80">
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-bold">
              Messages
              {unreadTotal > 0 && (
                <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
                  {unreadTotal}
                </span>
              )}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => { setComposeOpen(true); setDraft(""); setError(null); setPendingAttachment(null); }}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
            New Message
          </button>
        </div>

        {composeOpen && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New conversation</p>
              <button type="button" onClick={() => { setComposeOpen(false); setError(null); setPendingAttachment(null); }} className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text)]">Cancel</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ll-text-faint)] mb-1">To</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
              >
                <option value="">Select a teacher…</option>
                {teachers.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacherName}{t.subject ? ` — ${t.subject.replace(/_/g, " ")}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="Write your message…"
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2.5 text-sm text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)]/50"
              />
            </div>
            {pendingAttachment && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--ll-surface-muted)] px-3 py-2 text-xs">
                <Paperclip className="h-3 w-3 shrink-0 text-[var(--ll-text-faint)]" />
                <span className="truncate text-[var(--ll-text-muted)]">{pendingAttachment.name}</span>
                <button type="button" onClick={() => setPendingAttachment(null)} className="ml-auto text-[var(--ll-text-faint)] hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-muted)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)] disabled:opacity-50"
              >
                <Paperclip className="h-3 w-3" strokeWidth={1.5} />
                {uploadingAttachment ? "Uploading…" : "Attach"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAttachmentPick} />
              <button
                type="button"
                onClick={() => handleSend(selectedTeacherId)}
                disabled={sending || !selectedTeacherId || !draft.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--ll-surface)]" />)}</div>
            <div className="h-[420px] animate-pulse rounded-xl bg-[var(--ll-surface)]/50" />
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-10 text-center">
            <p className="text-sm text-[var(--ll-text-muted)]">No messages yet. Use New Message to contact your teacher.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
            <aside className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.threadKey}
                  type="button"
                  onClick={() => { setActiveThreadKey(thread.threadKey); setError(null); }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    activeThread?.threadKey === thread.threadKey
                      ? "border-emerald-500/40 bg-[var(--ll-yellow)]/10"
                      : "border-white/5 bg-[var(--ll-bg)]/40 hover:border-[var(--ll-border)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--ll-text)]">{thread.otherName}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {thread.unreadCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />}
                      <span className="text-[11px] text-[var(--ll-text-faint)]">
                        {thread.lastMessage ? timeAgo(thread.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                  </div>
                  {thread.lastMessage && (
                    <p className="mt-1 truncate text-xs text-[var(--ll-text-muted)]">{thread.lastMessage.body}</p>
                  )}
                  {thread.unreadCount > 0 && (
                    <span className="mt-1 inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      {thread.unreadCount} unread
                    </span>
                  )}
                </button>
              ))}
            </aside>

            <section className="flex min-h-[460px] flex-col rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70">
              <div className="border-b border-[var(--ll-border)] px-5 py-4">
                <h2 className="text-lg font-semibold">{activeThread?.otherName}</h2>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {activeThread?.nextCursor && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={loadEarlierMessages}
                      disabled={loadingEarlier}
                      className="rounded-full border border-[var(--ll-border)] px-4 py-1.5 text-xs text-[var(--ll-text-muted)] hover:border-[var(--ll-border)] hover:text-[var(--ll-text)] disabled:opacity-50"
                    >
                      {loadingEarlier ? "Loading…" : "Load earlier messages"}
                    </button>
                  </div>
                )}

                {activeThread?.messages.map((msg) => {
                  const mine = msg.senderRole === "STUDENT";
                  const isRetracted = msg.deletedBySender;
                  return (
                    <div key={msg.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                        isRetracted
                          ? "bg-[var(--ll-surface-muted)]/50 text-[var(--ll-text-faint)] italic"
                          : mine
                          ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                          : "bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]"
                      }`}>
                        <p className="text-[11px] opacity-70 mb-1">{timeAgo(msg.createdAt)}</p>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        {!isRetracted && msg.attachmentUrl && (
                          <AttachmentPreview url={msg.attachmentUrl} name={msg.attachmentName} type={msg.attachmentType} />
                        )}
                        {mine && !isRetracted && (
                          <p className="mt-1 text-[10px] opacity-60 text-right">{msg.read ? "✓✓" : "✓"}</p>
                        )}
                        {mine && !isRetracted && (
                          <button
                            type="button"
                            onClick={() => setConfirmRetract(msg.id)}
                            className="absolute -top-2 -right-2 hidden rounded-full bg-[var(--ll-surface)] border border-[var(--ll-border)] p-1 text-[var(--ll-text-faint)] hover:text-red-400 group-hover:flex"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[var(--ll-border)] px-5 py-4">
                {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
                {pendingAttachment && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-[var(--ll-surface-muted)] px-3 py-1.5 text-xs">
                    <Paperclip className="h-3 w-3 shrink-0 text-[var(--ll-text-faint)]" />
                    <span className="truncate text-[var(--ll-text-muted)]">{pendingAttachment.name}</span>
                    <button type="button" onClick={() => setPendingAttachment(null)} className="ml-auto text-[var(--ll-text-faint)] hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="self-end rounded-xl border border-[var(--ll-border)] p-2.5 text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] disabled:opacity-50"
                  >
                    <Paperclip className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAttachmentPick} />
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder="Write a reply…"
                    className="flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={sending || !draft.trim()}
                    className="self-end rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? "…" : <Send className="h-4 w-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Retract confirmation modal */}
        {confirmRetract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 space-y-4">
              <p className="text-sm font-semibold">Retract this message?</p>
              <p className="text-xs text-[var(--ll-text-muted)]">
                The message will be hidden from your view. Your teacher will see &ldquo;[Message retracted]&rdquo;.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmRetract(null)} className="flex-1 rounded-xl border border-[var(--ll-border)] py-2 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
                  Cancel
                </button>
                <button type="button" onClick={() => handleRetract(confirmRetract)} className="flex-1 rounded-xl bg-red-500/20 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/30">
                  Retract
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
