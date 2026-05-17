"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const STUDENT_STEPS = [
  {
    element: "[data-tour='my-lessons']",
    popover: {
      title: "My Lessons",
      description: "Your daily lessons are here. Work through them at your own pace.",
      side: "bottom" as const,
    },
  },
  {
    element: "[data-tour='homework']",
    popover: {
      title: "Homework",
      description: "Submit assignments and see your teacher's feedback and grades.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='ai-tutor']",
    popover: {
      title: "AI Tutor",
      description: "Stuck on a topic? Ask the AI tutor for help anytime.",
      side: "left" as const,
    },
  },
  {
    element: "[data-tour='portfolio']",
    popover: {
      title: "Portfolio",
      description: "Your completed work and achievements are saved here.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='leaderboard']",
    popover: {
      title: "Leaderboard",
      description: "See how you rank in your class for completed lessons and scores.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='offline']",
    popover: {
      title: "Offline Mode",
      description: "Save lessons to study without internet. Your progress syncs when you reconnect.",
      side: "top" as const,
    },
  },
];

export function StudentTour({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const d = driver({
      showProgress: true,
      animate: true,
      steps: STUDENT_STEPS,
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
