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
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  demo: {
    label: "DEMO",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  staging: {
    label: "STAGING",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  development: {
    label: "DEVELOPMENT",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-200",
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
