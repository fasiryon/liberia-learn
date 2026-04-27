"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickStartCard = {
  title: string;
  description: string;
  href: string;
  Icon: LucideIcon;
  badge?: string;
};

export type RoleQuickStartCardsProps = {
  heading?: string;
  cards: QuickStartCard[];
};

export function RoleQuickStartCards({
  heading = "Quick start",
  cards,
}: RoleQuickStartCardsProps) {
  return (
    <div data-testid="role-quick-start-cards">
      {heading && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)]">
          {heading}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ title, description, href, Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="ll-section group flex items-start gap-4 p-5 transition-colors hover:border-[var(--ll-border-strong)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ll-surface-muted)] transition-colors group-hover:bg-[var(--ll-accent-soft)]">
              <Icon
                className="h-4 w-4 text-[var(--ll-text-faint)] transition-colors group-hover:text-[var(--ll-accent)]"
                strokeWidth={1.5}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--ll-text)]">{title}</p>
                {badge && (
                  <span className="rounded-full bg-[var(--ll-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ll-accent)]">
                    {badge}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
