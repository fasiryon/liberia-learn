import { notFound, redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { isTeacherIntelligenceDashboardEnabled } from "@/lib/serverFlags";
import TeacherIntelligenceDashboard from "@/app/teacher/intelligence/TeacherIntelligenceDashboard";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";

export const dynamic = "force-dynamic";

export default async function TeacherIntelligencePage() {
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
        <TeacherDashboardBackLink />
        <TeacherNav />
        <TeacherIntelligenceDashboard />
      </div>
    </main>
  );
}
