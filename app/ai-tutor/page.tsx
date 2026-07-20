import { redirect } from "next/navigation";

// Tutor Architecture Consolidation: the standalone /ai-tutor page and its
// deprecated /api/ai/chat backend are retired. The real, grounded tutor
// experience lives at /student/ai-tutor (GlobalAssistantShell).
export default function AiTutorRedirectPage() {
  redirect("/student/ai-tutor");
}
