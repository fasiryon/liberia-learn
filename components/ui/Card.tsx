import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  valueClassName = "text-[var(--ll-text)]",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{subtitle}</p>
      )}
    </Card>
  );
}
