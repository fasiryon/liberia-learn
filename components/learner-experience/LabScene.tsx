"use client";

import { useEffect, useRef } from "react";
import { FlaskConical, RotateCcw, WifiOff } from "lucide-react";
import type { LabExperience } from "@/lib/learner-experience/labExperience";
import type { LearningExperienceLink } from "@/lib/learner-experience/links";
import type { ExperienceProgress } from "@/lib/learner-experience/progress";
import type { Scene } from "@/lib/learner-experience/types";

const PROFILE_LABEL: Record<string, string> = { HIGH: "Detailed 3D", STANDARD: "Standard 3D", LOW: "Light 3D", FALLBACK_2D: "2D view", STATIC_TEACHER_GUIDED: "Text walkthrough" };

/** LAB scene: one learner concept, "Lab". Runtime tiers are shown only as what the device will do. */
export function LabScene({ scene, lab, link, progress, online, onLaunch, onFallback }: {
  scene: Scene;
  lab: LabExperience | null;
  link: LearningExperienceLink | null;
  progress: ExperienceProgress;
  online: boolean;
  onLaunch: () => void;
  onFallback: () => void;
}) {
  if (scene.interaction.kind !== "LAB_LAUNCH") return null;
  const observation = progress.lab.observation;
  const returned = progress.lab.status === "RETURNED";
  const unavailable = !lab || !link;
  const welcomeRef = useRef<HTMLDivElement>(null);
  // On a phone the return summary is below the fold: bring it into view once, when the learner comes back.
  useEffect(() => { if (returned && observation) welcomeRef.current?.scrollIntoView?.({ block: "center" }); }, [returned, observation]);
  return (
    <div className="mt-6 space-y-4">
      <section aria-labelledby="lab-card-title" className="rounded-2xl border border-[var(--ll-accent)] bg-[var(--ll-surface)] p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ll-accent)] text-[var(--ll-bg)]"><FlaskConical size={22} /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-muted)]">Lab</p>
            <h3 id="lab-card-title" className="text-lg font-semibold leading-7 text-[var(--ll-text)]">{lab?.title ?? "Lab unavailable"}</h3>
            {lab?.summary && <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">{lab.summary}</p>}
          </div>
        </div>
        {lab && lab.release.status !== "RELEASED" && (
          <p className="mt-4 rounded-lg border border-[var(--ll-border)] px-3 py-2 text-xs leading-5 text-[var(--ll-text-muted)]">Internal prototype: this lab is a draft and is not released to students.</p>
        )}
        {returned && observation ? (
          <div ref={welcomeRef} role="status" className="mt-4 rounded-xl bg-[var(--ll-bg)] p-4 text-sm leading-6 text-[var(--ll-text)]">
            <p className="font-semibold">Welcome back. You are where you left the lesson.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Lab checks finished: {observation.completedCheckIds.length} of {observation.totalChecks}</li>
              <li>{observation.tripObserved ? "You saw the plant trip." : "You did not trip the plant this time — the review explains what happens."}</li>
              {observation.tripObserved && <li>{observation.resetObserved ? "You reset the plant after fixing the problem." : "You did not reset the plant yet."}</li>}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onLaunch}
            disabled={unavailable}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ll-accent)] disabled:opacity-50"
          >
            {returned ? <RotateCcw size={18} aria-hidden="true" /> : <FlaskConical size={18} aria-hidden="true" />}
            {returned ? "Go back into the lab" : "Explore in Lab"}
          </button>
          {lab && (
            <p className="text-xs leading-5 text-[var(--ll-text-muted)]">
              Adjusts to your device: {lab.offline.degradation.map((profile) => PROFILE_LABEL[profile] ?? profile).join(" → ")}.
            </p>
          )}
        </div>
        {!online && <p className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--ll-text-muted)]"><WifiOff size={16} aria-hidden="true" /> You are offline. A saved lab still opens; otherwise use the text walkthrough below.</p>}
      </section>
      <details className="rounded-2xl border border-[var(--ll-border)] p-4" open={unavailable || undefined}>
        <summary className="min-h-11 cursor-pointer text-base font-semibold text-[var(--ll-text)]">Can&apos;t open the lab? Use the text walkthrough</summary>
        <p className="mt-3 text-base leading-7 text-[var(--ll-text)]">{scene.accessibility.textAlternative}</p>
        <button type="button" onClick={onFallback} disabled={progress.lab.status === "RETURNED" || progress.lab.status === "FALLBACK_USED"} className="mt-3 min-h-11 rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60">
          {progress.lab.status === "FALLBACK_USED" ? "Walkthrough used" : "I read the walkthrough"}
        </button>
      </details>
    </div>
  );
}
