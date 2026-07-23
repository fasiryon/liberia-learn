import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";
import { TeacherMorningBrief } from "@/components/teacher/TeacherMorningBrief";

export default function TeacherBriefPage() {
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TeacherDashboardBackLink />
        <TeacherNav />
        <TeacherMorningBrief />
      </div>
    </main>
  );
}
