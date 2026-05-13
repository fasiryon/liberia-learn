"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen, BarChart2, Award, Star, FlaskConical, Flame, Copy, Check } from "lucide-react";

type PortfolioData = {
  firstName: string;
  fullName: string | null;
  gradeLevel: number | null;
  schoolName: string | null;
  lessonsCompleted: number;
  quizAverage: number | null;
  certificatesEarned: number;
  badgesEarned: number;
  labSessions: number;
  dayStreak: number;
  subjectsStudied: string[];
  badges: { key: string; title: string }[];
  certificates: { id: string; type: string; awardedAt: string; certificateCode: string; canvaUrl: string | null }[];
  capstoneProjects: { id: string; title: string; status: string; submittedAt: string | null }[];
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-amber-500/20 text-amber-300",
  APPROVED: "bg-emerald-500/20 text-emerald-300",
  REJECTED: "bg-red-500/20 text-red-300",
  DRAFT: "bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]",
};

export default function StudentPortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/portfolio", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch("/api/student/portfolio/share", { method: "POST" });
      if (res.ok) {
        const { shareUrl: url } = await res.json();
        setShareUrl(url);
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-5xl space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
          ))}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="ll-dashboard-shell px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-[var(--ll-text-muted)]">Could not load portfolio.</p>
        </div>
      </main>
    );
  }

  const quizPct = data.quizAverage != null ? `${Math.round(data.quizAverage * 100)}%` : "—";

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <Link href="/student/today" className="text-xs text-[var(--ll-yellow)]">
          &larr; Today
        </Link>

        {/* Header */}
        <div className="ll-section p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--ll-text)]">{data.fullName ?? data.firstName}</h1>
              <p className="text-sm text-[var(--ll-text-muted)]">
                {data.gradeLevel ? `Grade ${data.gradeLevel}` : ""}{data.gradeLevel && data.schoolName ? " · " : ""}{data.schoolName ?? ""}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {!shareUrl ? (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
                >
                  {sharing ? "Generating..." : "Share Portfolio"}
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-xs">
                  <span className="max-w-[200px] truncate text-[var(--ll-text-muted)]">{shareUrl}</span>
                  <button type="button" onClick={handleCopy} className="shrink-0 text-[var(--ll-yellow)]">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Lessons", value: data.lessonsCompleted, Icon: BookOpen },
            { label: "Quiz Avg", value: quizPct, Icon: BarChart2 },
            { label: "Certificates", value: data.certificatesEarned, Icon: Award },
            { label: "Badges", value: data.badgesEarned, Icon: Star },
            { label: "Lab Sessions", value: data.labSessions, Icon: FlaskConical },
            { label: "Day Streak", value: data.dayStreak, Icon: Flame },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="ll-section flex items-center gap-3 p-4">
              <Icon className="h-5 w-5 shrink-0 text-[var(--ll-yellow)]" strokeWidth={1.5} />
              <div>
                <p className="text-xl font-bold text-[var(--ll-text)]">{value}</p>
                <p className="text-xs text-[var(--ll-text-muted)]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Badges */}
        {data.badges.length > 0 && (
          <div className="ll-section p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">Badges Earned</h2>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((b) => (
                <span
                  key={b.key}
                  title={b.title}
                  className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-xs text-[var(--ll-text)]"
                >
                  ⭐ {b.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Subjects */}
        {data.subjectsStudied.length > 0 && (
          <div className="ll-section p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">Subjects Studied</h2>
            <div className="flex flex-wrap gap-2">
              {data.subjectsStudied.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[var(--ll-yellow)]/10 px-3 py-1 text-xs font-medium text-[var(--ll-yellow)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certificates */}
        {data.certificates.length > 0 && (
          <div className="ll-section p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">Certificates</h2>
            <div className="flex flex-col gap-2">
              {data.certificates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--ll-text)]">{c.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[var(--ll-text-faint)]">{new Date(c.awardedAt).toLocaleDateString()}</p>
                  </div>
                  {c.canvaUrl && (
                    <a
                      href={c.canvaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[var(--ll-yellow)] hover:underline"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capstone projects */}
        {data.capstoneProjects.length > 0 && (
          <div className="ll-section p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">Capstone Projects</h2>
            <div className="flex flex-col gap-2">
              {data.capstoneProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-2"
                >
                  <p className="text-sm text-[var(--ll-text)]">{p.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[p.status] ?? STATUS_COLORS.DRAFT}`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/student/capstone"
          className="inline-block rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
        >
          Manage Capstone Project →
        </Link>
      </div>
    </main>
  );
}
