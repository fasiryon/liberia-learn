import HumanHeartLabPage from "@/components/labs/HumanHeartLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";

export default async function StudentHumanHeartPage() {
  const user = await requireRole("STUDENT");

  if (!isAiLabsEnabled()) {
    return (
      <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
        <div className="ll-shell max-w-5xl">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-slate-100">
            Human Heart Simulator is not available yet.
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
    target: { type: "ai_lab", id: "human-heart" },
    eventType: "LAB_OPENED",
    source: "/student/labs/human-heart",
    metadata: {
      labId: "human-heart",
    },
  });

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
      <div className="ll-shell max-w-6xl">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Biology Lab
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Human Heart Simulator</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Explore how exercise, blockages, and oxygen delivery affect blood flow.
          </p>
        </div>
        <HumanHeartLabPage />
      </div>
    </main>
  );
}
