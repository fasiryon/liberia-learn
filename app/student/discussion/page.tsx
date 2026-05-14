import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default async function StudentDiscussionListPage() {
  const user = await requireRole("STUDENT").catch(() => null);
  if (!user) redirect("/login");

  const enrollments = await prisma.enrollment.findMany({
    where: { Student: { userId: user.id } },
    include: {
      Class: {
        select: {
          id: true,
          name: true,
          subject: true,
          discussionThreads: {
            select: {
              id: true,
              updatedAt: true,
              posts: {
                select: { createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const lastReads = await prisma.discussionLastRead.findMany({
    where: { userId: user.id },
    select: { threadId: true, readAt: true },
  });
  const readMap = new Map(lastReads.map((lr) => [lr.threadId, lr.readAt]));

  const classes = enrollments.map((e) => {
    const cls = e.Class;
    let unread = 0;
    for (const thread of cls.discussionThreads) {
      const lastPost = thread.posts[0];
      if (lastPost) {
        const readAt = readMap.get(thread.id);
        if (!readAt || lastPost.createdAt > readAt) unread++;
      }
    }
    return {
      id: cls.id,
      name: cls.name,
      subject: cls.subject,
      unread,
      threadCount: cls.discussionThreads.length,
    };
  });

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <Link
          href="/student/today"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Discussion Boards</h1>
        {classes.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">You are not enrolled in any classes.</p>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/student/class/${cls.id}/discussion`}
                className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-5 py-4 transition hover:bg-[var(--ll-surface-muted)]"
              >
                <div>
                  <p className="font-semibold text-[var(--ll-text)]">{cls.name}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    {cls.subject} · {cls.threadCount} thread{cls.threadCount !== 1 ? "s" : ""}
                  </p>
                </div>
                {cls.unread > 0 && (
                  <span className="rounded-full bg-[var(--ll-yellow)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ll-bg)]">
                    {cls.unread} new
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
