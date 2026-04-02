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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          Teacher Welcome
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          Welcome to LiberiaLearn, {teacherName}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          LiberiaLearn helps you deliver lessons, monitor learning progress, and identify students who may need support without adding complex extra tools to your day.
        </p>

        <section className="mt-6 rounded-2xl bg-slate-950/60 p-5">
          <h2 className="text-lg font-semibold text-slate-100">What you can do</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>📚 Deliver AI-powered lessons to your students</li>
            <li>📊 Track each student&apos;s progress in real time</li>
            <li>🎯 Get alerts when a student needs extra support</li>
            <li>📝 Assign homework and grade with AI assistance</li>
          </ul>
        </section>

        <button
          type="button"
          onClick={handleStart}
          className="mt-6 min-h-11 w-full rounded-2xl bg-emerald-400 px-5 py-3 text-base font-semibold text-slate-950"
        >
          Get Started
        </button>
      </div>
    </main>
  );
}
