"use client";

import React, { useMemo, useState } from 'react';
import type { Pill } from '../page';
import { trackEvent } from '../../../../lib/trackEvent';

type ModeFilter = 'All' | 'Pre-Nursing' | 'RN';

type Props = {
  pills: Pill[];
};

export default function PillExplorer({ pills }: Props) {
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('All');
  const [colorFilter, setColorFilter] = useState<string>('All');

  const colors = useMemo(() => {
    const unique = new Set<string>();
    pills.forEach((pill) => unique.add(pill.color));
    return ['All', ...Array.from(unique)];
  }, [pills]);

  const filtered = useMemo(() => {
    return pills.filter((pill) => {
      const matchesTrack =
        modeFilter === 'All' ? true : pill.semesterFocus.includes(modeFilter);
      const matchesColor =
        colorFilter === 'All' ? true : pill.color === colorFilter;
      const matchesQuery =
        query.trim().length === 0
          ? true
          : [pill.name, pill.generic, pill.imprint, pill.shape]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase());
      return matchesTrack && matchesColor && matchesQuery;
    });
  }, [pills, query, modeFilter, colorFilter]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pill Explorer</h2>
          <p className="text-sm text-slate-400">
            Search formulary and curriculum-aligned medications with educational context.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex rounded-full border border-slate-800 bg-slate-950 p-1">
            {(['All', 'Pre-Nursing', 'RN'] as ModeFilter[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setModeFilter(mode)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  modeFilter === mode
                    ? 'bg-sky-500 text-white shadow shadow-sky-500/40'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <select
            value={colorFilter}
            onChange={(event) => setColorFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none ring-sky-500 focus:ring-2 sm:w-40"
          >
            {colors.map((colorOption) => (
              <option key={colorOption} value={colorOption}>
                {colorOption === 'All' ? 'All colors' : colorOption}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2 text-slate-300">
        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Search
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, imprint code, use case..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {filtered.map((pill) => (
          <article
            key={pill.id}
            onClick={() =>
              trackEvent('view_drug', {
                drugId: pill.id,
                brandName: pill.name,
                genericName: pill.generic,
              })
            }
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow shadow-slate-950/40 transition hover:border-sky-500/60 hover:shadow-sky-500/30"
          >
            <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl transition group-hover:bg-sky-500/20" />
            <div className="flex items-start gap-4">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
                <img
                  src={pill.imageUrl}
                  alt={pill.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">{pill.name}</h3>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {pill.generic}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full bg-slate-800/70 px-2 py-1 font-semibold">
                    {pill.color} • {pill.shape}
                  </span>
                  <span className="rounded-full bg-slate-800/70 px-2 py-1 font-semibold">
                    Imprint {pill.imprint}
                  </span>
                  {pill.semesterFocus.map((track) => (
                    <span
                      key={track}
                      className="rounded-full bg-sky-500/10 px-2 py-1 font-semibold text-sky-300"
                    >
                      {track}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-slate-300">
              {pill.useCases.map((useCase) => (
                <li key={useCase} className="flex items-center gap-2">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                  {useCase}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-10 text-center text-sm text-slate-400">
            No matches yet. Adjust filters or check spelling to explore the formulary.
          </div>
        )}
      </div>
    </div>
  );
}

