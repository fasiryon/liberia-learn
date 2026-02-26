"use client";

import React, { useMemo, useState } from 'react';
import type { PracticeSession } from '../page';

const practiceModes = [
  {
    id: 'flashcards',
    label: 'Flashcards',
    description: 'Rapid imprint-to-indication recall driven by spaced repetition.',
    examplePrompt: 'What is the primary indication for Lisinopril?',
    answer: 'Hypertension management with ACE inhibition.',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Low-stakes formative assessment with adaptive difficulty.',
    examplePrompt:
      'Which lab values must be monitored closely when initiating Warfarin therapy?',
    answer: 'INR and PT, targeting INR 2-3 for most indications.',
  },
  {
    id: 'scenario',
    label: 'Case Scenario',
    description: 'Clinical reasoning walkthrough blending meds, vitals, and patient history.',
    examplePrompt:
      'A post-op patient on anticoagulants presents with bruising. Identify the medication and first nursing response.',
    answer:
      'Warfarin; assess INR, hold dose, notify provider, monitor for bleeding.',
  },
] as const;

type Props = {
  sessions: PracticeSession[];
};

export default function AdaptivePractice({ sessions }: Props) {
  const [activeMode, setActiveMode] = useState<typeof practiceModes[number]>(practiceModes[0]);

  const latestByMode = useMemo(() => {
    const grouped = new Map<string, PracticeSession>();
    sessions.forEach((session) => {
      grouped.set(session.mode, session);
    });
    return grouped;
  }, [sessions]);

  const activeSession = latestByMode.get(activeMode.label) ?? null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/30">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-white">Adaptive Practice</h2>
        <p className="text-sm text-slate-400">
          Rotate modalities to reinforce imprint recognition, clinical application, and recall.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {practiceModes.map((mode) => {
          const isActive = activeMode.id === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'border-sky-500 bg-sky-500/10 text-sky-300 shadow shadow-sky-500/30'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950/80 p-5 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-widest text-slate-500">Learning Objective</p>
        <h3 className="mt-2 text-lg font-semibold text-white">{activeMode.label}</h3>
        <p className="mt-2 text-slate-300">{activeMode.description}</p>

        <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Practice Prompt</p>
          <p className="text-slate-200">{activeMode.examplePrompt}</p>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-emerald-200">
            <p className="text-xs uppercase tracking-wider text-emerald-300">Model Answer</p>
            <p>{activeMode.answer}</p>
          </div>
        </div>

        {activeSession ? (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-300">
            <div>
              <p className="font-semibold text-white">{activeSession.mode} session</p>
              <p className="text-slate-400">{activeSession.focus}</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-4 py-1 text-sm font-semibold text-emerald-300">
              {activeSession.score}%
            </span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-4 text-xs text-slate-400">
            No sessions tracked for this mode yet. Run a quick 5-minute drill to generate a baseline.
          </div>
        )}
      </div>
    </div>
  );
}

