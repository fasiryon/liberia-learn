import { Card } from "@/components/ui/Card";

export function IntelligenceStatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{subtitle}</p> : null}
    </Card>
  );
}
