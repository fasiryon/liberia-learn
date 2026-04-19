import GravityLabPage from "@/components/labs/GravityLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";

export default async function StudentGravityExplorerPage() {
  const user = await requireRole("STUDENT");

  if (!isAiLabsEnabled()) {
    return (
      <main className="ll-dashboard-shell px-4 py-8">
        <div className="ll-shell max-w-5xl">
          <section className="ll-section rounded-xl p-6 text-slate-100">
            Gravity Explorer is not available yet.
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
    target: { type: "ai_lab", id: "gravity-explorer" },
    eventType: "LAB_OPENED",
    source: "/student/labs/gravity-explorer",
    metadata: {
      labId: "gravity-explorer",
    },
  });

  return (
    <main className="ll-dashboard-shell px-4 py-8">
      <div className="ll-shell max-w-6xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Physics Lab
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Gravity Explorer</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Explore how gravity, height, and mass affect falling motion.
          </p>
        </div>
        <GravityLabPage />
      </div>
    </main>
  );
}
