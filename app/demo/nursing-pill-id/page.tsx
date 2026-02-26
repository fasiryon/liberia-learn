"use client";

import React, { useMemo } from 'react';
import PillExplorer from './_components/PillExplorer';
import AdaptivePractice from './_components/AdaptivePractice';
import ProgressCoach from './_components/ProgressCoach';

type PillTrack = 'Pre-Nursing' | 'RN';

export type Pill = {
  id: string;
  name: string;
  generic: string;
  imprint: string;
  color: string;
  shape: string;
  useCases: string[];
  semesterFocus: PillTrack[];
  imageUrl: string;
};

export type PracticeSession = {
  id: string;
  mode: 'Flashcards' | 'Quiz' | 'Case Scenario';
  focus: string;
  score: number;
};

const pillCatalog: Pill[] = [
  {
    id: '1',
    name: 'Lisinopril',
    generic: 'Lisinopril',
    imprint: 'L Z 10',
    color: 'Pink',
    shape: 'Round',
    useCases: ['Hypertension management', 'Heart failure adjunct'],
    semesterFocus: ['Pre-Nursing', 'RN'],
    imageUrl:
      'https://images.ctfassets.net/8k0h54kbe6bj/3WFT8HSF9uNxysQtyOA/2d60705e299b4c90c110143b7159a49b/lisinopril-tablet.png',
  },
  {
    id: '2',
    name: 'Metformin',
    generic: 'Metformin Hydrochloride',
    imprint: 'G 10',
    color: 'White',
    shape: 'Oval',
    useCases: ['Type 2 diabetes first-line therapy'],
    semesterFocus: ['Pre-Nursing'],
    imageUrl:
      'https://images.ctfassets.net/8k0h54kbe6bj/4V8BTLSFqBYBsPOnUyB/4c419f4c832f2685a2af6e2d6a1a6b12/metformin.png',
  },
  {
    id: '3',
    name: 'Warfarin',
    generic: 'Warfarin Sodium',
    imprint: '2 0 2 0',
    color: 'Peach',
    shape: 'Round',
    useCases: ['Anticoagulation therapy'],
    semesterFocus: ['RN'],
    imageUrl:
      'https://images.ctfassets.net/8k0h54kbe6bj/3NtsSUKlOx5hG3s4jsbtj2/6610cf73ef9a775d5ced1b371ffccf90/warfarin-tablet.png',
  },
  {
    id: '4',
    name: 'Atorvastatin',
    generic: 'Atorvastatin Calcium',
    imprint: 'PD 155',
    color: 'White',
    shape: 'Oval',
    useCases: ['Hyperlipidemia', 'Cardiovascular risk reduction'],
    semesterFocus: ['Pre-Nursing', 'RN'],
    imageUrl:
      'https://images.ctfassets.net/8k0h54kbe6bj/2UKrUiqw7ZIYPnrRzIMkoE/f72378cdaa1a82f5489d27be27fa9982/atorvastatin.png',
  },
  {
    id: '5',
    name: 'Furosemide',
    generic: 'Furosemide',
    imprint: 'SG 109',
    color: 'White',
    shape: 'Round',
    useCases: ['Edema', 'Heart failure'],
    semesterFocus: ['RN'],
    imageUrl:
      'https://images.ctfassets.net/8k0h54kbe6bj/2Epm8T1EZsVM5vAs0Bb2Hz/06f8d414dd66f2cee27cdad8a19a5b2a/furosemide.png',
  },
];

const practiceSessions: PracticeSession[] = [
  { id: 'session-1', mode: 'Flashcards', focus: 'Cardio basics', score: 82 },
  { id: 'session-2', mode: 'Quiz', focus: 'Diabetes management', score: 68 },
  { id: 'session-3', mode: 'Case Scenario', focus: 'Anticoagulants', score: 54 },
];

export default function NursingPillIdDemoPage() {
  const averageMastery = useMemo(() => {
    const totalScore = practiceSessions.reduce((sum, session) => sum + session.score, 0);
    return Math.round(totalScore / practiceSessions.length);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-sky-400">Demo</p>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Nursing Pill Identification Coach</h1>
            <p className="mt-1 text-sm text-slate-400">
              Unified learning workspace for pre-nursing and registered nurse students.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300">
              Average Mastery <span className="ml-2 text-xl font-semibold text-emerald-400">{averageMastery}%</span>
            </span>
            <button className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400">
              Push Reminder
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 text-slate-100">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Today&apos;s Signal</p>
              <p className="text-base font-semibold text-white">
                Focus anticoagulants – mastery trending low ahead of your 12/12 exam.
              </p>
            </div>
            <button className="rounded-xl border border-sky-500/60 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20">
              View Coaching Brief
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-6">
              <PillExplorer pills={pillCatalog} />
              <AdaptivePractice sessions={practiceSessions} />
            </div>
            <ProgressCoach sessions={practiceSessions} />
          </div>
        </section>
      </main>
    </div>
  );
}

