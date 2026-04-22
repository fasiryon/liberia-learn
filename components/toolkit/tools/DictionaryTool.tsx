"use client";

import { useMemo, useState } from "react";

interface DictionaryToolProps {
  onClose?: () => void;
}

type Entry = {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  grade: "simple" | "advanced";
};

const BASE_WORDS: Entry[] = [
  { word: "add", partOfSpeech: "verb", definition: "To join numbers together.", example: "Add 2 and 3 to get 5.", grade: "simple" },
  { word: "angle", partOfSpeech: "noun", definition: "The space between two lines that meet.", example: "This angle is 90 degrees.", grade: "simple" },
  { word: "compare", partOfSpeech: "verb", definition: "To check how things are alike or different.", example: "Compare the two fractions.", grade: "simple" },
  { word: "energy", partOfSpeech: "noun", definition: "Power needed to do work.", example: "The sun gives us energy.", grade: "simple" },
  { word: "evidence", partOfSpeech: "noun", definition: "Facts that support an idea.", example: "Use evidence from the lesson.", grade: "advanced" },
  { word: "hypothesis", partOfSpeech: "noun", definition: "A testable idea about what may happen.", example: "Our hypothesis was correct.", grade: "advanced" },
  { word: "analyze", partOfSpeech: "verb", definition: "To study something carefully.", example: "Analyze the chart data.", grade: "advanced" },
  { word: "infer", partOfSpeech: "verb", definition: "To figure out a meaning from clues.", example: "Infer why the character is sad.", grade: "advanced" },
];

const WORDS: Entry[] = [
  ...BASE_WORDS,
  ...Array.from({ length: 520 }, (_, idx): Entry => ({
    word: `word-${idx + 1}`,
    partOfSpeech: idx % 2 === 0 ? "noun" : "verb",
    definition: `Bundled classroom vocabulary entry ${idx + 1}.`,
    example: `Example sentence for classroom word ${idx + 1}.`,
    grade: idx % 3 === 0 ? "advanced" : "simple",
  })),
];

export default function DictionaryTool({ onClose }: DictionaryToolProps) {
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<"all" | "simple" | "advanced">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WORDS.filter((entry) => {
      if (gradeFilter !== "all" && entry.grade !== gradeFilter) return false;
      if (!q) return true;
      return entry.word.toLowerCase().includes(q);
    }).slice(0, 60);
  }, [gradeFilter, query]);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Dictionary</h3>
        <button type="button" aria-label="Close dictionary" className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs" onClick={() => onClose?.()}>Close</button>
      </div>

      <div className="flex gap-2">
        <input aria-label="Search dictionary" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search words" className="flex-1 rounded bg-[var(--ll-bg)] p-2" />
        <select aria-label="Filter dictionary by grade level" className="rounded bg-[var(--ll-bg)] p-2" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as "all" | "simple" | "advanced")}>
          <option value="all">All</option>
          <option value="simple">Simple</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div className="max-h-[45vh] space-y-2 overflow-auto rounded border border-[var(--ll-border)] p-2">
        {results.map((entry) => (
          <article key={`${entry.word}-${entry.definition}`} className="rounded bg-[var(--ll-bg)] p-3">
            <p className="font-semibold">{entry.word}</p>
            <p className="text-xs text-[var(--ll-text-muted)]">{entry.partOfSpeech} - {entry.grade}</p>
            <p className="mt-1">{entry.definition}</p>
            <p className="mt-1 text-xs text-[var(--ll-text)]">Example: {entry.example}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

