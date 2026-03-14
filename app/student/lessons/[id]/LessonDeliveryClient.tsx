"use client";

import { useEffect, useMemo, useState } from "react";

import { lessonDurationLabel, renderSimpleMarkdown, selectLessonBody } from "@/lib/lessons";

type ExitTicketQuestion = {
  question: string;
  type: "mcq" | "short_answer";
  choices?: string[];
  standardCode?: string;
};

type LessonResponse = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  teacherName: string;
  classFormat: string;
  schoolName: string;
  bodyStandard: string | null;
  bodyBlock: string | null;
  body: string | null;
  deliveryProfile: {
    exitTicket?: {
      questions?: ExitTicketQuestion[];
    };
  } | null;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
};

type TutorMessage = {
  role: "student" | "assistant";
  text: string;
};

export default function LessonDeliveryClient({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<LessonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadLesson() {
      try {
        const response = await fetch(`/api/student/work/${lessonId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Failed to load lesson.");
        if (!cancelled) {
          setLesson(data);
          setError(null);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message ?? "Failed to load lesson.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLesson();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const renderedBody = useMemo(() => {
    if (!lesson) return "";
    return selectLessonBody(
      {
        body: lesson.body,
        body_standard: lesson.bodyStandard,
        body_block: lesson.bodyBlock,
      },
      lesson.classFormat
    );
  }, [lesson]);

  const exitTicketQuestions = lesson?.deliveryProfile?.exitTicket?.questions ?? [];
  const aiTutorEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_TUTOR === "true";

  async function handleTutorSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lesson || !tutorQuestion.trim()) return;

    const prompt = tutorQuestion.trim();
    setTutorMessages((current) => [...current, { role: "student", text: prompt }]);
    setTutorQuestion("");
    setTutorLoading(true);

    try {
      const response = await fetch("/api/student/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: lesson.subject,
          strandKey: lesson.subject.toLowerCase(),
          masteryState: "NOT_ASSESSED",
          proficiencyState: "NOT_ASSESSED",
          gradeBand: lesson.grade <= 3 ? "lower_primary" : lesson.grade <= 6 ? "upper_primary" : "secondary",
          requestType: "explain",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Tutor unavailable.");
      setTutorMessages((current) => [...current, { role: "assistant", text: data.explanation ?? "No response available." }]);
    } catch (tutorError: any) {
      setTutorMessages((current) => [...current, { role: "assistant", text: tutorError?.message ?? "Tutor unavailable right now." }]);
    } finally {
      setTutorLoading(false);
    }
  }

  async function handleSubmitExitTicket() {
    if (!lesson) return;
    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const exitTicketAnswers = exitTicketQuestions.map((question, index) => ({
        questionIndex: index,
        answer: answers[index] ?? null,
      }));
      const response = await fetch(`/api/student/lessons/${lesson.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitTicketAnswers }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to complete lesson.");
      setLesson((current) => (current ? { ...current, status: "completed", completedAt: data?.completedAt ?? new Date().toISOString() } : current));
      setSubmitMessage("Lesson complete! Great work.");
    } catch (submitError: any) {
      setSubmitMessage(submitError?.message ?? "Failed to complete lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-slate-900/60" />;
  }
  if (error || !lesson) {
    return <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error ?? "Lesson not found."}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300">{lesson.subject}</span>
          <span>Grade {lesson.grade}</span>
          <span>{lessonDurationLabel(lesson.classFormat)}</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white">{lesson.title}</h1>
        <p className="mt-2 text-sm text-slate-400">Teacher: {lesson.teacherName}</p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <div
          className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-li:text-slate-200"
          dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(renderedBody) }}
        />
      </section>

      {aiTutorEnabled ? (
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold text-white">Ask a question about this lesson</h2>
          <form className="mt-4 space-y-3" onSubmit={handleTutorSubmit}>
            <textarea
              value={tutorQuestion}
              onChange={(event) => setTutorQuestion(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
              placeholder="Ask for help with the lesson..."
            />
            <button
              type="submit"
              disabled={tutorLoading || !tutorQuestion.trim()}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {tutorLoading ? "Asking..." : "Ask Tutor"}
            </button>
          </form>

          {tutorMessages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {tutorMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === "student" ? "bg-slate-950/80 text-slate-200" : "bg-emerald-500/10 text-emerald-100"
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold text-white">Exit Ticket</h2>
        <div className="mt-4 space-y-5">
          {exitTicketQuestions.map((question, index) => (
            <div key={`${question.question}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-slate-100">{question.question}</p>
              {question.type === "mcq" ? (
                <div className="mt-3 space-y-2">
                  {(question.choices ?? []).map((choice, choiceIndex) => (
                    <label key={`${choice}-${choiceIndex}`} className="flex items-center gap-3 rounded-xl border border-slate-800 px-3 py-3 text-sm text-slate-200">
                      <input
                        type="radio"
                        name={`exit-ticket-${index}`}
                        checked={answers[index] === String(choiceIndex)}
                        onChange={() => setAnswers((current) => ({ ...current, [index]: String(choiceIndex) }))}
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[index] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))}
                  className="mt-3 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                  placeholder="Write your answer here"
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmitExitTicket}
          disabled={submitting || lesson.status === "completed"}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-400 px-6 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {lesson.status === "completed" ? "Lesson already completed" : submitting ? "Submitting..." : "Submit"}
        </button>

        {submitMessage ? <p className="mt-3 text-sm text-slate-300">{submitMessage}</p> : null}
      </section>
    </div>
  );
}
