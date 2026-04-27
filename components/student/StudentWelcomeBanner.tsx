"use client";

import { useState, useEffect } from "react";
import { BookOpen, ClipboardCheck, Users } from "lucide-react";
import { RoleWelcomePanel } from "@/components/onboarding/RoleWelcomePanel";

const STORAGE_KEY = "student_welcome_completed";

type Props = {
  lessonsThisWeek: number;
  studentName?: string;
};

export function StudentWelcomeBanner({ lessonsThisWeek, studentName }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    setDismissed(!!stored);
  }, []);

  if (dismissed || lessonsThisWeek > 0) return null;

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setDismissed(true);
  }

  return (
    <div className="relative">
      <RoleWelcomePanel
        role="student"
        name={studentName}
        capabilities={[
          {
            label: "View today's lessons",
            description: "Complete your scheduled lessons and earn progress.",
          },
          {
            label: "Take quizzes and assignments",
            description: "Test your understanding with AI-graded assessments.",
          },
          {
            label: "Track your mastery",
            description: "See your strengths and areas that need more practice.",
          },
        ]}
        primaryAction={{ label: "Start today's lesson", href: "/student/today" }}
      />
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
      >
        Dismiss
      </button>
    </div>
  );
}
