import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { isRagTutorEnabled } from "@/lib/serverFlags";

// The nav-visible "AI Tutor" experience. The actual grounded chat UI is the
// same GlobalAssistantShell instance the student layout already mounts
// (see components/rag/GlobalAssistantMount.tsx) - it detects this route and
// auto-opens itself full-screen instead of the usual floating corner bubble.
// This page supplies the auth gate and the page shell behind it.
export default async function StudentAiTutorPage() {
  await requireRole("STUDENT");
  const ragEnabled = isRagTutorEnabled();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[var(--ll-bg)] p-6 text-center text-[var(--ll-text)]">
      <div className="mb-4 self-start">
        <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to Dashboard
        </Link>
      </div>
      <h1 className="text-lg font-semibold text-[var(--ll-text)]">AI Tutor</h1>
      <p className="max-w-sm text-sm text-[var(--ll-text-muted)]">
        {ragEnabled
          ? "Ask a question below to get help understanding a lesson or concept."
          : "The AI tutor is temporarily unavailable. Please ask your teacher for help with this topic."}
      </p>
    </main>
  );
}
