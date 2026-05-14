"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type WeekEntry = {
  weekLabel: string;
  weekStart: string;
  lessonsCompleted: number;
  quizAvg: number | null;
  streakDays: number;
};

export function WeeklyProgressChart({ data }: { data: WeekEntry[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
        8-Week Progress
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ll-border)" vertical={false} />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 10, fill: "var(--ll-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ll-text-muted)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--ll-surface)",
              border: "1px solid var(--ll-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--ll-text)", fontWeight: 600 }}
            itemStyle={{ color: "var(--ll-text-muted)" }}
            formatter={(value: number, name: string) => {
              if (name === "lessonsCompleted") return [value, "Lessons"];
              if (name === "quizAvg") return [`${value}%`, "Quiz Avg"];
              return [value, name];
            }}
          />
          <Bar
            dataKey="lessonsCompleted"
            name="Lessons"
            fill="var(--ll-yellow)"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
