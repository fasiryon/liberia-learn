import PeriodicTableLabPage from "@/components/labs/PeriodicTableLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { notFound } from "next/navigation";

export default async function PeriodicTableRoute() {
  if (!isAiLabsEnabled()) notFound();
  const user = await requireRole("STUDENT");
  await logLearningEvent({
    type: "LAB_OPENED",
    labId: "periodic-table",
    schoolId: user.schoolId ?? null,
    userId: user.id,
    studentId: user.id,
    actor: { type: "user", id: user.id, role: "STUDENT" },
    target: { type: "ai_lab", id: "periodic-table" },
    eventType: "LAB_OPENED",
    source: "/student/labs/periodic-table",
    metadata: { labId: "periodic-table" },
  } as any);
  return <PeriodicTableLabPage />;
}
