import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getProductMetricsDashboard,
  type MetricValue,
  type ProductMetricsPeriod,
} from "@/lib/reporting/productMetrics";

export const dynamic = "force-dynamic";

const PERIODS: ProductMetricsPeriod[] = ["7d", "30d", "90d"];

function parsePeriod(value?: string): ProductMetricsPeriod {
  return PERIODS.includes(value as ProductMetricsPeriod) ? (value as ProductMetricsPeriod) : "30d";
}

function formatMetricValue(label: string, metric: MetricValue) {
  if (label === "Moe Export Count") return metric.value.toLocaleString("en-US");
  return `${metric.value.toFixed(1)}%`;
}

function trendBadge(metric: MetricValue) {
  if (metric.trend === "up") return { text: `+${metric.delta.toFixed(1)}`, className: "text-emerald-300" };
  if (metric.trend === "down") return { text: metric.delta.toFixed(1), className: "text-rose-300" };
  return { text: "0.0", className: "text-slate-400" };
}

function MetricCard({
  label,
  metric,
}: {
  label: string;
  metric: MetricValue;
}) {
  const trend = trendBadge(metric);
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-bold text-slate-100">{formatMetricValue(label, metric)}</p>
        <p className={`text-sm font-semibold ${trend.className}`}>{trend.text}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Previous period {formatMetricValue(label, metric).includes("%") ? `${metric.previousValue.toFixed(1)}%` : metric.previousValue.toFixed(0)}
      </p>
    </div>
  );
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    redirect("/");
  }

  const schoolId = user.isPlatformAdmin ? user.schoolId ?? null : user.schoolId ?? null;
  if (!schoolId && !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const period = parsePeriod(searchParams?.period);
  const data = await getProductMetricsDashboard({ period, schoolId });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#2563eb20,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-cyan-300">LiberiaLearn Product Metrics</p>
            <h1 className="text-3xl font-bold">
              {data.scope === "national" ? "National Product Metrics" : "School Product Metrics"}
            </h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Learning outcomes, guardian engagement, AI adoption, and active usage with period-over-period trend signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((option) => (
              <Link
                key={option}
                href={`/admin/metrics?period=${option}`}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
                  option === period
                    ? "border-cyan-400 bg-cyan-400 text-slate-950"
                    : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-500"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Learning Outcomes</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">Completion, mastery, and assessment</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Lesson Completion Rate" metric={data.learningOutcomes.lessonCompletionRate} />
            <MetricCard label="Exam Completion Rate" metric={data.learningOutcomes.examCompletionRate} />
            <MetricCard label="Exam Pass Rate" metric={data.learningOutcomes.examPassRate} />
            <MetricCard label="Average Exam Score" metric={data.learningOutcomes.avgExamScore} />
            <MetricCard label="Mastery Progress Rate" metric={data.learningOutcomes.masteryProgressRate} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Engagement</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">Assignments, guardians, AI, and interventions</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Assignment Submission Rate" metric={data.engagement.assignmentSubmissionRate} />
            <MetricCard label="Guardian Engagement Rate" metric={data.engagement.guardianEngagementRate} />
            <MetricCard label="AI Tutor Adoption Rate" metric={data.engagement.aiTutorAdoptionRate} />
            <MetricCard label="Teacher AI Assist Adoption Rate" metric={data.engagement.teacherAiAssistAdoptionRate} />
            <MetricCard label="Intervention Acceptance Rate" metric={data.engagement.interventionAcceptanceRate} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Platform Activity</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">Exports and active-user coverage</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Moe Export Count" metric={data.platformMetrics.moeExportCount} />
            <MetricCard label="Active Students Percent" metric={data.platformMetrics.activeStudentsPercent} />
            <MetricCard label="Active Teachers Percent" metric={data.platformMetrics.activeTeachersPercent} />
          </div>
        </section>
      </div>
    </main>
  );
}
