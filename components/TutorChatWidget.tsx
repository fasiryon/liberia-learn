"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Flag } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string; ts: string };

const DAILY_LIMIT = 10;

export function TutorChatWidget({
  contentId,
  grade,
  subject,
}: {
  contentId: string;
  grade: number;
  subject: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionsLeft, setQuestionsLeft] = useState(DAILY_LIMIT);
  const [offline, setOffline] = useState(false);
  const [hasPrior, setHasPrior] = useState(false);
  // Flag state
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    fetch(`/api/student/tutor/${contentId}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const msgs = Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
        if (msgs.length > 0) {
          setMessages(msgs);
          setHasPrior(true);
        }
        setQuestionsLeft(Math.max(0, DAILY_LIMIT - (data.questionsAsked ?? 0)));
      })
      .catch(() => {});
  }, [contentId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading || questionsLeft === 0) return;

    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    setOffline(false);

    const userMsg: ChatMessage = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/student/tutor/${contentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setQuestionsLeft(0);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error ?? "Daily limit reached — come back tomorrow.",
            ts: new Date().toISOString(),
          },
        ]);
        return;
      }
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Tutor unavailable right now.", ts: new Date().toISOString() },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "No response.", ts: new Date().toISOString() },
      ]);
      setQuestionsLeft(typeof data.questionsLeft === "number" ? data.questionsLeft : Math.max(0, questionsLeft - 1));
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Tutor unavailable right now.", ts: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitFlag() {
    setFlagging(true);
    try {
      await fetch(`/api/student/lesson/${contentId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: flagNote }),
      });
      setFlagged(true);
      setFlagOpen(false);
      setFlagNote("");
    } catch {
      // best-effort
    } finally {
      setFlagging(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          aria-label="Open AI tutor"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ll-yellow)] shadow-lg transition-transform hover:scale-105 focus:outline-none"
        >
          <MessageCircle size={24} className="text-[var(--ll-bg)]" />
          {hasPrior && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500" />
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-bg)] shadow-2xl"
          style={{ height: "500px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-[var(--ll-yellow)]" />
              <span className="text-sm font-semibold text-[var(--ll-text)]">
                AI Tutor — {subject}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Flag this lesson for help"
                onClick={() => setFlagOpen((v) => !v)}
                title="Flag lesson for teacher"
                className={`rounded-full p-1 transition-colors ${flagged ? "text-red-500" : "text-[var(--ll-text-muted)] hover:text-red-400"}`}
              >
                <Flag size={15} />
              </button>
              <button
                type="button"
                aria-label="Close tutor"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Flag panel */}
          {flagOpen && !flagged && (
            <div className="border-b border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--ll-text)]">Flag this lesson for your teacher</p>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Optional: describe what you need help with"
                className="mt-2 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
                rows={2}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={submitFlag}
                  disabled={flagging}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400"
                >
                  {flagging ? "Flagging…" : "Confirm Flag"}
                </button>
                <button
                  type="button"
                  onClick={() => setFlagOpen(false)}
                  className="rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {flagged && (
            <div className="border-b border-[var(--ll-border)] bg-red-500/10 px-4 py-2 text-xs text-red-400">
              🚩 Flagged — your teacher has been notified
            </div>
          )}

          {/* Offline banner */}
          {offline && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
              AI Tutor is not available offline. Connect to the internet to ask questions.
            </div>
          )}

          {/* Message feed */}
          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto space-y-3 px-4 py-3"
          >
            {messages.length === 0 && (
              <p className="text-center text-xs text-[var(--ll-text-muted)] pt-8">
                Ask me anything about this lesson!
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--ll-yellow-soft)] text-[var(--ll-text)]"
                      : "bg-[var(--ll-surface)] text-[var(--ll-text)]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[var(--ll-surface)] px-4 py-2 text-sm text-[var(--ll-text-muted)]">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-[var(--ll-border)] px-3 py-2">
            {questionsLeft === 0 ? (
              <p className="py-2 text-center text-xs text-[var(--ll-text-muted)]">
                Daily limit reached — come back tomorrow
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 200))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask about this lesson…"
                  rows={2}
                  disabled={loading || questionsLeft === 0}
                  className="flex-1 resize-none rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!input.trim() || loading || questionsLeft === 0}
                  aria-label="Send message"
                  className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ll-yellow)] disabled:opacity-40"
                >
                  <Send size={16} className="text-[var(--ll-bg)]" />
                </button>
              </div>
            )}
            <p className="mt-1 text-right text-[10px] text-[var(--ll-text-muted)]">
              {questionsLeft} question{questionsLeft !== 1 ? "s" : ""} left today
            </p>
          </div>
        </div>
      )}
    </>
  );
}
