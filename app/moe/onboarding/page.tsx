import { redirect } from "next/navigation";
import { BarChart2, Map, BookOpen, TrendingUp, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import type { OnboardingStep } from "@/components/onboarding/OnboardingChecklist";

const STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: "View the national dashboard",
    description: "See enrollment, delivery, and performance across all schools.",
    actionLabel: "Open dashboard",
    href: "/moe/dashboard",
    Icon: BarChart2,
  },
  {
    step: 2,
    title: "Review district trends",
    description: "Compare districts and identify where support is needed most.",
    actionLabel: "View districts",
    href: "/moe/districts",
    Icon: Map,
  },
  {
    step: 3,
    title: "Understand curriculum coverage",
    description: "See which subjects and grades are fully covered by the platform.",
    actionLabel: "View curriculum",
    href: "/moe/curriculum",
    Icon: BookOpen,
  },
  {
    step: 4,
    title: "Review AI usage and trust",
    description: "Understand how AI is used across schools and with what reliability.",
    actionLabel: "View AI insights",
    href: "/moe/dashboard",
    Icon: TrendingUp,
  },
  {
    step: 5,
    title: "Review compliance and delivery",
    description: "Check that schools are delivering lessons on the required schedule.",
    actionLabel: "View compliance",
    href: "/moe/compliance",
    Icon: ShieldCheck,
  },
];

export const dynamic = "force-dynamic";

export default async function MoeOnboardingPage() {
  if (!isMoePortalEnabled()) {
    redirect("/login");
  }

  const user = await requireUser();
  if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <OnboardingChecklist
        title="Welcome to the MOE Dashboard"
        subtitle="National education oversight for the Republic of Liberia. Follow these steps to get started."
        steps={STEPS}
        primaryAction={{ label: "Open national dashboard", href: "/moe/dashboard" }}
        secondaryAction={{ label: "Skip", href: "/moe/dashboard" }}
        accentColor="teal"
      />
    </main>
  );
}
