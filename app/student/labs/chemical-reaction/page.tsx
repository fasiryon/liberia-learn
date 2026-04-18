import ChemicalReactionLabPage from "@/components/labs/ChemicalReactionLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { notFound } from "next/navigation";

export default async function ChemicalReactionRoute() {
  if (!isAiLabsEnabled()) notFound();
  const user = await requireRole("STUDENT");
  await logLearningEvent({
    type: "LAB_OPENED",
    labId: "chemical-reaction",
    schoolId: user.schoolId ?? null,
    userId: user.id,
    studentId: user.id,
    actor: { type: "user", id: user.id, role: "STUDENT" },
    target: { type: "ai_lab", id: "chemical-reaction" },
    eventType: "LAB_OPENED",
    source: "/student/labs/chemical-reaction",
    metadata: { labId: "chemical-reaction" },
  } as any);
  return <ChemicalReactionLabPage />;
}
