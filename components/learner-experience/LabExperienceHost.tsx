"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InteractiveLabPlayer } from "@/components/interactive-labs/v2/InteractiveLabPlayer";
import type { CapabilityProfile, LabState } from "@/lib/interactive-labs/v2/types";
import { labReturnStorageKey, type LabLaunchContext, type LabReturnObservation } from "@/lib/learner-experience/labLaunch";

type Tracking = { startedAt: number; tripped: boolean; reset: boolean; latest: LabState | null; profile: CapabilityProfile };

/**
 * Hosts a lab entered from a lesson. The lab runtime stays independent: the
 * host only observes presentation state to build a return summary, and always
 * returns to the originating lesson scene (never the Labs library).
 */
export function LabExperienceHost({ context, lessonTitle, sceneTitle, labVersion, totalChecks, returnHref, internalPreview }: {
  context: LabLaunchContext;
  lessonTitle: string;
  sceneTitle: string;
  labVersion: string;
  totalChecks: number;
  returnHref: string;
  internalPreview: boolean;
}) {
  const router = useRouter();
  // Global status toasts clear the lab's phone bottom sheet (its peek is at least 176px).
  useEffect(() => {
    document.documentElement.style.setProperty("--ll-fixed-footer", "11.5rem");
    return () => document.documentElement.style.removeProperty("--ll-fixed-footer");
  }, []);
  const tracking = useRef<Tracking>({ startedAt: Date.now(), tripped: false, reset: false, latest: null, profile: "LOW" });

  const observe = useCallback((latest: LabState | null, exit: LabReturnObservation["exit"]): LabReturnObservation => {
    const t = tracking.current;
    return {
      labId: context.labId, labVersion, linkId: context.linkId,
      completedCheckIds: [...(latest?.completedChecks ?? [])], totalChecks,
      tripObserved: t.tripped, resetObserved: t.reset, finalProfile: t.profile,
      minutesInLab: Math.max(0, Math.round((Date.now() - t.startedAt) / 60000)), exit,
    };
  }, [context.labId, context.linkId, labVersion, totalChecks]);

  const persist = useCallback((summary: LabReturnObservation) => {
    try { window.sessionStorage.setItem(labReturnStorageKey(context.origin.experienceId), JSON.stringify(summary)); } catch { /* storage may be disabled; the scene is still restored */ }
  }, [context.origin.experienceId]);

  const onStateChange = useCallback((state: LabState, profile: CapabilityProfile) => {
    const t = tracking.current;
    const latched = state.fidelity?.variables?.protectionLatched === 1;
    if (latched) t.tripped = true;
    else if (t.tripped) t.reset = true;
    t.latest = state;
    t.profile = profile;
    // Kept current so a browser Back still hands the summary to the lesson.
    persist(observe(state, state.completedChecks.length >= totalChecks ? "COMPLETED" : "RETURNED_EARLY"));
  }, [observe, persist, totalChecks]);

  const returnToLesson = () => {
    const latest = tracking.current.latest;
    persist(observe(latest, (latest?.completedChecks.length ?? 0) >= totalChecks ? "COMPLETED" : "RETURNED_EARLY"));
    router.push(returnHref);
  };

  return (
    <div className="min-h-dvh bg-slate-900" data-lab-host data-origin-scene={context.origin.sceneId}>
      <div className="sticky z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <button type="button" onClick={returnToLesson} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <ArrowLeft size={16} aria-hidden="true" /> Back to lesson
          </button>
          <p className="min-w-0 truncate text-xs text-slate-300">
            <span className="sr-only">You came from </span>{lessonTitle} · <span className="text-slate-400">{sceneTitle}</span>
          </p>
        </div>
      </div>
      <div className="px-2 py-4 sm:px-4">
        <InteractiveLabPlayer labId={context.labId} internalPreview={internalPreview} onStateChange={onStateChange} />
      </div>
    </div>
  );
}
