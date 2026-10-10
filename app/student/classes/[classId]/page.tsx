import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { loadClassDetail, withReadTimeout } from "@/lib/student/classes.server";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { ClassDetailView } from "@/components/student/classes/ClassDetail";

export const dynamic = "force-dynamic";

/** Rendered only for a class this learner is enrolled in at their school; anything else is not found. */
export default async function StudentClassPage({ params }: { params: { classId: string } }) {
  const user = await requireRole("STUDENT");
  const model = await withReadTimeout(loadClassDetail(user, params.classId)).catch(() => "unavailable" as const);
  if (model === null) notFound();
  if (model === "unavailable") return <main className="pdv2-today pdv2-learn" aria-labelledby="class-heading">
    <header className="pdv2-topbar"><div><InteractiveButton href="/student/classes">← My classes</InteractiveButton><h1 id="class-heading" className="pdv2-learn-crumb">Class</h1></div></header>
    <p role="status" className="pdv2-learn-notice"><span className="pdv2-badge pdv2-badge-warn">Unavailable</span> This class could not load. Try again.</p>
  </main>;
  return <ClassDetailView model={model} />;
}
