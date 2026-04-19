import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import StudentWelcomeClient from "./StudentWelcomeClient";

export const dynamic = "force-dynamic";

export default async function StudentWelcomePage() {
  const user = await requireRole("STUDENT");
  const [profile, completedLessons] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { welcomeCompletedAt: true },
    }),
    prisma.studentProgress.count({
      where: { studentId: user.id, completedAt: { not: null } },
    }),
  ]);

  if (profile?.welcomeCompletedAt || completedLessons > 0) {
    redirect("/dashboard");
  }

  return <StudentWelcomeClient name={user.name ?? "Student"} />;
}
