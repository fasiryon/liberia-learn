"use client";

import { useRouter } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";

export const OPEN_TUTOR_EVENT = "liberialearn:open-tutor";

/**
 * Opens the grounded student tutor beside the lesson, so the learner keeps their place and the tutor keeps
 * the page's lesson context. The tutor shell answers the event only on pages where it is shown; if nothing
 * answers (tutor switched off, or a page that owns its own help panel), it falls back to the tutor page.
 * It sends nothing itself: questions go through the tutor's existing grounded, authorized route.
 */
export function AskTutorButton({ label = "Ask the AI tutor about this lesson", className = "ll3-btn w-full" }: { label?: string; className?: string }) {
  const router = useRouter();
  const open = () => {
    const detail = { handled: false };
    window.dispatchEvent(new CustomEvent(OPEN_TUTOR_EVENT, { detail }));
    if (!detail.handled) router.push("/student/ai-tutor");
  };
  return <button type="button" className={className} onClick={open}><MessageCircleQuestion size={18} aria-hidden="true" /> {label}</button>;
}
