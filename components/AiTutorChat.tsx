"use client";

import { useEffect, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function AiTutorChat() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi! I'm your LiberiaLearn tutor. Ask me anything." },
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (!hasSentRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    hasSentRef.current = true;
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data?.error ? String(data.error) : "Internal server error";
        setMsgs((m) => [...m, { role: "assistant", content: `Error: ${err}` }]);
        return;
      }

      const reply =
        data?.reply ??
        data?.message ??
        data?.content ??
        data?.text ??
        "(no reply)";

      setMsgs((m) => [...m, { role: "assistant", content: String(reply) }]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "I'm having trouble right now. Please try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-4xl rounded-xl border border-[var(--ll-border)] bg-white/5 shadow overflow-hidden">
      <div className="p-4 border-b border-[var(--ll-border)]">
        <div className="text-[var(--ll-text)]/90 font-semibold">LiberiaLearn AI Tutor</div>
        <div className="text-[var(--ll-text)]/60 text-sm">Ask in simple English (or we can add Koloqua later).</div>
      </div>

      <div className="h-[62vh] overflow-auto p-4 space-y-3">
        {msgs.map((m, idx) => (
          <div
            key={idx}
            className={[
              "max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-[var(--ll-yellow)] text-black"
                : "bg-[#0b0d14] text-[var(--ll-text)] border border-[var(--ll-border)]",
            ].join(" ")}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-[var(--ll-border)] flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question (example: Explain fractions like I'm in Grade 4)"
          className="flex-1 rounded-xl bg-[#0b0d14] border border-[var(--ll-border)] px-3 py-3 outline-none focus:border-emerald-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-xl bg-[var(--ll-yellow)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60 text-black font-semibold px-5"
        >
          {busy ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}