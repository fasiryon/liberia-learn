"use client";

import Link from "next/link";

export type RoleCapability = {
  label: string;
  description: string;
};

export type RoleWelcomePanelProps = {
  role: "student" | "teacher" | "admin" | "guardian" | "moe";
  name?: string;
  capabilities: RoleCapability[];
  primaryAction: { label: string; href: string };
};

const ROLE_META = {
  student: {
    greeting: "Welcome to LiberiaLearn",
    tagline: "Your learning journey starts here.",
    accentCls: "text-[var(--ll-accent)]",
    borderCls: "border-[var(--ll-accent)]/30",
    bgCls: "bg-[var(--ll-accent-soft)]",
  },
  teacher: {
    greeting: "Welcome, Teacher",
    tagline: "Your classroom is ready for you.",
    accentCls: "text-[var(--ll-yellow)]",
    borderCls: "border-[var(--ll-yellow)]/30",
    bgCls: "bg-[var(--ll-yellow-soft)]",
  },
  admin: {
    greeting: "Welcome, School Administrator",
    tagline: "Manage your school and track progress.",
    accentCls: "text-teal-400",
    borderCls: "border-teal-400/30",
    bgCls: "bg-teal-500/10",
  },
  guardian: {
    greeting: "Welcome, Guardian",
    tagline: "Stay connected with your child's learning.",
    accentCls: "text-blue-400",
    borderCls: "border-blue-400/30",
    bgCls: "bg-blue-500/10",
  },
  moe: {
    greeting: "Welcome, MOE Official",
    tagline: "Monitor national education at a glance.",
    accentCls: "text-purple-400",
    borderCls: "border-purple-400/30",
    bgCls: "bg-purple-500/10",
  },
} as const;

export function RoleWelcomePanel({
  role,
  name,
  capabilities,
  primaryAction,
}: RoleWelcomePanelProps) {
  const meta = ROLE_META[role];

  return (
    <div
      data-testid="role-welcome-panel"
      data-role={role}
      className={`rounded-xl border ${meta.borderCls} ${meta.bgCls} p-6`}
    >
      <div className="space-y-1">
        <h2 className={`text-xl font-bold ${meta.accentCls}`}>
          {meta.greeting}{name ? `, ${name}` : ""}
        </h2>
        <p className="text-sm text-[var(--ll-text-muted)]">{meta.tagline}</p>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ll-text-faint)]">
          What you can do here
        </p>
        <ul className="mt-2 space-y-2">
          {capabilities.map((cap) => (
            <li key={cap.label} className="flex items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.accentCls} bg-current`} />
              <div>
                <span className="text-sm font-medium text-[var(--ll-text)]">{cap.label}</span>
                {cap.description && (
                  <span className="text-sm text-[var(--ll-text-muted)]"> — {cap.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <Link
          href={primaryAction.href}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--ll-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] transition-opacity hover:opacity-90"
        >
          {primaryAction.label}
        </Link>
      </div>
    </div>
  );
}
