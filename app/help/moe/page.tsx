import Link from "next/link";

const STEPS = [
  {
    title: "1. Sign in to the MOE portal",
    body: `Use your Ministry-issued Google account. You will land on the national overview dashboard, which shows aggregated data across all pilot schools.`,
  },
  {
    title: "2. Read the national coverage matrix",
    body: `The Coverage page shows which grades and subjects have approved curriculum. Green cells meet the national gate (≥50% lessons approved). Red cells need curriculum work before that grade can be assessed.`,
  },
  {
    title: "3. Drill into a school report",
    body: `From the Schools list, click any school to see its pilot readiness score, active student count, lesson completion rates by subject, and recent AI cost usage.`,
  },
  {
    title: "4. Export data for reporting",
    body: `On the national or school report page, click Export CSV to download a spreadsheet-ready file. The export includes grade, subject, completion rate, and assessment scores for every enrolled student.`,
  },
  {
    title: "5. Review submitted MOE reports",
    body: `Schools submit formal reports under MOE Submissions. Each submission shows the reporting period, the school principal's signature, and the data used. You can approve or request revision.`,
  },
  {
    title: "6. Monitor AI curriculum quality",
    body: `The Content Review page (read-only for MOE) shows every AI-generated lesson alongside its approval status. Use it to spot-check curriculum before a school assessment.`,
  },
];

export default function MoeHelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-3">
        <Link href="/help" className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
          ← Help
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">MOE Official Guide</h1>
        <p className="mt-2 text-[var(--ll-text-muted)]">
          Read school performance reports, track national coverage, and review curriculum quality.
        </p>
      </div>

      <div className="space-y-6">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
            <h2 className="font-semibold text-[var(--ll-text)]">{s.title}</h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)] leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
