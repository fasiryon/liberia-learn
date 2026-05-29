"use client";

/**
 * components/adaptive/MasteryBadge.tsx  — NR-14B Phase 4
 *
 * Visual indicator for a student's mastery progress on a skill.
 *
 * Variants:
 *   - in-progress: circular progress ring showing score (0–100%)
 *   - mastered: green "Mastered ✓" badge with masteredAt date
 *   - not-started: grey ring at 0%
 *
 * Props:
 *   score      0..1 rolling EMA score
 *   mastered   true if masteredAt is set
 *   masteredAt ISO date string or Date
 *   size       "sm" | "md" (default "sm")
 *   label      optional skill label
 */

type MasteryBadgeProps = {
  score?: number;
  mastered?: boolean;
  masteredAt?: string | Date | null;
  size?: "sm" | "md";
  label?: string;
};

const SIZE = {
  sm: { r: 14, stroke: 3, dim: 36, font: "text-xs" },
  md: { r: 22, stroke: 4, dim: 56, font: "text-sm" },
};

export function MasteryBadge({
  score = 0,
  mastered = false,
  masteredAt = null,
  size = "sm",
  label,
}: MasteryBadgeProps) {
  const { r, stroke, dim, font } = SIZE[size];
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, score));
  const dashOffset = circumference * (1 - pct);

  const masteredDate = masteredAt
    ? new Date(masteredAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  if (mastered) {
    return (
      <span
        title={masteredDate ? `Mastered on ${masteredDate}` : "Mastered"}
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 ${font}`}
        aria-label={`${label ? label + ": " : ""}Mastered${masteredDate ? " on " + masteredDate : ""}`}
      >
        <svg
          className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        Mastered
        {masteredDate && <span className="opacity-70">· {masteredDate}</span>}
      </span>
    );
  }

  // Progress ring
  const ringColor = pct >= 0.6 ? "stroke-amber-500" : pct >= 0.3 ? "stroke-sky-400" : "stroke-slate-300";
  const bgColor = pct >= 0.6 ? "text-amber-600" : pct >= 0.3 ? "text-sky-600" : "text-slate-400";

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Mastery: ${Math.round(pct * 100)}%`}
      aria-label={`${label ? label + ": " : ""}Mastery ${Math.round(pct * 100)}%`}
    >
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          className="stroke-slate-200"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          className={ringColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className={`${font} font-semibold ${bgColor}`}
          style={{ fontSize: size === "sm" ? 9 : 12, fill: "currentColor" }}
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label && <span className={`${font} text-slate-600`}>{label}</span>}
    </span>
  );
}
