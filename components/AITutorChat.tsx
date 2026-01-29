"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AITutorChatProps {
  initialMessage?: string;
}

export function AITutorChat({ initialMessage }: AITutorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  };

  // Seed the chat with an initial message (once)
  useEffect(() => {
    if (!initializedRef.current && initialMessage) {
      initializedRef.current = true;
      const now = new Date();
      setMessages([
        {
          role: "assistant",
          content:
            "Tell me what you’re working on, and I’ll help you step by step.",
          timestamp: now,
        },
        {
          role: "user",
          content: initialMessage,
          timestamp: now,
        },
      ]);
    }
  }, [initialMessage]);

  // Scroll chat body when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setError("");
    setLoading(true);

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();

      const aiMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setError("I'm having trouble right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const starterSuggestions = [
    "Help me with fractions",
    "Explain photosynthesis",
    "What is a quadratic equation?",
    "Tips for writing essays",
  ];

  return (
    <div className="flex h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      {/* Header */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <p className="text-sm font-medium text-slate-200">AI Tutor</p>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Ask me anything about your homework or classwork.
        </p>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-4 overflow-y-auto p-4"
      >
        {/* Empty State w/ Suggestions */}
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            <p className="mb-2">👋 Hi! I'm your AI tutor.</p>
            <p className="text-xs text-slate-400 mb-4">
              Try asking me about:
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              {starterSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-emerald-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message List */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === "user"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>

              {/* Footer row: timestamp + copy + rating */}
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span
                  className={`${
                    msg.role === "user"
                      ? "text-slate-950/60"
                      : "text-slate-400"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {msg.role === "assistant" && (
                  <>
                    {/* Copy Button */}
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(msg.content)
                      }
                      className="text-slate-400 hover:text-slate-200"
                      title="Copy"
                    >
                      📋
                    </button>

                    {/* Thumbs */}
                    <button
                      className="text-slate-400 hover:text-emerald-300"
                      title="Helpful"
                    >
                      👍
                    </button>
                    <button
                      className="text-slate-400 hover:text-red-300"
                      title="Not helpful"
                    >
                      👎
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-slate-800 px-4 py-2">
              <div className="flex gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-500"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-slate-500"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 p-4">
        {error && (
          <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            maxLength={1000}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>

        <p className="mt-2 text-xs text-slate-500">
          {input.length}/1000 characters
        </p>
      </div>
    </div>
  );
}
