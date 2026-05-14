"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { GuardianNav } from "@/components/guardian/GuardianNav";
import { MessagingCenter } from "@/components/messaging/MessagingCenter";

type Recipient = {
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
};

export default function GuardianMessagesPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/guardian/linked-teachers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRecipients(d);
      })
      .catch(() => undefined);
  }, []);

  async function handleSend() {
    const recipient = recipients[selectedIdx];
    if (!recipient || !body.trim()) return;

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/guardian/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: recipient.teacherId,
          studentId: recipient.studentId,
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to send message.");
      setSendSuccess(true);
      setBody("");
      setComposeOpen(false);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setSendSuccess(false), 4000);
    } catch (err: any) {
      setSendError(err?.message ?? "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <Link
          href="/guardian/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div>
          <h1 className="mt-2 text-2xl font-bold">Messages</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Contact your child&apos;s teacher and review recent conversation history.
          </p>
        </div>

        <GuardianNav />

        {/* Compose panel */}
        {recipients.length > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
            {!composeOpen ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[var(--ll-text-muted)]">
                  Start a new conversation with your child&apos;s teacher.
                </p>
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="shrink-0 rounded-lg border border-[var(--ll-border-strong)] bg-[var(--ll-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
                >
                  New message
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--ll-text)]">New message</p>
                  <button
                    type="button"
                    onClick={() => { setComposeOpen(false); setSendError(null); }}
                    className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text)]"
                  >
                    Cancel
                  </button>
                </div>

                {recipients.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--ll-text-faint)] mb-1">
                      Regarding
                    </label>
                    <select
                      value={selectedIdx}
                      onChange={(e) => setSelectedIdx(Number(e.target.value))}
                      className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
                    >
                      {recipients.map((r, i) => (
                        <option key={r.studentId} value={i}>
                          {r.studentName} — {r.teacherName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {recipients.length === 1 && (
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    To: <span className="text-[var(--ll-text-muted)]">{recipients[0].teacherName}</span>
                    {" "}re: <span className="text-[var(--ll-text-muted)]">{recipients[0].studentName}</span>
                  </p>
                )}

                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Write your message…"
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2.5 text-sm text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)]/50 placeholder:text-[var(--ll-text-faint)]"
                />

                {sendError && (
                  <p className="text-xs text-red-400">{sendError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !body.trim()}
                  className="rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send message"}
                </button>
              </div>
            )}
          </div>
        )}

        {sendSuccess && (
          <div className="rounded-xl border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 px-4 py-3 text-sm text-[var(--ll-yellow)]">
            Message sent successfully.
          </div>
        )}

        <MessagingCenter
          key={refreshKey}
          role="guardian"
          emptyState="No messages yet. Use the New message button above to contact your child's teacher."
        />
      </div>
    </main>
  );
}
