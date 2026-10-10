import { requireRole } from "@/lib/auth";
import { loadClassSchedule, withReadTimeout } from "@/lib/student/classes.server";
import { ScheduleView } from "@/components/student/classes/Schedule";

export const dynamic = "force-dynamic";

/** Class schedule composed from the schedule authority for this learner's enrolled classes. */
export default async function StudentSchedulePage({ searchParams }: { searchParams?: { view?: string } }) {
  const user = await requireRole("STUDENT");
  const model = await withReadTimeout(loadClassSchedule(user)).catch(() => "unavailable" as const);
  return <ScheduleView model={model} view={searchParams?.view === "week" ? "week" : "today"} />;
}
