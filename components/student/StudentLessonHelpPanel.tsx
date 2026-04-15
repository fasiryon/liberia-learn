"use client";

import { useEffect } from "react";

import { STUDENT_LESSON_HELP_SUGGESTIONS } from "@/lib/ai/studentLessonSupport";

type TutorMessage = {
  role: "student" | "assistant";
  text: string;
};

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1" aria-label="AI is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" />
    </div>
  );
}

export function StudentLessonHelpPanel({
  open,
  onClose,
  lessonTitle,
  subject,
  grade,
  question,
  onQuestionChange,
  onQuestionSubmit,
  messages,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  lessonTitle: string;
  subject: string;
  grade: number;
  question: string;
  onQuestionChange: (value: string) => void;
  onQuestionSubmit: (value?: string) => void;
  messages: TutorMessage[];
  loading: boolean;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close lesson help"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[2rem] border border-white/10 bg-slate-950 text-slate-50 shadow-2xl shadow-black/50 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-[2rem]">
        <header className="border-b border-slate-800 px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                Help Me Understand
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">{lessonTitle}</h2>
              <p className="mt-1 text-sm text-slate-300">
                Grade {grade} {subject.replace(/_/g, " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {STUDENT_LESSON_HELP_SUGGESTIONS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onQuestionSubmit(prompt)}
                disabled={loading}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {messages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">
              Ask about this exact lesson. Responses stay grounded in the lesson text and use simpler language when needed.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[92%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                    message.role === "student"
                      ? "ml-auto bg-emerald-400 text-slate-950"
                      : "bg-slate-900 text-slate-100"
                  }`}
                >
                  {message.text}
                </div>
              ))}
              {loading ? (
                <div className="max-w-[92%] rounded-3xl bg-slate-900 px-4 py-3 text-sm text-emerald-100">
                  <TypingDots />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form
          className="border-t border-slate-800 px-4 py-4 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            onQuestionSubmit();
          }}
        >
          <textarea
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="Ask about this lesson in your own words"
            className="min-h-28 w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-base leading-6 text-slate-50 outline-none transition-colors focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
          />
          <button
            type="submit"
            disabled={loading || question.trim().length < 8}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "Thinking..." : "Ask AI Tutor"}
          </button>
        </form>
      </section>
    </div>
  );
}
