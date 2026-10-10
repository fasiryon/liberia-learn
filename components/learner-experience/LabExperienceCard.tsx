import Link from "next/link";
import { labExperienceHref, type LabExperience } from "@/lib/learner-experience/labExperience";
import type { LabSessionSummary } from "@/lib/learner-experience/labsTab";

const KIND_LABEL: Record<LabExperience["runtime"]["kind"], string> = {
  LEGACY_SIMULATION: "Simulation",
  PRACTICAL_GUIDED: "Hands-on",
  INTERACTIVE_V2: "3D explore",
};

/** One card for every lab, whatever runtime runs it. */
export function LabExperienceCard({ lab, session, reason }: { lab: LabExperience; session: LabSessionSummary | null; reason: string | null }) {
  // A session row exists from assignment (startedAt defaults to creation), so it cannot tell "started" apart.
  const action = session?.completedAt ? "Review lab" : session ? "Go to lab" : "Open lab";
  return (
    <article className="flex min-h-56 flex-col rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4" data-lab-runtime={lab.runtime.kind}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
        <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[var(--ll-text-muted)]">{lab.subject}</span>
        <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[var(--ll-text-faint)]">{KIND_LABEL[lab.runtime.kind]}</span>
        {lab.offline.offlineCapable && <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[var(--ll-text-faint)]">Works offline</span>}
      </div>
      <h3 className="mt-3 text-base font-semibold leading-6 text-[var(--ll-text)]">{lab.title}</h3>
      {lab.gradeBands.length > 0 && <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{lab.gradeBands.join(", ")}</p>}
      {reason && <p className="mt-2 text-xs font-medium text-[var(--ll-accent)]">{reason}</p>}
      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--ll-text-muted)]">{lab.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ll-text-faint)]">
        {lab.estimatedMinutes != null && <span>{lab.estimatedMinutes} min</span>}
        {session?.completedAt && <span>Completed</span>}
      </div>
      <Link href={session ? `${labExperienceHref(lab)}?session=${encodeURIComponent(session.sessionId)}` : labExperienceHref(lab)} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90">
        {action}<span className="sr-only">: {lab.title}</span>
      </Link>
    </article>
  );
}
