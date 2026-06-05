"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDashboardData } from "@/lib/moe/liveDashboard";

const REFRESH_INTERVAL_MS = 60_000;

function BigStat({
  value,
  label,
  color = "text-white",
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-start">
      <span className={`text-6xl font-black leading-none tracking-tight ${color}`}>
        {value}
      </span>
      <span className="mt-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
    </div>
  );
}

function CountyBar({
  name,
  completionPct,
  rank,
}: {
  name: string;
  completionPct: number;
  rank: number;
}) {
  const colors = [
    "bg-amber-400",
    "bg-emerald-400",
    "bg-sky-400",
    "bg-violet-400",
    "bg-rose-400",
  ];
  const bar = colors[rank] ?? "bg-slate-400";
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 text-right text-xs font-bold text-slate-500">
        {rank + 1}
      </span>
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">{name}</span>
          <span className="text-sm font-bold text-white">{completionPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700">
          <div
            className={`h-2 rounded-full ${bar} transition-all duration-1000`}
            style={{ width: `${Math.min(100, completionPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  item,
  index,
}: {
  item: LiveDashboardData["recent"][number];
  index: number;
}) {
  const ago = Math.round(
    (Date.now() - new Date(item.completedAt).getTime()) / 60000
  );
  const agoLabel = ago <= 0 ? "just now" : ago === 1 ? "1 min ago" : `${ago} min ago`;
  return (
    <div
      className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-4 py-3"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white">
          {item.studentInitial}{" "}
          <span className="font-normal text-slate-400">
            ({item.grade})
          </span>
        </p>
        <span className="shrink-0 text-xs text-slate-500">{agoLabel}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-400">
        {item.lessonTitle} — {item.schoolName}
      </p>
    </div>
  );
}

function PulseDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

export default function LiveDashboardClient({
  initialData,
  token,
}: {
  initialData: LiveDashboardData | null;
  token: string | null;
}) {
  const [data, setData] = useState<LiveDashboardData | null>(initialData);
  const [secondsSince, setSecondsSince] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const fetchRef = useRef<(() => Promise<void>) | null>(null);

  const buildApiUrl = useCallback(() => {
    const base = "/api/moe/live";
    return token ? `${base}?token=${token}` : base;
  }, [token]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(), { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSecondsSince(0);
      }
    } catch {
      // Keep stale data on network error
    }
  }, [buildApiUrl]);

  fetchRef.current = fetchData;

  useEffect(() => {
    // Auto-refresh every 60s
    const refreshTimer = setInterval(() => {
      fetchRef.current?.();
    }, REFRESH_INTERVAL_MS);

    // Elapsed counter every second
    const tickTimer = setInterval(() => {
      setSecondsSince((s) => s + 1);
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  }, []);

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const updatedLabel =
    secondsSince < 5
      ? "Live"
      : secondsSince < 60
        ? `Updated ${secondsSince}s ago`
        : `Updated ${Math.floor(secondsSince / 60)}m ago`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#080e1c] font-sans">
      {/* Top banner */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-700/60 bg-[#0b1120] px-8 py-3">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-sm font-black text-[#080e1c]">
            L
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              LiberiaLearn — Live
            </p>
            <p className="text-xs text-slate-400">
              National Education Platform
            </p>
          </div>
        </div>

        <p className="text-base font-semibold text-slate-200">
          {dateStr}
        </p>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
            <PulseDot />
            <span className="text-xs font-semibold text-emerald-400">
              {updatedLabel}
            </span>
          </div>
          <p className="w-24 text-right font-mono text-sm text-slate-300">
            {timeStr}
          </p>
        </div>
      </header>

      {/* 4-quadrant grid */}
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-px bg-slate-700/30">
        {/* Q1: National roll-up */}
        <div className="flex flex-col justify-between bg-[#0b1120] p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              National Roll-Up
            </p>
            <BigStat
              value={data?.national.activeNow.toLocaleString() ?? "—"}
              label="Students Active Now"
              color="text-amber-400"
            />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-black text-white">
                {data?.national.totalEnrolled.toLocaleString() ?? "—"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Enrolled
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">
                {data?.national.schoolsLive.toLocaleString() ?? "—"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Schools
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">
                {data?.national.countiesLive.toLocaleString() ?? "—"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Counties Live
              </p>
            </div>
          </div>
        </div>

        {/* Q2: Today's completion */}
        <div className="flex flex-col justify-between bg-[#0b1120] p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Today&apos;s Progress
            </p>
            <BigStat
              value={`${data?.today.completionPct ?? "—"}%`}
              label="Lessons Completed"
              color="text-emerald-400"
            />
          </div>
          <div className="mt-4">
            <div className="h-3 w-full rounded-full bg-slate-700">
              <div
                className="h-3 rounded-full bg-emerald-400 transition-all duration-1000"
                style={{ width: `${Math.min(100, data?.today.completionPct ?? 0)}%` }}
              />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-black text-white">
                {data?.today.lessonsOpened.toLocaleString() ?? "—"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Lessons Opened
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">
                {data?.today.quizzesSubmitted.toLocaleString() ?? "—"}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Quizzes Submitted
              </p>
            </div>
          </div>
        </div>

        {/* Q3: Top counties */}
        <div className="flex flex-col bg-[#0b1120] p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Top Counties — Completion Rate Today
          </p>
          {data?.counties && data.counties.length > 0 ? (
            <div className="mt-6 flex-1 space-y-5">
              {data.counties.map((c, i) => (
                <CountyBar
                  key={c.name}
                  name={c.name}
                  completionPct={c.completionPct}
                  rank={i}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-1 items-center justify-center">
              <p className="text-sm text-slate-500">
                County data populates as lessons are delivered.
              </p>
            </div>
          )}
        </div>

        {/* Q4: Live activity stream */}
        <div className="flex flex-col bg-[#0b1120] p-8">
          <div className="flex items-center gap-2">
            <PulseDot />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Live Activity Stream
            </p>
          </div>
          {data?.recent && data.recent.length > 0 ? (
            <div className="mt-4 flex-1 space-y-3 overflow-hidden">
              {data.recent.map((item, i) => (
                <ActivityRow key={`${item.completedAt}-${i}`} item={item} index={i} />
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-1 items-center justify-center">
              <p className="text-sm text-slate-500">
                Activity appears here as students complete lessons.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
