import { StudentTutorPageContent } from "@/components/student/StudentTutorPageContent";
import { requireRole } from "@/lib/auth";
import { isRagTutorEnabled } from "@/lib/serverFlags";

// The nav-visible "AI Tutor" experience. The actual grounded chat UI is the
// same GlobalAssistantShell instance the student layout already mounts
// (see components/rag/GlobalAssistantMount.tsx) - it detects this route and
// renders in the page's normal flow instead of covering the student navigation.
// This page supplies the auth gate and the page shell behind it.
export default async function StudentAiTutorPage() {
  await requireRole("STUDENT");
  const ragEnabled = isRagTutorEnabled();

  return <StudentTutorPageContent available={ragEnabled} />;
}
