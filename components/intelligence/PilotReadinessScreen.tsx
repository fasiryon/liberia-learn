import { Card } from "@/components/ui/Card";
import {
  ReadinessChecklist,
  type ReadinessSectionView,
} from "@/components/intelligence/ReadinessChecklist";

type ReadinessIssueView = {
  code: string;
  label: string;
  detail: string;
};

function levelLabel(level: "not_ready" | "partial" | "ready") {
  if (level === "ready") return "Pilot Ready";
  if (level === "partial") return "Partially Ready";
  return "Not Ready";
}

function levelClasses(level: "not_ready" | "partial" | "ready") {
  if (level === "ready") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (level === "partial") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-red-500/20 bg-red-500/10 text-red-200";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function IssueList({
  title,
  items,
}: {
  title: string;
  items: ReadinessIssueView[];
}) {
  const blocking = title.toLowerCase().includes("blocking");
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">None right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.code}
              className={`rounded-2xl border p-4 ${
                blocking
                  ? "border-red-500/15 bg-red-500/8"
                  : "border-amber-500/15 bg-amber-500/8"
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{item.label}</p>
              <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PilotReadinessScreen({
  readinessScore,
  readinessLevel,
  blockingIssues,
  nonBlockingIssues,
  teacherActivationStatus,
  dataFlowStatus,
  guardianStatus,
  sections,
  latestEval,
}: {
  readinessScore: number;
  readinessLevel: "not_ready" | "partial" | "ready";
  blockingIssues: ReadinessIssueView[];
  nonBlockingIssues: ReadinessIssueView[];
  teacherActivationStatus: "not_started" | "active" | "engaged";
  dataFlowStatus: "inactive" | "partial" | "active";
  guardianStatus: "inactive" | "active";
  sections: ReadinessSectionView[];
  latestEval: { runAt: string; passed: boolean } | null;
}) {
  const pilotReady = readinessLevel === "ready" && blockingIssues.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Pilot Readiness</h1>
        <p className="mt-1 text-sm text-slate-400">
          Operational view of whether this school is safe to start a pilot.
        </p>
      </div>

      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Pilot summary</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-50">
              {readinessScore}/100
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {pilotReady ? "Safe to start pilot." : "Fix blockers before pilot."}
            </p>
          </div>
          <span
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${levelClasses(readinessLevel)}`}
          >
            {levelLabel(readinessLevel)}
          </span>
        </div>

        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full bg-slate-950/70">
            <div
              className={`h-full rounded-full ${
                readinessLevel === "ready"
                  ? "bg-emerald-400"
                  : readinessLevel === "partial"
                    ? "bg-amber-400"
                    : "bg-red-400"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, readinessScore))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Readiness score combines activation, data flow, guardian readiness, and blocker state.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Teacher activation</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {statusLabel(teacherActivationStatus)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Student data flow</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {statusLabel(dataFlowStatus)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Guardian activation</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {statusLabel(guardianStatus)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-slate-300">
          {latestEval
            ? latestEval.passed
              ? `Latest eval run passed on ${new Date(latestEval.runAt).toLocaleString("en-LR")}.`
              : `Latest eval run failed on ${new Date(latestEval.runAt).toLocaleString("en-LR")}.`
            : "No eval run has been recorded yet."}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <IssueList title="Blocking issues" items={blockingIssues} />
        <IssueList title="Non-blocking issues" items={nonBlockingIssues} />
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-100">Checklist by readiness area</h2>
        <p className="mt-1 text-sm text-slate-400">
          Each section below shows its score, weight, and the specific checks that are still blocking or incomplete.
        </p>
      </Card>

      <ReadinessChecklist sections={sections} />
    </div>
  );
}
