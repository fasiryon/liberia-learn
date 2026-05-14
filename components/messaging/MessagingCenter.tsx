"use client";

import { useEffect, useMemo, useState } from "react";

type MessageRole = "guardian" | "teacher";

type MessageRecord = {
  messageId: string;
  guardianId: string;
  teacherId: string;
  studentId: string;
  guardianName: string;
  teacherName: string;
  studentName: string;
  subject: string | null;
  fromRole: MessageRole;
  fromName: string;
  body: string;
  sentAt: string;
  read: boolean;
};

type MessagingCenterProps = {
  role: MessageRole;
  emptyState: string;
};

type ThreadRecord = {
  id: string;
  guardianId: string;
  teacherId: string;
  studentId: string;
  guardianName: string;
  teacherName: string;
  studentName: string;
  subject: string | null;
  messages: MessageRecord[];
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-LR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildThreads(messages: MessageRecord[]) {
  const grouped = new Map<string, ThreadRecord>();

  for (const message of messages) {
    const key = `${message.teacherId}:${message.guardianId}:${message.studentId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.messages.push(message);
      continue;
    }

    grouped.set(key, {
      id: key,
      guardianId: message.guardianId,
      teacherId: message.teacherId,
      studentId: message.studentId,
      guardianName: message.guardianName,
      teacherName: message.teacherName,
      studentName: message.studentName,
      subject: message.subject,
      messages: [message],
    });
  }

  return Array.from(grouped.values())
    .map((thread) => ({
      ...thread,
      messages: thread.messages.sort(
        (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
      ),
    }))
    .sort((left, right) => {
      const leftTime = left.messages[left.messages.length - 1]?.sentAt ?? "";
      const rightTime = right.messages[right.messages.length - 1]?.sentAt ?? "";
      return new Date(rightTime).getTime() - new Date(leftTime).getTime();
    });
}

export function MessagingCenter({ role, emptyState }: MessagingCenterProps) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/guardian/messages", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load messages. Try again.");
        return (await res.json()) as MessageRecord[];
      })
      .then((data) => {
        if (!active) return;
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const threads = useMemo(() => buildThreads(messages), [messages]);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null;

  useEffect(() => {
    if (!activeThread && threads[0]) {
      setActiveThreadId(threads[0].id);
    }
  }, [activeThread, threads]);

  useEffect(() => {
    if (!activeThread) return;

    const unreadMessages = activeThread.messages.filter(
      (message) => !message.read && message.fromRole !== role
    );

    if (unreadMessages.length === 0) return;

    setMessages((current) =>
      current.map((message) =>
        unreadMessages.some((candidate) => candidate.messageId === message.messageId)
          ? { ...message, read: true }
          : message
      )
    );

    unreadMessages.forEach((message) => {
      fetch(`/api/guardian/messages/${message.messageId}/read`, { method: "PATCH" }).catch(() => {
        return undefined;
      });
    });
  }, [activeThread, role]);

  async function handleSend() {
    if (!activeThread || !draft.trim()) return;

    const sentAt = new Date().toISOString();
    const optimisticId = `tmp-${sentAt}`;
    const optimisticMessage: MessageRecord = {
      messageId: optimisticId,
      guardianId: activeThread.guardianId,
      teacherId: activeThread.teacherId,
      studentId: activeThread.studentId,
      guardianName: activeThread.guardianName,
      teacherName: activeThread.teacherName,
      studentName: activeThread.studentName,
      subject: activeThread.subject,
      fromRole: role,
      fromName: role === "teacher" ? activeThread.teacherName : activeThread.guardianName,
      body: draft.trim(),
      sentAt,
      read: true,
    };

    const payload =
      role === "teacher"
        ? {
            guardianId: activeThread.guardianId,
            studentId: activeThread.studentId,
            body: draft.trim(),
          }
        : {
            teacherId: activeThread.teacherId,
            studentId: activeThread.studentId,
            body: draft.trim(),
          };

    setSending(true);
    setDraft("");
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const res = await fetch("/api/guardian/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Unable to send message.");
      }

      setMessages((current) =>
        current.map((message) =>
          message.messageId === optimisticId ? { ...message, messageId: data.messageId } : message
        )
      );
    } catch (err: any) {
      setDraft(optimisticMessage.body);
      setMessages((current) =>
        current.filter((message) => message.messageId !== optimisticId)
      );
      setError(err?.message ?? "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--ll-surface)]/60" />
          ))}
        </div>
        <div className="h-[420px] animate-pulse rounded-xl bg-[var(--ll-surface)]/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center text-sm text-[var(--ll-text-muted)]">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
      <aside className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3">
        <div className="space-y-2">
          {threads.map((thread) => {
            const lastMessage = thread.messages[thread.messages.length - 1];
            const unreadCount = thread.messages.filter(
              (message) => !message.read && message.fromRole !== role
            ).length;

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => setActiveThreadId(thread.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  activeThread?.id === thread.id
                    ? "border-emerald-500/40 bg-[var(--ll-yellow)]/10"
                    : "border-white/5 bg-[var(--ll-bg)]/40 hover:border-[var(--ll-border)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ll-text)]">
                      {role === "teacher"
                        ? `${thread.guardianName} - ${thread.studentName}`
                        : thread.teacherName}
                    </p>
                    <p className="text-xs text-[var(--ll-text-faint)]">
                      {role === "guardian"
                        ? thread.subject?.replace(/_/g, " ") ?? thread.studentName
                        : thread.studentName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--ll-yellow-soft)]" aria-hidden="true" />
                    ) : null}
                    <span className="text-[11px] text-[var(--ll-text-faint)]">
                      {formatTimestamp(lastMessage.sentAt)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="truncate text-xs text-[var(--ll-text-muted)]">
                    {lastMessage.body.slice(0, 60)}
                  </p>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-[var(--ll-yellow)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--ll-yellow)]">
                      {unreadCount}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-[460px] flex-col rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70">
        <div className="border-b border-[var(--ll-border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">
            {role === "teacher"
              ? `${activeThread?.guardianName} - ${activeThread?.studentName}`
              : activeThread?.teacherName}
          </h2>
          <p className="text-xs text-[var(--ll-text-faint)]">
            {role === "guardian"
              ? activeThread?.subject?.replace(/_/g, " ") ?? activeThread?.studentName
              : activeThread?.subject?.replace(/_/g, " ") ?? "Conversation"}
          </p>
        </div>

        <div role="log" aria-live="polite" aria-label="Message feed" className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {activeThread?.messages.map((message) => {
            const ownMessage = message.fromRole === role;
            return (
              <div
                key={message.messageId}
                className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                    ownMessage
                      ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                      : "bg-[var(--ll-surface-muted)] text-[var(--ll-text-faint)]"
                  }`}
                >
                  <p className="text-[11px] font-semibold opacity-80">
                    {message.fromName} - {formatTimestamp(message.sentAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[var(--ll-border)] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder="Write a message..."
              className="min-h-11 flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="min-h-11 rounded-xl bg-[var(--ll-yellow)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
