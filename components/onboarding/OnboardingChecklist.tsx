"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type OnboardingStep = {
  step: number;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  Icon: LucideIcon;
};

export type OnboardingChecklistProps = {
  title: string;
  subtitle: string;
  steps: OnboardingStep[];
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  onComplete?: () => void | Promise<void>;
  accentColor?: "yellow" | "teal" | "blue";
};

const ACCENT_STYLES = {
  yellow: {
    iconBg: "bg-[var(--ll-yellow-soft)]",
    iconColor: "text-[var(--ll-yellow)]",
    stepBadge: "text-[var(--ll-yellow)]",
    primaryBtn: "bg-[var(--ll-yellow)] text-black hover:opacity-90",
    stepDot: "bg-[var(--ll-yellow)]",
  },
  teal: {
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-400",
    stepBadge: "text-teal-400",
    primaryBtn: "bg-teal-500 text-white hover:bg-teal-400",
    stepDot: "bg-teal-400",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    stepBadge: "text-blue-400",
    primaryBtn: "bg-blue-500 text-white hover:bg-blue-400",
    stepDot: "bg-blue-400",
  },
} as const;

export function OnboardingChecklist({
  title,
  subtitle,
  steps,
  primaryAction,
  secondaryAction,
  accentColor = "yellow",
}: OnboardingChecklistProps) {
  const accent = ACCENT_STYLES[accentColor];

  return (
    <div data-testid="onboarding-checklist" className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
          Getting started
        </p>
        <h1 className="text-2xl font-bold text-[var(--ll-text)] sm:text-3xl">{title}</h1>
        <p className="text-sm leading-6 text-[var(--ll-text-muted)]">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {steps.map(({ step, title: stepTitle, description, actionLabel, href, Icon }) => (
          <div
            key={step}
            data-testid={`onboarding-step-${step}`}
            className="ll-section flex items-start gap-4 p-5"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accent.iconBg}`}
            >
              <Icon className={`h-4 w-4 ${accent.iconColor}`} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)]`}
                >
                  Step {step}
                </span>
                <h2 className="text-sm font-semibold text-[var(--ll-text)]">{stepTitle}</h2>
              </div>
              <p className="mt-0.5 text-sm text-[var(--ll-text-muted)]">{description}</p>
            </div>
            <Link
              href={href}
              className="shrink-0 rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs font-medium text-[var(--ll-text-muted)] transition-colors hover:border-[var(--ll-border-strong)] hover:text-[var(--ll-text)]"
            >
              {actionLabel}
            </Link>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          href={primaryAction.href}
          className={`min-h-11 w-full max-w-xs rounded-full px-6 py-2.5 text-center text-sm font-semibold transition-opacity ${accent.primaryBtn}`}
        >
          {primaryAction.label}
        </Link>
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}
