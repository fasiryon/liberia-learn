import { TeacherShell } from "@/app/teacher/TeacherShell";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";
import { getOptionalUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

/**
 * Teacher layout — server component.
 *
 * Wraps all /teacher/* pages with the TeacherShell client component,
 * which injects the floating Help toolbar and GuidedOnboarding overlay
 * when the corresponding feature flags are enabled.
 *
 * Mirrors the pattern used in app/student/layout.tsx.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();
  const needsWelcome =
    user?.role === "TEACHER"
      ? !(
          await prisma.teacherProfile.findUnique({
            where: { userId: user.id },
            select: { isOnboarded: true },
          })
        )?.isOnboarded
      : false;

  return (
    <>
      <TeacherShell needsWelcome={needsWelcome}>{children}</TeacherShell>
      <GlobalAssistantMount />
      <PushPermissionPrompt />
      <PwaInstallPrompt />
    </>
  );
}
