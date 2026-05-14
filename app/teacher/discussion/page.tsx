import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default async function TeacherDiscussionListPage() {
  const user = await requireRole("TEACHER").catch(() => null);
  if (!user) redirect("/login");

  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId! },
    select: {
      id: true,
      name: true,
      subject: true,
      _count: { select: { discussionThreads: true } },
      discussionThreads: {
        select: {
          posts: {
            where: { pending: true },
            select: { id: true },
          },
        },
      },
    },
  });

  const classData = classes.map((cls) => ({
    id: cls.id,
    name: cls.name,
    subject: cls.subject,
    threadCount: cls._count.discussionThreads,
    pendingCount: cls.discussionThreads.reduce((sum, t) => sum + t.posts.length, 0),
  }));

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Discussion Boards</h1>
        {classData.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No classes found.</p>
        ) : (
          <div className="space-y-3">
            {classData.map((cls) => (
              <Link
                key={cls.id}
                href={`/teacher/class/${cls.id}/discussion`}
                className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-5 py-4 transition hover:bg-[var(--ll-surface-muted)]"
              >
                <div>
                  <p className="font-semibold text-[var(--ll-text)]">{cls.name}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    {cls.subject} · {cls.threadCount} thread{cls.threadCount !== 1 ? "s" : ""}
                  </p>
                </div>
                {cls.pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                    {cls.pendingCount} pending
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
