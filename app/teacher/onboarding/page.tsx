"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, BookOpen, ClipboardCheck, BarChart3 } from "lucide-react";

const STEPS = [
  {
    step: 1,
    title: "View your class roster",
    description: "See all students assigned to your classes.",
    button: "View my students",
    href: "/teacher/students",
    Icon: Users,
  },
  {
    step: 2,
    title: "Schedule your first lesson",
    description: "Assign curriculum lessons to your class.",
    button: "Open lesson planner",
    href: "/teacher/lesson-planner",
    Icon: BookOpen,
  },
  {
    step: 3,
    title: "Create an assignment",
    description: "Set work for students with a due date.",
    button: "Create assignment",
    href: "/teacher/assignments",
    Icon: ClipboardCheck,
  },
  {
    step: 4,
    title: "Check your class performance",
    description: "See who is on track and who needs help.",
    button: "View dashboard",
    href: "/teacher/dashboard",
    Icon: BarChart3,
  },
] as const;

async function markComplete() {
  await fetch("/api/teacher/onboarding/complete", { method: "POST" }).catch(() => null);
}

export default function TeacherOnboardingPage() {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  async function handleGetStarted() {
    setCompleting(true);
    await markComplete();
    router.push("/teacher/dashboard");
  }

  async function handleSkip() {
    await markComplete();
    router.push("/teacher/dashboard");
  }

  return (
    <div className="ll-dashboard-shell px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
            Getting started
          </p>
          <h1 className="text-3xl font-bold text-[var(--ll-text)]">
            Welcome to LiberiaLearn
          </h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            Here&apos;s how to get your classes started.
          </p>
        </div>

        <div className="space-y-3">
          {STEPS.map(({ step, title, description, button, href, Icon }) => (
            <div
              key={step}
              className="ll-section flex items-start gap-4 p-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ll-yellow-soft)]">
                <Icon className="h-4 w-4 text-[var(--ll-yellow)]" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)]">
                    Step {step}
                  </span>
                  <h2 className="text-sm font-semibold text-[var(--ll-text)]">{title}</h2>
                </div>
                <p className="mt-0.5 text-sm text-[var(--ll-text-muted)]">{description}</p>
              </div>
              <Link
                href={href}
                className="shrink-0 rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text-muted)] transition-colors hover:border-[var(--ll-border-strong)] hover:text-[var(--ll-text)]"
              >
                {button}
              </Link>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleGetStarted}
            disabled={completing}
            className="min-h-11 w-full max-w-xs rounded-full bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {completing ? "Setting up..." : "Get started"}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
