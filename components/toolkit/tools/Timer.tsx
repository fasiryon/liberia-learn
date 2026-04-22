"use client";

import { useEffect, useMemo, useState } from "react";

interface TimerProps {
  onClose?: () => void;
  assessmentMode?: boolean;
}

function format(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function Timer({ onClose, assessmentMode = false }: TimerProps) {
  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState(false);

  const totalCountdown = minutes * 60 + seconds;
  const displaySeconds = mode === "countdown" ? Math.max(0, totalCountdown - elapsed) : elapsed;

  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(handle);
  }, [running]);

  useEffect(() => {
    if (mode === "countdown" && running && totalCountdown - elapsed <= 0) {
      setRunning(false);
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1500);
      return () => window.clearTimeout(t);
    }
  }, [elapsed, mode, running, totalCountdown]);

  const progress = useMemo(() => {
    if (mode === "stopwatch") {
      return Math.min(100, (elapsed % 60) * (100 / 60));
    }
    if (totalCountdown === 0) return 0;
    return Math.max(0, Math.min(100, ((totalCountdown - elapsed) / totalCountdown) * 100));
  }, [elapsed, mode, totalCountdown]);

  return (
    <div className={`space-y-3 ${flash ? "animate-pulse" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Timer</h3>
        <button
          type="button"
          aria-label="Close timer"
          disabled={assessmentMode}
          className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs disabled:opacity-50"
          onClick={() => {
            if (!assessmentMode) onClose?.();
          }}
        >
          {assessmentMode ? "Locked" : "Close"}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button type="button" aria-label="Countdown mode" className="rounded border border-[var(--ll-border)] px-2 py-1" onClick={() => { setMode("countdown"); setElapsed(0); }}>
          Countdown
        </button>
        <button type="button" aria-label="Stopwatch mode" className="rounded border border-[var(--ll-border)] px-2 py-1" onClick={() => { setMode("stopwatch"); setElapsed(0); }}>
          Stopwatch
        </button>
      </div>

      {mode === "countdown" && (
        <div className="flex items-center gap-2 text-xs">
          <label>
            Min
            <input aria-label="Timer minutes" type="number" className="ml-1 w-14 rounded bg-[var(--ll-bg)] p-1" value={minutes} onChange={(e) => setMinutes(Math.max(0, Number(e.target.value || 0)))} />
          </label>
          <label>
            Sec
            <input aria-label="Timer seconds" type="number" className="ml-1 w-14 rounded bg-[var(--ll-bg)] p-1" value={seconds} onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value || 0))))} />
          </label>
        </div>
      )}

      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-8 border-[var(--ll-border)] text-4xl font-bold" style={{ background: `conic-gradient(#34d399 ${progress}%, #0f172a ${progress}% 100%)` }}>
        <span aria-label="Timer display" className="rounded bg-[var(--ll-bg)]/80 px-3 py-1 text-center text-3xl">{format(displaySeconds)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-label="Start or pause timer" className="rounded bg-[var(--ll-yellow-soft)] px-3 py-2 text-sm font-semibold" onClick={() => setRunning((v) => !v)}>
          {running ? "Pause" : "Start"}
        </button>
        <button type="button" aria-label="Reset timer" className="rounded border border-[var(--ll-border)] px-3 py-2 text-sm" onClick={() => { setRunning(false); setElapsed(0); }}>
          Reset
        </button>
      </div>
    </div>
  );
}
