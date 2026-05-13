import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildPortfolioSummary } from "@/lib/portfolio/buildPortfolio";
import { BookOpen, BarChart2, Award, Star, FlaskConical, Flame } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = { params: { shareCode: string } };

export default async function PublicPortfolioPage({ params }: Props) {
  const share = await (prisma as any).portfolioShare.findUnique({
    where: { shareCode: params.shareCode },
    select: { studentId: true, isActive: true },
  });

  if (!share || !share.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] text-[var(--ll-text)]">
        <div className="text-center">
          <p className="text-lg font-semibold">This portfolio is no longer available</p>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">The link may have expired or been removed.</p>
        </div>
      </main>
    );
  }

  let summary;
  try {
    summary = await buildPortfolioSummary(share.studentId);
  } catch {
    notFound();
  }

  const quizPct = summary.quizAverage != null ? `${Math.round(summary.quizAverage * 100)}%` : "—";

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-10 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ll-yellow)]/10 text-2xl font-bold text-[var(--ll-yellow)]">
            {summary.firstName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-xl font-bold">{summary.firstName}</h1>
          <p className="text-sm text-[var(--ll-text-muted)]">
            {summary.gradeLevel ? `Grade ${summary.gradeLevel}` : ""}
            {summary.gradeLevel && summary.schoolName ? " · " : ""}
            {summary.schoolName ?? ""}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Lessons", value: summary.lessonsCompleted, Icon: BookOpen },
            { label: "Quiz Avg", value: quizPct, Icon: BarChart2 },
            { label: "Certificates", value: summary.certificatesEarned, Icon: Award },
            { label: "Badges", value: summary.badgesEarned, Icon: Star },
            { label: "Lab Sessions", value: summary.labSessions, Icon: FlaskConical },
            { label: "Day Streak", value: summary.dayStreak, Icon: Flame },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <Icon className="h-5 w-5 shrink-0 text-[var(--ll-yellow)]" strokeWidth={1.5} />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-[var(--ll-text-muted)]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Badges */}
        {summary.badges.length > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-3">
            <h2 className="text-sm font-semibold">Badges Earned</h2>
            <div className="flex flex-wrap gap-2">
              {summary.badges.map((b) => (
                <span
                  key={b.key}
                  className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-xs"
                >
                  ⭐ {b.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Subjects */}
        {summary.subjectsStudied.length > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-3">
            <h2 className="text-sm font-semibold">Subjects Studied</h2>
            <div className="flex flex-wrap gap-2">
              {summary.subjectsStudied.map((s) => (
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

        <p className="text-center text-xs text-[var(--ll-text-faint)]">Powered by LiberiaLearn</p>
      </div>
    </main>
  );
}
