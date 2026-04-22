"use client";

import { useEffect, useMemo, useState } from "react";

type RangeOption = 7 | 30 | 90;

type ScheduleItem = {
  id: string;
  className: string;
  title: string;
  scheduledDate: string;
  totalStudents: number;
  completedCount: number;
  isDelivered?: boolean;
  completionRate?: number | null;
};

const RANGE_OPTIONS: Array<{ label: string; value: RangeOption }> = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

export function toDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function buildDeliveryReportCsv(rows: ScheduleItem[]) {
  const header = [
    "Lesson Title",
    "Class",
    "Date",
    "Status",
    "Students Assigned",
    "Completed",
    "Rate",
  ];

  const csvRows = rows.map((row) =>
    [
      row.title,
      row.className,
      new Date(row.scheduledDate).toLocaleDateString("en-LR"),
      row.isDelivered ? "Delivered" : "Not Delivered",
      row.totalStudents,
      row.completedCount,
      `${row.totalStudents > 0 ? Math.round((row.completedCount / row.totalStudents) * 100) : 0}%`,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );

  return [header.join(","), ...csvRows].join("\n");
}

function downloadCsv(rows: ScheduleItem[]) {
  const blob = new Blob([buildDeliveryReportCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lesson-delivery-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function TeacherDeliveryReport() {
  const [range, setRange] = useState<RangeOption>(30);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = toDateRange(range);
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/teacher/schedule?from=${from}&to=${to}&deliveredOnly=true`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load delivery report.");
        return data.items ?? [];
      })
      .then((data) => {
        if (!active) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range]);

  const summary = useMemo(() => {
    const totalLessonsDelivered = items.length;
    const totalStudentsReached = items.reduce((sum, item) => sum + item.totalStudents, 0);
    const averageCompletionRate =
      totalLessonsDelivered === 0
        ? 0
        : Math.round(
            items.reduce((sum, item) => {
              return sum + (item.totalStudents > 0 ? item.completedCount / item.totalStudents : 0);
            }, 0) *
              100 /
              totalLessonsDelivered
          );

    return {
      totalLessonsDelivered,
      totalStudentsReached,
      averageCompletionRate,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ll-text)]">Lesson Delivery Report</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Track delivered lessons and completion across your classes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                range === option.value
                  ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                  : "border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)]"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => downloadCsv(items)}
            disabled={items.length === 0}
            className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs text-[var(--ll-text-muted)]">Total Lessons Delivered</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-yellow)]">{summary.totalLessonsDelivered}</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs text-[var(--ll-text-muted)]">Average Completion Rate</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-silver)]">{summary.averageCompletionRate}%</p>
        </div>
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
          <p className="text-xs text-[var(--ll-text-muted)]">Total Students Reached</p>
          <p className="mt-2 text-3xl font-bold text-[var(--ll-yellow)]">{summary.totalStudentsReached}</p>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--ll-surface)]/60" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center text-sm text-[var(--ll-text-muted)]">
          No delivered lessons in this period. Deliver a lesson to see it here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                <th className="px-4 py-3">Lesson Title</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Students Assigned</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const rate = item.totalStudents > 0 ? Math.round((item.completedCount / item.totalStudents) * 100) : 0;
                return (
                  <tr key={item.id} className="border-b border-white/5 text-[var(--ll-text)]">
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3">{item.className}</td>
                    <td className="px-4 py-3">{new Date(item.scheduledDate).toLocaleDateString("en-LR")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.isDelivered
                            ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                            : "bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                        }`}
                      >
                        {item.isDelivered ? "Delivered" : "Not Delivered"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.totalStudents}</td>
                    <td className="px-4 py-3">{item.completedCount}</td>
                    <td className="px-4 py-3">{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
