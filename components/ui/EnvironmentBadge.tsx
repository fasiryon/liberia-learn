import { getEnvironment, type AppEnvironment } from "@/lib/environment";

type EnvironmentBadgeProps = {
  environment: AppEnvironment;
};

export function getEnvironmentBadgeValue() {
  return getEnvironment();
}

const STYLES: Record<AppEnvironment, { label: string; className: string }> = {
  production: {
    label: "PRODUCTION",
    className: "border-emerald-500/30 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]",
  },
  demo: {
    label: "DEMO",
    className: "border-amber-500/30 bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]",
  },
  staging: {
    label: "STAGING",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  development: {
    label: "DEVELOPMENT",
    className: "border-[var(--ll-border)]/30 bg-[var(--ll-surface-muted)]/10 text-[var(--ll-text)]",
  },
};

export function EnvironmentBadge({ environment }: EnvironmentBadgeProps) {
  const config = STYLES[environment];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${config.className}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
