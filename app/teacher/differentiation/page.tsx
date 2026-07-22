import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherDashboardBackLink } from "@/app/teacher/TeacherDashboardBackLink";
import { TeacherDifferentiationDashboard } from "@/components/teacher/TeacherDifferentiationDashboard";

export const dynamic = "force-dynamic";

export default async function TeacherDifferentiationPage() {
  const user = await requireUser().catch(() => null);
  if (!user?.id) redirect("/login");
  if (user.role !== "TEACHER" && user.role !== "ADMIN") redirect("/");
  if (!user.schoolId) redirect("/teacher");

  const classWhere =
    user.role === "ADMIN" ? { schoolId: user.schoolId } : { schoolId: user.schoolId, teacherId: user.id };

  const classes = await prisma.class.findMany({
    where: classWhere,
    select: { id: true, name: true, subject: true, gradeLevel: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TeacherDashboardBackLink />
        <TeacherNav />
        <TeacherDifferentiationDashboard classes={classes} />
      </div>
    </main>
  );
}
