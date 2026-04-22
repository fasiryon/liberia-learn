"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WelcomeAction = "lessons" | "dashboard";

export default function StudentWelcomeClient({ name }: { name: string }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<WelcomeAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finish(action: WelcomeAction) {
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch("/api/student/welcome", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to save welcome status.");
      router.push(action === "lessons" ? "/student/lessons" : "/dashboard");
      router.refresh();
    } catch (finishError: any) {
      setError(finishError?.message ?? "Unable to save welcome status.");
    } finally {
      setBusyAction(null);
    }
  }

  const steps = [
    {
      title: "Start your first lesson",
      icon: "M12 4v16m8-8H4",
      body: "Choose a grade-level lesson and complete the exit ticket.",
    },
    {
      title: "Use the AI tutor",
      icon: "M8 10h8M8 14h5M6 20l-2 2v-4a8 8 0 1116 0v4l-2-2",
      body: "Ask for a simpler explanation when a topic feels difficult.",
    },
    {
      title: "Track your progress",
      icon: "M4 18l5-5 4 4 7-9",
      body: "See lessons, scores, certificates, and growth over time.",
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center gap-8">
        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
            First login
          </p>
          <h1 className="text-4xl font-bold tracking-normal text-[var(--ll-text)]">
            Welcome to LiberiaLearn, {name}!
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--ll-text)]">
            Start with one lesson, use help when you need it, and watch your progress build.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ll-yellow-soft)] text-[var(--ll-text-faint)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={step.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">
                Step {index + 1}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--ll-text)]">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ll-text)]">{step.body}</p>
            </article>
          ))}
        </section>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => finish("lessons")}
            disabled={busyAction !== null}
            className="ll-touch-target inline-flex items-center justify-center rounded-xl bg-[var(--ll-yellow-soft)] px-6 py-3 text-sm font-bold text-[var(--ll-text-faint)] disabled:opacity-60"
          >
            {busyAction === "lessons" ? "Saving..." : "Let's get started"}
          </button>
          <button
            type="button"
            onClick={() => finish("dashboard")}
            disabled={busyAction !== null}
            className="ll-touch-target inline-flex items-center justify-center rounded-xl border border-[var(--ll-border)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60"
          >
            {busyAction === "dashboard" ? "Saving..." : "Go to my dashboard"}
          </button>
        </div>
      </div>
    </main>
  );
}
