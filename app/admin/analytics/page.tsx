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
type MultimediaAnalytics = {
  lessonModeUsage: Array<{ mode: "read" | "slides" | "listen"; count: number; percentage: number }>;
  studentEngagement: { activeLearners: number; totalEvents: number; lessonInteractions: number; quizSubmissions: number };
  audioUsage: { playbackStarts: number; generated: number; pending: number; processing: number; failed: number; estimatedCostUsd: number };
  videoUsage: { playbackStarts: number; uploaded: number; active: number };
};
type AdminIntelligence = {
  classPerformanceDistribution: Array<{ label: string; count: number }>;
  engagementLevels: {
    totalStudents: number;
    activeStudents: number;
    activeRatePct: number;
    lessonStarts: number;
    lessonCompletions: number;
    completionRatePct: number;
  };
  teacherEffectiveness: Array<{
    teacherId: string;
    teacherName: string;
    classCount: number;
    scheduledLessons: number;
    deliveredLessons: number;
    deliveryRatePct: number;
    lessonCompletionRatePct: number;
    averageQuizScorePct: number | null;
  }>;
  weakSubjects: Array<{
    subject: string;
    averageQuizScorePct: number | null;
    lessonCompletionRatePct: number;
    attempts: number;
    scheduledLessons: number;
    reason: string;
  }>;
  lowCompletionClasses: Array<{
    classId: string;
    className: string;
    subject: string;
    completionRatePct: number;
    scheduledLessons: number;
  }>;
};

