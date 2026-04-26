import Link from "next/link";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { MessagingCenter } from "@/components/messaging/MessagingCenter";
import { requireRole } from "@/lib/auth";

export default async function TeacherMessagesPage() {
  await requireRole("TEACHER");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/teacher" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Back to Teacher Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Messages</h1>
          </div>
        </header>

        <TeacherNav />
        <MessagingCenter
          role="teacher"
          emptyState="No messages yet. Guardian messages will appear here."
        />
      </div>
    </main>
  );
}
