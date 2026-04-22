import CellDivisionLabPage from "@/components/labs/CellDivisionLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";

export default async function StudentCellDivisionLabPage() {
  const user = await requireRole("STUDENT");

  if (!isAiLabsEnabled()) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
        <div className="ll-shell max-w-5xl">
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 text-[var(--ll-text)]">
            Cell Division Explorer is not available yet.
          </section>
        </div>
      </main>
    );
  }

  await logLearningEvent({
    schoolId: user.schoolId ?? null,
    userId: user.id,
    studentId: user.id,
    actor: { type: "user", id: user.id, role: "STUDENT" },
    target: { type: "ai_lab", id: "cell-division" },
    eventType: "LAB_OPENED",
    source: "/student/labs/cell-division",
    metadata: {
      labId: "cell-division",
    },
  });

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-shell max-w-6xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-silver)]">
            Biology Lab
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">Cell Division Explorer</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ll-text)]">
            Explore the stages of mitosis and how chromosomes divide.
          </p>
        </div>
        <CellDivisionLabPage />
      </div>
    </main>
  );
}
