"use client";

import { useRouter } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import type { TutorIdentity } from "@/lib/ai/tutor/contextContract";

export const OPEN_TUTOR_EVENT = "liberialearn:open-tutor";

/**
 * Opens the grounded student tutor beside the lesson, so the learner keeps their place and the tutor keeps
 * the page's lesson context. The tutor shell answers the event only on pages where it is shown; if nothing
 * answers (tutor switched off, or a page that owns its own help panel), it falls back to the tutor page.
 * It sends nothing itself: questions go through the tutor's existing grounded, authorized route.
 */
export function AskTutorButton({ label = "Ask the AI tutor about this lesson", className = "ll3-btn w-full", identity }: { label?: string; className?: string; identity?: TutorIdentity }) {
  const router = useRouter();
  const open = () => {
    const detail = { handled: false, identity };
    window.dispatchEvent(new CustomEvent(OPEN_TUTOR_EVENT, { detail }));
    // Native help must not silently discard its scene on a different page.
    if (!detail.handled && !identity) router.push("/student/ai-tutor");
  };
  return <button type="button" className={className} onClick={open}><MessageCircleQuestion size={18} aria-hidden="true" /> {label}</button>;
}
