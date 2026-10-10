import { requireRole } from "@/lib/auth";
import { loadMyClasses, schoolClock, withReadTimeout } from "@/lib/student/classes.server";
import { MyClassesView } from "@/components/student/classes/MyClasses";

export const dynamic = "force-dynamic";

/** Enrolled classes only; membership is read on the server for this learner. */
export default async function StudentClassesPage() {
  const user = await requireRole("STUDENT");
  const model = await withReadTimeout(loadMyClasses(user)).catch(() => "unavailable" as const);
  if (model === "unavailable" || model.availability === "restricted") {
    return <MyClassesView model={model === "unavailable" ? "unavailable" : "restricted"} today={schoolClock(new Date(), "Africa/Monrovia").date} />;
  }
  return <MyClassesView model={model} today={model.today} />;
}
