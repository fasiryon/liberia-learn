"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Summary = {
  lessonViews: number;
  homeworkSubmits: number;
  tutorMessages: number;
  homeworkComplete: number;
};

type DailyActive = { date: string; users: number };
type TopLesson = { contentId: string; views: number };

type AnalyticsData = {
  period: { days: number; since: string };
  summary: Summary;
  dailyActive: DailyActive[];
  topLessons: TopLesson[];
};

const DAY_OPTIONS = [7, 30, 90] as const;

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?days=${days}`)
      .then((res) => {
        if (!res.ok) {
          setData({ summary: {}, dailyActive: [], topLessons: [] } as unknown as AnalyticsData);
          setLoading(false);
          return;
        }
        return res.json().then((d) => setData(d));
      })
      .catch(() => { setLoading(false); })
      .finally(() => setLoading(false));
  }, [days]);

  const cards = data
    ? [
        { label: "Lesson Views", value: data?.summary?.lessonViews ?? 0 },
        { label: "Homework Submitted", value: data?.summary?.homeworkSubmits ?? 0 },
        { label: "AI Tutor Messages", value: data?.summary?.tutorMessages ?? 0 },
        { label: "Homework Completed", value: data?.summary?.homeworkComplete ?? 0 },
      ]
    : null;

  const maxViews =
    data?.topLessons?.length
      ? Math.max(...data.topLessons.map((l) => Number(l.views)))
      : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header + Days Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Analytics Dashboard
          </h1>
          <div className="flex gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  days === d
                    ? "bg-emerald-500 text-slate-950"
                    : "border border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Spinner while initial load */}
        {loading && !data && (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}

        {/* Summary Cards */}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards!.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <p className="text-xs text-slate-400">{c.label}</p>
                  {loading ? (
                    <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-800" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-emerald-400">
                      {c.value.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Daily Active Students */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">
                Daily Active Students
              </h2>
              {data.dailyActive.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.dailyActive}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 8,
                        color: "#e2e8f0",
                        fontSize: 13,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">
                  No activity data for this period.
                </p>
              )}
            </div>

            {/* Top Lessons */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">
                Most Viewed Lessons (Top 10)
              </h2>
              {data.topLessons.length > 0 ? (
                <ul className="space-y-3">
                  {data.topLessons.map((l, i) => (
                    <li key={l.contentId} className="flex items-center gap-3">
                      <span className="w-5 text-right text-xs text-slate-500">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 truncate max-w-[70%]">
                            {l.contentId}
                          </span>
                          <span className="text-slate-400">
                            {Number(l.views).toLocaleString()} views
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${(Number(l.views) / maxViews) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  No lesson views recorded yet.
                </p>
              )}
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-slate-600">
              Data refreshed on page load. Showing last {days} days.
            </p>
          </>
        )}
      </div>
    </div>
  );
}


