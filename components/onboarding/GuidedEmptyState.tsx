"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen } from "lucide-react";

export type GuidedEmptyStateAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type GuidedEmptyStateProps = {
  Icon?: LucideIcon;
  heading: string;
  body: string;
  actions: GuidedEmptyStateAction[];
  hint?: string;
};

export function GuidedEmptyState({
  Icon = BookOpen,
  heading,
  body,
  actions,
  hint,
}: GuidedEmptyStateProps) {
  const primary = actions.find((a) => a.primary) ?? actions[0];
  const secondaries = actions.filter((a) => a !== primary);

  return (
    <div
      data-testid="guided-empty-state"
      className="ll-section flex flex-col items-center px-6 py-10 text-center"
    >
      <Icon
        className="mb-4 h-10 w-10 text-[var(--ll-text-faint)]"
        strokeWidth={1.25}
      />
      <h2 className="text-base font-semibold text-[var(--ll-text)]">{heading}</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--ll-text-muted)]">{body}</p>

      {primary && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <Link
            href={primary.href}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--ll-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] transition-opacity hover:opacity-90"
          >
            {primary.label}
          </Link>
          {secondaries.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="text-xs text-[var(--ll-text-faint)] underline-offset-2 hover:text-[var(--ll-text-muted)] hover:underline"
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}

      {hint && (
        <p className="mt-4 max-w-xs text-xs leading-5 text-[var(--ll-text-faint)]">{hint}</p>
      )}
    </div>
  );
}
