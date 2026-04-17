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
    <header className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-slate-900/70 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950 ${roleBadgeBg}`}
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
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-slate-50"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
