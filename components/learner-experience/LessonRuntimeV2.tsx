"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LessonPlayerV2, type LessonPlayerRuntime } from "./LessonPlayerV2";
import { sceneTools, type SceneToolView } from "@/lib/learner-experience/tools";
import { PRESENTATION_ONLY_EVIDENCE, returnSceneFromSearch, type EvidenceChannel, type LessonRouteTarget, type LessonUnavailableReason, type NativeLessonRuntime } from "@/lib/learner-experience/lessonRuntime";

/**
 * A server-authorized native lesson on a student lesson route. Lab links, release, version and completion
 * come from the resolved server response; evidence leaves the device only through an injected server
 * channel (none is connected yet, so lessons are presentation-only).
 */
export function NativeLessonRuntimeView({ lesson, target, exitHref, enabledToolIds, evidence = PRESENTATION_ONLY_EVIDENCE }: {
  lesson: NativeLessonRuntime;
  target: LessonRouteTarget;
  exitHref: string;
  enabledToolIds: readonly string[];
  evidence?: EvidenceChannel;
}) {
  // Read once: the player strips the lab-return parameters from the address after restoring the scene.
  const [returnSceneId] = useState(() => (typeof window === "undefined" ? null : returnSceneFromSearch(new URLSearchParams(window.location.search))));
  const toolsByScene = useMemo<Record<string, readonly SceneToolView[]>>(
    () => Object.fromEntries(lesson.experience.scenes.map((scene) => [scene.id, sceneTools(scene, enabledToolIds)])),
    [lesson.experience, enabledToolIds],
  );
  const runtime = useMemo<LessonPlayerRuntime>(
    () => ({ identity: lesson.identity, availability: lesson.availability, target, labLinks: lesson.labLinks, evidence, evidenceDisposition: lesson.evidenceDisposition, serverCompletion: lesson.serverCompletion }),
    [lesson, target, evidence],
  );
  return <LessonPlayerV2 experience={lesson.experience} toolsByScene={toolsByScene} exitHref={exitHref} returnSceneId={returnSceneId} runtime={runtime} />;
}

const UNAVAILABLE_COPY: Record<LessonUnavailableReason, Readonly<{ title: string; body: string }>> = {
  NOT_FOUND: { title: "This lesson isn't available to you", body: "It may not be released yet or assigned to your class, or it may have been moved. Ask your teacher if you think you should have it." },
  REVOKED: { title: "This lesson was withdrawn", body: "Your school or the curriculum team took this lesson out of use, so it can no longer be opened here." },
  NOT_RELEASED: { title: "This lesson isn't released yet", body: "It is still being reviewed and cannot be opened by students until it is released." },
  NOT_STUDENT_READY: { title: "This lesson isn't ready for students", body: "Something in this lesson needs to be fixed before students can use it. Your teacher can tell you what to work on instead." },
  INCOMPATIBLE_VERSION: { title: "This saved copy can't be opened", body: "It was saved by a different version of the app. Connect to the internet to get the current version of the lesson." },
  OFFLINE_NOT_CACHED: { title: "This lesson isn't saved on this device", body: "Connect to the internet to open it the first time. After that it can be saved for offline use." },
  LOAD_FAILED: { title: "This lesson didn't load", body: "Please try again in a moment." },
};

/** An honest unavailable state with a way out (focused lesson routes hide the main navigation). */
export function LessonUnavailable({ reason, exitHref = "/student/learn" }: { reason: LessonUnavailableReason; exitHref?: string }) {
  const copy = UNAVAILABLE_COPY[reason];
  return (
    <main className="ll-lesson-v2 min-h-dvh bg-[var(--ll-bg)] px-4 py-10 text-[var(--ll-text)]" data-lesson-unavailable={reason}>
      <section aria-labelledby="lesson-unavailable-title" className="mx-auto max-w-xl rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6">
        <h1 id="lesson-unavailable-title" className="text-2xl font-semibold leading-tight">{copy.title}</h1>
        <p className="mt-3 text-base leading-7 text-[var(--ll-text-muted)]">{copy.body}</p>
        <Link href={exitHref} className="mt-6 inline-flex min-h-[var(--pdv2-target,48px)] items-center gap-1 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-bg)]">
          <ChevronLeft size={18} aria-hidden="true" /> Back to Learn
        </Link>
      </section>
    </main>
  );
}
