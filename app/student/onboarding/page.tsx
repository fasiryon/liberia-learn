"use client";

import { BookOpen, WifiOff, MessageCircle, BarChart2, Award } from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import type { OnboardingStep } from "@/components/onboarding/OnboardingChecklist";

const STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: "Start today's lesson",
    description: "Find your lessons for the day and begin learning.",
    actionLabel: "Go to lessons",
    href: "/student/today",
    Icon: BookOpen,
  },
  {
    step: 2,
    title: "Save a lesson for offline",
    description: "Save lessons so you can study even without internet.",
    actionLabel: "See offline lessons",
    href: "/student/offline-lessons",
    Icon: WifiOff,
  },
  {
    step: 3,
    title: "Ask the AI tutor",
    description: "Get help understanding any topic from your lesson.",
    actionLabel: "Try a lesson",
    href: "/student/today",
    Icon: MessageCircle,
  },
  {
    step: 4,
    title: "View your progress",
    description: "See how you are doing across all your subjects.",
    actionLabel: "View progress",
    href: "/student/progress",
    Icon: BarChart2,
  },
  {
    step: 5,
    title: "Earn a certificate",
    description: "Complete lessons and pass exams to earn certificates.",
    actionLabel: "View certificates",
    href: "/student/certificates",
    Icon: Award,
  },
];

export default function StudentOnboardingPage() {
  return (
    <main className="ll-dashboard-shell">
      <OnboardingChecklist
        title="Welcome to LiberiaLearn"
        subtitle="Follow these steps to get started with your learning."
        steps={STEPS}
        primaryAction={{ label: "Start learning", href: "/student/today" }}
        secondaryAction={{ label: "Skip to dashboard", href: "/dashboard" }}
        accentColor="yellow"
      />
    </main>
  );
}