type AnalyticsData = {
  period: { days: number; since: string };
  summary: Summary;
  dailyActive: DailyActive[];
  topLessons: TopLesson[];
  multimedia: MultimediaAnalytics;
  intelligence: AdminIntelligence | null;
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
    <div className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] px-4 py-8 sm:px-8">
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
                    ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                    : "border border-[var(--ll-border)] text-[var(--ll-text)] hover:border-[var(--ll-border)]"
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
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5"
                >
                  <p className="text-xs text-[var(--ll-text-muted)]">{c.label}</p>
                  {loading ? (
                    <div className="mt-2 h-7 w-20 animate-pulse rounded bg-[var(--ll-surface)]" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-[var(--ll-yellow)]">
                      {c.value.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Multimedia</p>
                <h2 className="text-sm font-semibold text-[var(--ll-text)]">Lesson Mode Usage</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(data.multimedia?.lessonModeUsage ?? []).map((row) => (
                  <div key={row.mode} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold capitalize text-[var(--ll-text)]">{row.mode}</p>
                      <p className="text-sm text-[var(--ll-yellow)]">{row.percentage.toFixed(1)}%</p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[var(--ll-surface-muted)]">
                      <div className="h-2 rounded-full bg-[var(--ll-yellow)]" style={{ width: `${Math.min(100, row.percentage)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--ll-text-muted)]">{row.count.toLocaleString()} mode changes</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Active learners", data.multimedia?.studentEngagement.activeLearners ?? 0],
                  ["Lesson events", data.multimedia?.studentEngagement.lessonInteractions ?? 0],
                  ["Audio starts", data.multimedia?.audioUsage.playbackStarts ?? 0],
                  ["Generated audio", data.multimedia?.audioUsage.generated ?? 0],
                  ["Audio cost", `$${(data.multimedia?.audioUsage.estimatedCostUsd ?? 0).toFixed(4)}`],
                  ["Video starts", data.multimedia?.videoUsage.playbackStarts ?? 0],
                  ["Active videos", data.multimedia?.videoUsage.active ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                    <p className="text-xs text-[var(--ll-text-muted)]">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--ll-silver)]">
                      {typeof value === "number" ? value.toLocaleString() : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                  School intelligence
                </p>
                <h2 className="text-sm font-semibold text-[var(--ll-text)]">
                  Performance And Engagement
                </h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Active students", data.intelligence?.engagementLevels.activeStudents ?? 0],
                  ["Active rate", `${data.intelligence?.engagementLevels.activeRatePct ?? 0}%`],
                  ["Lesson starts", data.intelligence?.engagementLevels.lessonStarts ?? 0],
                  ["Lesson completion", `${data.intelligence?.engagementLevels.completionRatePct ?? 0}%`],
                  ["Weak subjects", data.intelligence?.weakSubjects.length ?? 0],
                  ["Low-completion classes", data.intelligence?.lowCompletionClasses.length ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                    <p className="text-xs text-[var(--ll-text-muted)]">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--ll-silver)]">
                      {typeof value === "number" ? value.toLocaleString() : value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--ll-text)]">
                    Class Performance Distribution
                  </h3>
                  <div className="mt-4 space-y-3">
                    {(data.intelligence?.classPerformanceDistribution ?? []).map((band) => {
                      const total = (data.intelligence?.classPerformanceDistribution ?? []).reduce(
                        (sum, row) => sum + row.count,
                        0
                      );
                      const width = total > 0 ? (band.count / total) * 100 : 0;
                      return (
                        <div key={band.label}>
                          <div className="flex justify-between text-xs text-[var(--ll-text-muted)]">
                            <span>{band.label}%</span>
                            <span>{band.count} classes</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-[var(--ll-surface-muted)]">
                            <div className="h-2 rounded-full bg-[var(--ll-yellow)]" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--ll-text)]">
                    Teacher Effectiveness Proxy
                  </h3>
                  <div className="mt-4 space-y-3">
                    {(data.intelligence?.teacherEffectiveness ?? []).slice(0, 5).map((teacher) => (
                      <div key={teacher.teacherId} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--ll-text)]">{teacher.teacherName}</p>
                          <p className="text-sm text-[var(--ll-yellow)]">
                            {teacher.lessonCompletionRatePct}%
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                          Delivery {teacher.deliveryRatePct}% &middot; Quiz{" "}
                          {teacher.averageQuizScorePct == null ? "--" : `${teacher.averageQuizScorePct}%`}
                        </p>
                      </div>
                    ))}
                    {(data.intelligence?.teacherEffectiveness ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-muted)]">
                        No teacher effectiveness data for this period.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--ll-text)]">
                    Weak Subjects
                  </h3>
                  <div className="mt-4 space-y-2">
                    {(data.intelligence?.weakSubjects ?? []).slice(0, 5).map((subject) => (
                      <p key={subject.subject} className="text-sm text-[var(--ll-text-muted)]">
                        <span className="font-semibold text-[var(--ll-text)]">{subject.subject}</span>: {subject.reason}
                      </p>
                    ))}
                    {(data.intelligence?.weakSubjects ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-muted)]">
                        No weak subject signal for this period.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--ll-text)]">
                    Low-Completion Classes
                  </h3>
                  <div className="mt-4 space-y-2">
                    {(data.intelligence?.lowCompletionClasses ?? []).slice(0, 5).map((row) => (
                      <p key={row.classId} className="text-sm text-[var(--ll-text-muted)]">
                        <span className="font-semibold text-[var(--ll-text)]">{row.className}</span>: {row.completionRatePct}% completion
                      </p>
                    ))}
                    {(data.intelligence?.lowCompletionClasses ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-muted)]">
                        No low-completion class signal for this period.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Active Students */}
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6">
              <h2 className="mb-4 text-sm font-semibold text-[var(--ll-text)]">
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
                <p className="py-12 text-center text-sm text-[var(--ll-text-faint)]">
                  No activity data for this period.
                </p>
              )}
            </div>

            {/* Top Lessons */}
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6">
              <h2 className="mb-4 text-sm font-semibold text-[var(--ll-text)]">
                Most Viewed Lessons (Top 10)
              </h2>
              {data.topLessons.length > 0 ? (
                <ul className="space-y-3">
                  {data.topLessons.map((l, i) => (
                    <li key={l.contentId} className="flex items-center gap-3">
                      <span className="w-5 text-right text-xs text-[var(--ll-text-faint)]">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--ll-text)] truncate max-w-[70%]">
                            {l.contentId}
                          </span>
                          <span className="text-[var(--ll-text-muted)]">
                            {Number(l.views).toLocaleString()} views
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-[var(--ll-surface)]">
                          <div
                            className="h-full rounded-full bg-[var(--ll-yellow)]"
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
                <p className="py-8 text-center text-sm text-[var(--ll-text-faint)]">
                  No lesson views recorded yet.
                </p>
              )}
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-[var(--ll-text-faint)]">
              Data refreshed on page load. Showing last {days} days.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
