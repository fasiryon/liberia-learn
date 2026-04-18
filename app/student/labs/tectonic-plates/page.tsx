import TectonicPlatesLabPage from "@/components/labs/TectonicPlatesLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { notFound } from "next/navigation";

export default async function TectonicPlatesRoute() {
  if (!isAiLabsEnabled()) notFound();
  const user = await requireRole("STUDENT");
  await logLearningEvent({
    type: "LAB_OPENED",
    labId: "tectonic-plates",
    schoolId: user.schoolId ?? null,
    userId: user.id,
    studentId: user.id,
    actor: { type: "user", id: user.id, role: "STUDENT" },
    target: { type: "ai_lab", id: "tectonic-plates" },
    eventType: "LAB_OPENED",
    source: "/student/labs/tectonic-plates",
    metadata: { labId: "tectonic-plates" },
  } as any);
  return <TectonicPlatesLabPage />;
}
