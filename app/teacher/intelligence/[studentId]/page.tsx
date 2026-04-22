import { notFound, redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { isTeacherIntelligenceDashboardEnabled } from "@/lib/serverFlags";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import TeacherStudentIntelligenceClient from "@/app/teacher/intelligence/[studentId]/TeacherStudentIntelligenceClient";

export const dynamic = "force-dynamic";

export default async function TeacherStudentIntelligencePage({
  params,
}: {
  params: { studentId: string };
}) {
  if (!isTeacherIntelligenceDashboardEnabled()) {
    notFound();
  }

  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "TEACHER") {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <TeacherNav />
        <TeacherStudentIntelligenceClient studentId={params.studentId} />
      </div>
    </main>
  );
}
