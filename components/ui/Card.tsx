// components/ui/Card.tsx
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/30 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  valueClassName = "text-emerald-300",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-semibold ${valueClassName}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      )}
    </Card>
  );
}
