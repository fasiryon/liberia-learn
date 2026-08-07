import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listCurriculumDrafts } from "@/lib/curriculum/regenerationAdmin";
import { countRiskFlaggedAwaitingReview } from "@/lib/curriculum/riskTriage";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: { grade?: string; subject?: string; status?: string };
};

function parseGrade(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function CurriculumReviewPage({ searchParams }: Props) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.CURRICULUM_APPROVE)) redirect("/");
  const [drafts, riskFlaggedAwaitingReview] = await Promise.all([
    listCurriculumDrafts({
      grade: parseGrade(searchParams?.grade),
      subject: searchParams?.subject,
      status: searchParams?.status ?? "DRAFT",
      limit: 75,
    }),
    countRiskFlaggedAwaitingReview(),
  ]);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Platform Operations</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Curriculum Draft Review</h1>
            {riskFlaggedAwaitingReview > 0 ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                {riskFlaggedAwaitingReview} flagged by risk-triage awaiting your review
              </span>
            ) : null}
          </div>
        </header>

        <form className="flex flex-wrap gap-3 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <input name="grade" defaultValue={searchParams?.grade ?? ""} className="rounded border border-[var(--ll-border)] bg-transparent px-3 py-2 text-sm" placeholder="Grade" />
          <input name="subject" defaultValue={searchParams?.subject ?? ""} className="rounded border border-[var(--ll-border)] bg-transparent px-3 py-2 text-sm" placeholder="Subject" />
          <select name="status" defaultValue={searchParams?.status ?? "DRAFT"} className="rounded border border-[var(--ll-border)] bg-transparent px-3 py-2 text-sm">
            <option value="DRAFT">DRAFT</option>
            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            <option value="rejected">rejected</option>
          </select>
          <button className="rounded bg-[var(--ll-primary)] px-4 py-2 text-sm font-medium text-white">Filter</button>
        </form>

        <section className="overflow-x-auto rounded border border-[var(--ll-border)]">
          <table className="w-full min-w-[1060px] border-collapse text-sm">
            <thead className="bg-[var(--ll-surface)] text-left">
              <tr>
                <th className="px-3 py-2">Lesson</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Quality</th>
                <th className="px-3 py-2">Preview</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.contentId} className="align-top border-t border-[var(--ll-border)]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{draft.title ?? draft.contentId}</div>
                    <div className="font-mono text-xs text-[var(--ll-text-muted)]">{draft.contentId}</div>
                  </td>
                  <td className="px-3 py-2">{draft.grade}</td>
                  <td className="px-3 py-2">{draft.subject}</td>
                  <td className="px-3 py-2">{draft.status}</td>
                  <td className="px-3 py-2">
                    <div>{draft.qualityPassed ? "passing" : "blocked"}</div>
                    <div className="text-xs text-[var(--ll-text-muted)]">{draft.contentLength} chars</div>
                    {draft.qualityReason ? <div className="text-xs text-red-300">{draft.qualityReason}</div> : null}
                  </td>
                  <td className="max-w-[460px] px-3 py-2 text-[var(--ll-text-muted)]">{draft.preview}</td>
                </tr>
              ))}
              {drafts.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[var(--ll-text-muted)]" colSpan={6}>
                    No lessons match the current review filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
