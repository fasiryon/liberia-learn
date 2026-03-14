import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isAdaptiveEngineEnabled } from "@/lib/serverFlags";
import AdaptivePracticeClient from "./AdaptivePracticeClient";

export default async function StudentAdaptivePage() {
  if (!isAdaptiveEngineEnabled()) {
    redirect("/dashboard");
  }

  await requireRole("STUDENT");
  return <AdaptivePracticeClient />;
}
