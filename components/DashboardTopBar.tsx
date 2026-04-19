import React from "react";

type Props = {
  roleLabel: string;
  roleBadgeBg: string;
  roleAccent: string;
  userName?: string | null;
  subtitle?: string | null;
  rightSlot?: React.ReactNode;
};

export function DashboardTopBar({
  roleLabel,
  roleBadgeBg,
  roleAccent,
  userName,
  subtitle,
  rightSlot,
}: Props) {
  return (
    <header className="flex w-full items-center justify-between gap-4 border-b border-[var(--ll-border)] bg-transparent px-4 py-3 shadow-none">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-950 ${roleBadgeBg}`}
        >
          {roleLabel}
        </span>
        {userName && (
          <div className="hidden sm:block">
            <p className={`text-sm font-semibold ${roleAccent}`}>{userName}</p>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {rightSlot}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-[var(--ll-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-muted)] hover:border-[var(--ll-border-strong)] hover:bg-[var(--ll-surface-muted)] hover:text-[var(--ll-text)] focus-visible:outline-none focus-visible:shadow-[var(--ll-focus)]"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
