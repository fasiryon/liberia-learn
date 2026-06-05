import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getProductMetricsDashboard,
  type MetricValue,
  type ProductMetricsPeriod,
} from "@/lib/reporting/productMetrics";
import { AdminDistrictLeagueSection } from "@/components/league/AdminDistrictLeagueSection";

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
  if (metric.trend === "up") return { text: `+${metric.delta.toFixed(1)}`, className: "text-[var(--ll-yellow)]" };
  if (metric.trend === "down") return { text: metric.delta.toFixed(1), className: "text-[var(--ll-danger)]" };
  return { text: "0.0", className: "text-[var(--ll-text-muted)]" };
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
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-bold text-[var(--ll-text)]">{formatMetricValue(label, metric)}</p>
        <p className={`text-sm font-semibold ${trend.className}`}>{trend.text}</p>
      </div>
      <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
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
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#2563eb20,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-silver)]">LiberiaLearn Product Metrics</p>
            <h1 className="text-3xl font-bold">
              {data.scope === "national" ? "National Product Metrics" : "School Product Metrics"}
            </h1>
            <p className="max-w-3xl text-sm text-[var(--ll-text-muted)]">
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
                    ? "border-cyan-400 bg-[var(--ll-silver-soft)] text-[var(--ll-text-faint)]"
                    : "border-[var(--ll-border)] bg-[var(--ll-bg)]/80 text-[var(--ll-text)] hover:border-[var(--ll-border)]"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Learning Outcomes</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Completion, mastery, and assessment</h2>
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
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Engagement</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Assignments, guardians, AI, and interventions</h2>
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
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Platform Activity</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Exports and active-user coverage</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Moe Export Count" metric={data.platformMetrics.moeExportCount} />
            <MetricCard label="Active Students Percent" metric={data.platformMetrics.activeStudentsPercent} />
            <MetricCard label="Active Teachers Percent" metric={data.platformMetrics.activeTeachersPercent} />
          </div>
        </section>

        {schoolId && <AdminDistrictLeagueSection schoolId={schoolId} />}
      </div>
    </main>
  );
}
