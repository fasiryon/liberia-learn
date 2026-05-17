"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TEACHER_STEPS = [
  {
    element: "[data-tour='dashboard']",
    popover: {
      title: "Your Dashboard",
      description: "See class performance, recent submissions, and alerts at a glance.",
      side: "bottom" as const,
    },
  },
  {
    element: "[data-tour='lessons']",
    popover: {
      title: "Lessons",
      description: "Browse and assign AI-generated lessons aligned to the Liberian MOE curriculum.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='assignments']",
    popover: {
      title: "Assignments",
      description: "Create assignments, review submissions, and approve AI-graded work.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='gradebook']",
    popover: {
      title: "Gradebook",
      description: "Track grades and generate term report cards with one click.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='messages']",
    popover: {
      title: "Messages",
      description: "Communicate with guardians directly from here.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='ai-tutor']",
    popover: {
      title: "AI Tutor",
      description: "Students can ask the AI tutor questions — you can review flagged conversations.",
      side: "left" as const,
    },
  },
  {
    element: "[data-tour='settings']",
    popover: {
      title: "Settings",
      description: "Set your alert preferences and notification options.",
      side: "left" as const,
    },
  },
];

export function TeacherTour({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const d = driver({
      showProgress: true,
      animate: true,
      steps: TEACHER_STEPS,
      onDestroyStarted: () => {
        d.destroy();
        onComplete();
      },
      onDestroyed: () => onComplete(),
    });
    d.drive();
    return () => {
      try { d.destroy(); } catch { /* ignore */ }
    };
  }, []);
  return null;
}
