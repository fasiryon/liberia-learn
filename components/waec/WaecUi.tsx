import Link from "next/link";
import { GraduationCap, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import type { SubjectReadiness } from "@/lib/waec/readiness";
import { waecSlug } from "@/lib/waec/syllabus";

/** Prominent, unambiguous WAEC branding banner. */
export function WaecHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="rounded-xl border border-[var(--ll-yellow)]/30 bg-gradient-to-r from-[var(--ll-yellow)]/10 to-transparent p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--ll-yellow)]/15 text-[var(--ll-yellow)]">
          <GraduationCap className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--ll-text)]">WAEC Prep</h1>
            <span className="rounded-full bg-[var(--ll-yellow)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ll-yellow)]">
              WASSCE
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--ll-text-muted)]">
            {subtitle ?? "Your readiness for the West African Senior School Certificate Examination"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ratingColor(readiness: number | null): string {
  if (readiness == null) return "var(--ll-text-faint)";
  if (readiness >= 75) return "#22c55e";
  if (readiness >= 50) return "var(--ll-yellow)";
  return "#f87171";
}

/** SVG readiness ring. */
export function ReadinessRing({ value }: { value: number | null }) {
  const pct = value ?? 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color = ratingColor(value);
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--ll-border)" strokeWidth="6" />
      {value != null && (
        <circle
          cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`} transform="rotate(-90 34 34)"
        />
      )}
      <text x="34" y="38" textAnchor="middle" className="fill-[var(--ll-text)]" fontSize="15" fontWeight="700">
        {value == null ? "—" : `${Math.round(value)}`}
      </text>
    </svg>
  );
}

export function TrendChip({ trend }: { trend: SubjectReadiness["trend"] }) {
  if (trend === "unknown") return null;
  const map = {
    improving: { icon: TrendingUp, label: "Improving", cls: "text-emerald-400" },
    declining: { icon: TrendingDown, label: "Declining", cls: "text-red-400" },
    steady: { icon: Minus, label: "Steady", cls: "text-[var(--ll-text-muted)]" },
  } as const;
  const { icon: Icon, label, cls } = map[trend];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

export function WaecSubjectCard({ r }: { r: SubjectReadiness }) {
  const slug = waecSlug(r.subjectId);
  const clickable = r.available;
  const body = (
    <div
      className={`flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors ${
        clickable
          ? "border-[var(--ll-border)] bg-[var(--ll-surface)] hover:border-[var(--ll-yellow)]"
          : "border-[var(--ll-border)] bg-[var(--ll-surface)]/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--ll-text)]">{r.name}</h3>
          <div className="mt-1">
            {!r.available ? (
              <span className="text-xs text-[var(--ll-text-faint)]">Coming soon</span>
            ) : r.readiness == null ? (
              <span className="text-xs text-[var(--ll-text-muted)]">Take a placement assessment</span>
            ) : (
              <TrendChip trend={r.trend} />
            )}
          </div>
        </div>
        <ReadinessRing value={r.readiness} />
      </div>

      {r.available && r.readiness != null ? (
        <>
          <div className="h-px bg-[var(--ll-border)]" />
          <div className="text-xs text-[var(--ll-text-muted)]">
            <span className="text-[var(--ll-text-faint)]">Next focus:</span>{" "}
            <span className="text-[var(--ll-text)]">{r.nextFocusName ?? "—"}</span>
          </div>
          <div className="text-[11px] text-[var(--ll-text-faint)]">
            Syllabus covered: {Math.round(r.coverage * 100)}%
          </div>
        </>
      ) : r.available ? (
        <div className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--ll-yellow)]">
          Start practice <ArrowRight className="h-3.5 w-3.5" />
        </div>
      ) : (
        <div className="mt-auto text-[11px] text-[var(--ll-text-faint)]">
          Content is being prepared for this subject.
        </div>
      )}
    </div>
  );

  return clickable ? (
    <Link href={`/student/waec/${slug}`} className="block h-full">
      {body}
    </Link>
  ) : (
    <div className="h-full">{body}</div>
  );
}
