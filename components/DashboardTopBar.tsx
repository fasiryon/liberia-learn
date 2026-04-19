import React from "react";
import {
  GraduationCap,
  BookOpen,
  Building2,
  Heart,
  Landmark,
  LogOut,
  Shield,
} from "lucide-react";

type Props = {
  roleLabel: string;
  roleBadgeBg: string;
  roleAccent: string;
  userName?: string | null;
  subtitle?: string | null;
  rightSlot?: React.ReactNode;
};

function RoleIcon({ roleLabel }: { roleLabel: string }) {
  const lower = roleLabel.toLowerCase();
  const cls = "h-3.5 w-3.5 shrink-0";
  if (lower.includes("student")) return <GraduationCap className={cls} strokeWidth={1.5} />;
  if (lower.includes("teacher")) return <BookOpen className={cls} strokeWidth={1.5} />;
  if (lower.includes("admin")) return <Building2 className={cls} strokeWidth={1.5} />;
  if (lower.includes("guardian")) return <Heart className={cls} strokeWidth={1.5} />;
  if (lower.includes("ministry") || lower.includes("moe")) return <Landmark className={cls} strokeWidth={1.5} />;
  return <Shield className={cls} strokeWidth={1.5} />;
}

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
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-muted)] ${roleBadgeBg}`}
        >
          <RoleIcon roleLabel={roleLabel} />
          {roleLabel}
        </span>
        {userName && (
          <div className="hidden sm:block">
            <p className={`text-sm font-semibold ${roleAccent}`}>{userName}</p>
            {subtitle && <p className="text-xs text-[var(--ll-text-faint)]">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {rightSlot}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="ll-interactive inline-flex items-center gap-1.5 rounded-lg border border-[var(--ll-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-muted)] hover:bg-[var(--ll-surface-muted)] hover:text-[var(--ll-text)] focus-visible:outline-none"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
