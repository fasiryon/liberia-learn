import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OpsIndexPage() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");

  const sections = [
    {
      href: "/admin/ops/health",
      title: "System Health",
      desc: "DB, Redis, AI spend, pipeline, usage, and queue — one-glance platform health",
      disabled: false,
    },
    {
      href: "/admin/ops/curriculum-regeneration",
      title: "Curriculum Regeneration",
      desc: "Monitor and manage lesson regeneration",
      disabled: false,
    },
    {
      href: "/admin/ops/curriculum-review",
      title: "Curriculum Review",
      desc: "Review and approve generated content",
      disabled: false,
    },
    {
      href: "/admin/ops/effectiveness",
      title: "Autonomous OS Effectiveness",
      desc: "Executive summary of whether autonomous operations are working",
      disabled: false,
    },
    {
      href: "/admin/ops/workflows",
      title: "Workflows",
      desc: "Autonomous workflow runs and status",
      disabled: false,
    },
    {
      href: "/admin/ops/detectors",
      title: "Detectors",
      desc: "Operational intelligence detectors",
      disabled: false,
    },
    {
      href: "/admin/ops/signals",
      title: "Signal Coverage",
      desc: "LearningEvent product signal freshness and detector evidence coverage",
      disabled: false,
    },
    {
      href: "/admin/ops/predictions",
      title: "Predictive Intelligence",
      desc: "Governance-safe forecasts, trajectories, and confidence evidence",
      disabled: false,
    },
    {
      href: "/admin/ops/early-warnings",
      title: "Early Warnings",
      desc: "Approval-gated warning queue generated from real product signals",
      disabled: false,
    },
    {
      href: "/admin/ops/prediction-review",
      title: "Prediction Review",
      desc: "Human review queue and outcome feedback for forecast calibration",
      disabled: false,
    },
    {
      href: "/admin/ops/forecast-calibration",
      title: "Forecast Calibration",
      desc: "Forecast accuracy, false-positive, missed-risk, and confidence movement",
      disabled: false,
    },
    {
      href: "/admin/ops/forecasting",
      title: "Forecasting Analytics",
      desc: "Aggregate-safe institutional forecast confidence and outcomes",
      disabled: false,
    },
    {
      href: "/admin/ops/runtime",
      title: "Runtime Dashboard",
      desc: "Production health, workers, queue, cron, and recovery",
      disabled: false,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-[var(--ll-text)] mb-2">Operations</h1>
      <p className="text-sm text-[var(--ll-text-muted)] mb-8">
        Platform operational tools and monitoring.
      </p>
      <div className="space-y-3">
        {sections.map((s) => (
          <div
            key={s.href}
            className={`ll-section p-4 rounded-xl ${s.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {s.disabled ? (
              <div>
                <p className="text-sm font-medium text-[var(--ll-text)]">{s.title}</p>
                <p className="text-xs text-[var(--ll-text-faint)] mt-0.5">
                  {s.desc} — requires migration
                </p>
              </div>
            ) : (
              <Link href={s.href}>
                <p className="text-sm font-medium text-[var(--ll-text)] hover:text-[var(--ll-yellow)]">
                  {s.title}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)] mt-0.5">{s.desc}</p>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
