"use client";

type Props = {
  avgGrade: number;
};

export function AchievementBadge({ avgGrade }: Props) {
  if (avgGrade < 85) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ll-yellow)]/40 bg-[var(--ll-yellow)]/10 px-3 py-1.5">
      <span
        aria-hidden="true"
        className="text-base leading-none text-[var(--ll-yellow)]"
        style={{ display: "inline-block", animation: "ll-star-pulse 1.5s ease-in-out infinite" }}
      >
        &#9733;
      </span>
      <span className="text-xs font-semibold text-[var(--ll-yellow)]">Top Performer</span>
      <style>{`
        @keyframes ll-star-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}
