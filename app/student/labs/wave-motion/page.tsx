import WaveMotionLabPage from "@/components/labs/WaveMotionLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";

export default async function StudentWaveMotionLabPage() {
  const user = await requireRole("STUDENT");

  if (!isAiLabsEnabled()) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
        <div className="ll-shell max-w-5xl">
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 text-[var(--ll-text)]">
            Wave Motion Lab is not available yet.
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
    target: { type: "ai_lab", id: "wave-motion" },
    eventType: "LAB_OPENED",
    source: "/student/labs/wave-motion",
    metadata: {
      labId: "wave-motion",
    },
  });

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-shell max-w-6xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-silver)]">
            Physics Lab
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">Wave Motion Lab</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ll-text)]">
            Explore how frequency, amplitude, and wave speed affect wave behavior.
          </p>
        </div>
        <WaveMotionLabPage />
      </div>
    </main>
  );
}
