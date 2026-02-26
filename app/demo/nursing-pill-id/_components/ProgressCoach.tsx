"use client";

import React, { useMemo, useState } from 'react';
import type { PracticeSession } from '../page';

type Props = {
  sessions: PracticeSession[];
};

const targetHoursPerWeek = 5;

export default function ProgressCoach({ sessions }: Props) {
  const [examDate, setExamDate] = useState<string>('2025-12-12');

  const daysUntilExam = useMemo(() => {
    const exam = new Date(examDate);
    const now = new Date();
    const diff = exam.getTime() - now.getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  }, [examDate]);

  const focusAreas = useMemo(() => {
    return sessions
      .filter((session) => session.score < 70)
      .map((session) => ({
        label: session.focus,
        severity: session.score < 60 ? 'High' : 'Medium',
        score: session.score,
      }));
  }, [sessions]);

  const projectedHoursNeeded = useMemo(() => {
    const base = focusAreas.length * 2;
    return Math.max(base, targetHoursPerWeek);
  }, [focusAreas]);

  return (
    <aside className="flex h-full flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-slate-950/40">
      <div>
        <h2 className="text-lg font-semibold text-white">Progress Coach</h2>
        <p className="text-sm text-slate-400">
          Track readiness, exam timeline, and targeted remediation suggestions.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-wider text-slate-400">
          Exam Date
          <input
            type="date"
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-sky-500 focus:ring-2"
          />
        </label>
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span className="text-slate-400">Days remaining</span>
          <span className="text-lg font-semibold text-sky-300">{daysUntilExam}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span className="text-slate-400">Weekly study target</span>
          <span className="text-lg font-semibold text-emerald-300">
            {projectedHoursNeeded} hrs
          </span>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">Focus Map</p>
        {focusAreas.length > 0 ? (
          <ul className="space-y-3">
            {focusAreas.map((area) => (
              <li
                key={area.label}
                className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-slate-200"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{area.label}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      area.severity === 'High'
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {area.severity} priority
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Latest score {area.score}% • Schedule a refresher within 48 hours.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/70 px-3 py-6 text-center text-xs text-slate-400">
            No gaps flagged. Keep alternating modalities to maintain mastery.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-4 text-sm text-sky-200">
        <p className="text-xs uppercase tracking-wider text-sky-300">Next Push</p>
        <p>
          Auto-send reinforcement reminder tonight at 7pm for anticoagulant flashcards if score
          remains below 70%.
        </p>
      </div>
    </aside>
  );
}

