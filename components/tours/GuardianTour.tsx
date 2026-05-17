"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const GUARDIAN_STEPS = [
  {
    element: "[data-tour='child-progress']",
    popover: {
      title: "Child Progress",
      description: "See a summary of your child's learning progress, mastery, and activity.",
      side: "bottom" as const,
    },
  },
  {
    element: "[data-tour='attendance']",
    popover: {
      title: "Attendance",
      description: "Check your child's attendance record and any absences.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='grades']",
    popover: {
      title: "Grades",
      description: "View grades on assignments and assessments by subject.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='messages']",
    popover: {
      title: "Messages",
      description: "Send and receive messages directly with your child's teacher.",
      side: "right" as const,
    },
  },
  {
    element: "[data-tour='report-cards']",
    popover: {
      title: "Report Cards",
      description: "Download official term report cards when they are published.",
      side: "left" as const,
    },
  },
];

export function GuardianTour({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const d = driver({
      showProgress: true,
      animate: true,
      steps: GUARDIAN_STEPS,
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
