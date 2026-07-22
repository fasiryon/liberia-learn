import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";
import { TeacherSkillsLibrary } from "@/components/teacher/TeacherSkillsLibrary";
import { SKILL_CATEGORIES, SKILL_ARTICLES } from "@/lib/training/skillsLibrary";

export default async function TeacherSkillsPage() {
  const user = await requireUser().catch(() => null);
  if (!user?.id) redirect("/login");
  if (user.role !== "TEACHER" && user.role !== "ADMIN") redirect("/");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TeacherDashboardBackLink />
        <TeacherNav />
        <TeacherSkillsLibrary categories={SKILL_CATEGORIES} articles={SKILL_ARTICLES} />
      </div>
    </main>
  );
}
