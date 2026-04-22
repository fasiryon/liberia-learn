"use client";

import { useRouter } from "next/navigation";
import { teacherWelcomeStorageKey } from "@/app/teacher/TeacherWelcomeGate";

export default function TeacherWelcomeClient({
  teacherName,
}: {
  teacherName: string;
}) {
  const router = useRouter();

  function handleStart() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherWelcomeStorageKey, "true");
    }
    router.push("/teacher/dashboard");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 shadow-none shadow-slate-950/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-yellow)]">
          Teacher Welcome
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          Welcome to LiberiaLearn, {teacherName}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ll-text)]">
          LiberiaLearn helps you deliver lessons, monitor learning progress, and identify students who may need support without adding complex extra tools to your day.
        </p>

        <section className="mt-6 rounded-xl bg-[var(--ll-bg)]/60 p-5">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">What you can do</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--ll-text)]">
            <li>📚 Deliver AI-powered lessons to your students</li>
            <li>📊 Track each student&apos;s progress in real time</li>
            <li>🎯 Get alerts when a student needs extra support</li>
            <li>📝 Assign homework and grade with AI assistance</li>
          </ul>
        </section>

        <button
          type="button"
          onClick={handleStart}
          className="mt-6 min-h-11 w-full rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-base font-semibold text-[var(--ll-text-faint)]"
        >
          Get Started
        </button>
      </div>
    </main>
  );
}
