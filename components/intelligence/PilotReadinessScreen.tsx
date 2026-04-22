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
  if (level === "ready") return "border-emerald-500/20 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]";
  if (level === "partial") return "border-amber-500/20 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]";
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
      <h2 className="text-lg font-semibold text-[var(--ll-text)]">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--ll-text-muted)]">None right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.code}
              className={`rounded-xl border p-4 ${
                blocking
                  ? "border-red-500/15 bg-red-500/8"
                  : "border-amber-500/15 bg-[var(--ll-yellow-soft)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--ll-text)]">{item.label}</p>
              <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{item.detail}</p>
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
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Pilot Readiness</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Operational view of whether this school is safe to start a pilot.
        </p>
      </div>

      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--ll-text-muted)]">Pilot summary</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">
              {readinessScore}/100
            </h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
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
          <div className="h-3 overflow-hidden rounded-full bg-[var(--ll-bg)]/70">
            <div
              className={`h-full rounded-full ${
                readinessLevel === "ready"
                  ? "bg-[var(--ll-yellow-soft)]"
                  : readinessLevel === "partial"
                    ? "bg-[var(--ll-yellow-soft)]"
                    : "bg-red-400"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, readinessScore))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
            Readiness score combines activation, data flow, guardian readiness, and blocker state.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-[var(--ll-bg)]/60 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Teacher activation</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">
              {statusLabel(teacherActivationStatus)}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--ll-bg)]/60 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Student data flow</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">
              {statusLabel(dataFlowStatus)}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--ll-bg)]/60 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Guardian activation</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">
              {statusLabel(guardianStatus)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-[var(--ll-text)]">
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
        <h2 className="text-lg font-semibold text-[var(--ll-text)]">Checklist by readiness area</h2>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          Each section below shows its score, weight, and the specific checks that are still blocking or incomplete.
        </p>
      </Card>

      <ReadinessChecklist sections={sections} />
    </div>
  );
}
