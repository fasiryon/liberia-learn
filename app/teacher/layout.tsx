import { TeacherShell } from "@/app/teacher/TeacherShell";
import GlobalAssistantMount from "@/components/rag/GlobalAssistantMount";

/**
 * Teacher layout — server component.
 *
 * Wraps all /teacher/* pages with the TeacherShell client component,
 * which injects the floating Help toolbar and GuidedOnboarding overlay
 * when the corresponding feature flags are enabled.
 *
 * Mirrors the pattern used in app/student/layout.tsx.
 */
export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TeacherShell>{children}</TeacherShell>
      <GlobalAssistantMount />
    </>
  );
}
