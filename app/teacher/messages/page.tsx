"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Send, ChevronLeft } from "lucide-react";
import { MessagingCenter } from "@/components/messaging/MessagingCenter";

type StudentThread = {
  threadKey: string;
  otherId: string;
  otherName: string;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
  nextCursor: string | null;
  messages: Array<{
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
  }>;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-LR", { month: "short", day: "numeric" });
}

function StudentMessagesTab() {
  const [threads, setThreads] = useState<StudentThread[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/messages/student-threads", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list: StudentThread[] = Array.isArray(data.threads) ? data.threads : [];
      setThreads(list);
      setUnreadCount(list.reduce((sum, t) => sum + t.unreadCount, 0));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const activeThread = threads.find((t) => t.threadKey === activeKey) ?? threads[0] ?? null;
  useEffect(() => {
    if (!activeThread && threads[0]) setActiveKey(threads[0].threadKey);
  }, [activeThread, threads]);

  // 15s poll on active thread
  useEffect(() => {
    if (!activeKey) return;
    const interval = setInterval(() => { loadThreads(); }, 15_000);
    return () => clearInterval(interval);
  }, [activeKey, loadThreads]);

  async function handleReply() {
    if (!activeThread || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadKey: activeThread.threadKey,
          body: draft.trim(),
          recipientId: activeThread.otherId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to send reply");
      setDraft("");
      await loadThreads();
    } catch (err: any) {
      setError(err?.message ?? "Unable to send reply");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-[var(--ll-surface)]" />;

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-10 text-center">
        <p className="text-sm text-[var(--ll-text-muted)]">No student messages yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
      <aside className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 space-y-2">
        {threads.map((thread) => (
          <button
            key={thread.threadKey}
            type="button"
            onClick={() => { setActiveKey(thread.threadKey); setError(null); }}
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
          {activeThread?.messages.map((msg) => {
            const mine = msg.senderRole === "TEACHER";
            const isRetracted = msg.deletedBySender;
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  isRetracted
                    ? "bg-[var(--ll-surface-muted)]/50 text-[var(--ll-text-faint)] italic"
                    : mine
                    ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                    : "bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]"
                }`}>
                  <p className="text-[11px] opacity-70 mb-1">{timeAgo(msg.createdAt)}</p>
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  {!isRetracted && msg.attachmentUrl && msg.attachmentType?.startsWith("image/") && (
                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                      <img src={msg.attachmentUrl} alt={msg.attachmentName ?? "attachment"} className="max-w-[200px] rounded-lg border border-white/10 object-cover" />
                    </a>
                  )}
                  {!isRetracted && msg.attachmentUrl && !msg.attachmentType?.startsWith("image/") && (
                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs opacity-80 hover:opacity-100">
                      📎 {msg.attachmentName ?? "Attachment"}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-[var(--ll-border)] px-5 py-4">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              className="flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={sending || !draft.trim()}
              className="self-end rounded-xl bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "…" : <Send className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function TeacherMessagesPage() {
  const [tab, setTab] = useState<"guardian" | "student">("guardian");
  const [studentUnread, setStudentUnread] = useState(0);

  useEffect(() => {
    fetch("/api/teacher/messages/student-threads", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.threads) {
          setStudentUnread((d.threads as StudentThread[]).reduce((sum: number, t) => sum + t.unreadCount, 0));
        }
      })
      .catch(() => null);
  }, []);

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      active
        ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)] border border-[var(--ll-yellow)]/30"
        : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
    }`;

  return (
    <main className="ll-dashboard-shell px-4 py-5 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Messages</h1>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--ll-border)] pb-3">
          <button type="button" onClick={() => setTab("guardian")} className={tabClass(tab === "guardian")}>
            Guardian Messages
          </button>
          <button type="button" onClick={() => setTab("student")} className={tabClass(tab === "student")}>
            Student Messages
            {studentUnread > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {studentUnread}
              </span>
            )}
          </button>
        </div>

        {tab === "guardian" ? (
          <MessagingCenter role="teacher" emptyState="No guardian messages yet." />
        ) : (
          <StudentMessagesTab />
        )}
      </div>
    </main>
  );
}
