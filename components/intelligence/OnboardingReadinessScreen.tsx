import Link from "next/link";
import { Card } from "@/components/ui/Card";

function readinessTone(level: "not_ready" | "partial" | "ready") {
  if (level === "ready") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (level === "partial") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-red-500/20 bg-red-500/10 text-red-200";
}

export function OnboardingReadinessScreen({
  steps,
  percentComplete,
  missingSteps,
  readinessScore,
  readinessLevel,
}: {
  steps: Array<{
    id: string;
    title: string;
    complete: boolean;
    href: string;
    missing: string[];
  }>;
  percentComplete: number;
  missingSteps: string[];
  readinessScore: number;
  readinessLevel: "not_ready" | "partial" | "ready";
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Onboarding Readiness</h1>
        <p className="mt-1 text-sm text-slate-400">
          Follow the real next steps needed to move a school into pilot operation.
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">Progress</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-50">
              {percentComplete}%
            </h2>
            <p className="mt-2 text-sm text-slate-400">Readiness score {readinessScore}/100</p>
          </div>
          <span
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${readinessTone(
              readinessLevel
            )}`}
          >
            {readinessLevel.replace(/_/g, " ")}
          </span>
        </div>

        {missingSteps.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-100">Missing steps</p>
            {missingSteps.map((step) => (
              <p key={step} className="text-sm text-slate-400">
                - {step}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            Every onboarding step is backed by live system evidence.
          </p>
        )}
      </Card>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Step {index + 1}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">
                  {step.title}
                </h2>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  step.complete
                    ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-300"
                    : "border-amber-500/20 bg-amber-500/15 text-amber-300"
                }`}
              >
                {step.complete ? "Complete" : "Incomplete"}
              </span>
            </div>

            {step.missing.length > 0 ? (
              <div className="mt-4 space-y-2">
                {step.missing.map((item) => (
                  <p key={item} className="text-sm text-slate-400">
                    - {item}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                This step has been completed with real system signals.
              </p>
            )}

            <Link
              href={step.href}
              className="mt-4 inline-flex min-h-10 items-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
            >
              Open step
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
