"use client";

import { BarChart2, MessageCircle, BookOpen, Phone, Users } from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import type { OnboardingStep } from "@/components/onboarding/OnboardingChecklist";

const STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: "View your child's progress",
    description: "See how your child is performing in each subject.",
    actionLabel: "View progress",
    href: "/guardian/progress",
    Icon: BarChart2,
  },
  {
    step: 2,
    title: "Read messages from the school",
    description: "Check messages and updates from teachers and administrators.",
    actionLabel: "Read messages",
    href: "/guardian/messages",
    Icon: MessageCircle,
  },
  {
    step: 3,
    title: "Understand AI tutor support",
    description: "Learn how the AI tutor helps your child with lessons.",
    actionLabel: "Learn more",
    href: "/guardian/dashboard",
    Icon: BookOpen,
  },
  {
    step: 4,
    title: "Update your contact details",
    description: "Make sure the school has your current phone number.",
    actionLabel: "Update settings",
    href: "/guardian/settings",
    Icon: Phone,
  },
  {
    step: 5,
    title: "Link additional children",
    description: "If you have more than one child at this school, link them here.",
    actionLabel: "Manage links",
    href: "/guardian/link",
    Icon: Users,
  },
];

export default function GuardianOnboardingPage() {
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <OnboardingChecklist
        title="Welcome to LiberiaLearn"
        subtitle="Stay connected with your child's education. Follow these steps to get started."
        steps={STEPS}
        primaryAction={{ label: "View my child's progress", href: "/guardian/progress" }}
        secondaryAction={{ label: "Skip to dashboard", href: "/guardian/dashboard" }}
        accentColor="teal"
      />
    </main>
  );
}
