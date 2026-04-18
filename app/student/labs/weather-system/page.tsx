import WeatherSystemLabPage from "@/components/labs/WeatherSystemLabPage";
import { requireRole } from "@/lib/auth";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isAiLabsEnabled } from "@/lib/serverFlags";
import { notFound } from "next/navigation";

export default async function WeatherSystemRoute() {
  if (!isAiLabsEnabled()) notFound();
  const user = await requireRole("STUDENT");
  await logLearningEvent({
    type: "LAB_OPENED",
    labId: "weather-system",
    schoolId: user.schoolId ?? null,
    userId: user.id,
    studentId: user.id,
    actor: { type: "user", id: user.id, role: "STUDENT" },
    target: { type: "ai_lab", id: "weather-system" },
    eventType: "LAB_OPENED",
    source: "/student/labs/weather-system",
    metadata: { labId: "weather-system" },
  } as any);
  return <WeatherSystemLabPage />;
}
