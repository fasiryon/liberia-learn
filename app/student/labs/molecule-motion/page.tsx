import MoleculeMotionLabPage from "@/components/labs/MoleculeMotionLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";

export default async function StudentMoleculeMotionPage() {
  const user = await requireRole("STUDENT");

  if (!isAiLabsEnabled()) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
        <div className="ll-shell max-w-5xl">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-slate-100">
            Molecule Motion Lab is not available yet.
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
    target: { type: "ai_lab", id: "molecule-motion" },
    eventType: "LAB_OPENED",
    source: "/student/labs/molecule-motion",
    metadata: {
      labId: "molecule-motion",
    },
  });

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
      <div className="ll-shell max-w-6xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Chemistry Lab
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Molecule Motion Lab</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Explore how temperature affects particle motion, pressure, and phase transitions.
          </p>
        </div>
        <MoleculeMotionLabPage />
      </div>
    </main>
  );
}
