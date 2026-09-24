import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type DiscussionActor = { id: string; role: string; schoolId?: string | null };

type DiscussionThreadScope = { id: string; classId: string; schoolId: string; locked: boolean; pinned: boolean; authorId: string };

// Failure is returned as the NextResponse itself so callers narrow with
// `instanceof NextResponse` (the repo does not run strictNullChecks).
type ThreadAccess = { thread: DiscussionThreadScope } | NextResponse;

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/**
 * Same scope rule the discussion list/create routes enforce: a student must be
 * enrolled in the thread's class; a teacher/admin must belong to the class's
 * school. `moderate` restricts the action to TEACHER/ADMIN.
 */
export async function authorizeDiscussionThread(
  user: DiscussionActor,
  threadId: string,
  options: { moderate?: boolean } = {}
): Promise<ThreadAccess> {
  if (options.moderate && user.role !== "TEACHER" && user.role !== "ADMIN") {
    return forbidden();
  }

  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    select: { id: true, classId: true, schoolId: true, locked: true, pinned: true, authorId: true },
  });
  if (!thread) return notFound();

  if (user.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { classId: thread.classId, Student: { userId: user.id } },
      select: { id: true },
    });
    if (!enrollment) return forbidden();
    return { thread };
  }

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    if (!user.schoolId) return forbidden();
    const cls = await prisma.class.findFirst({
      where: { id: thread.classId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!cls) return forbidden();
    return { thread };
  }

  return forbidden();
}

export async function authorizeDiscussionPost(
  user: DiscussionActor,
  postId: string,
  options: { moderate?: boolean } = {}
) {
  const post = await prisma.discussionPost.findUnique({
    where: { id: postId },
    select: { id: true, threadId: true, authorId: true },
  });
  if (!post) return notFound();
  const access = await authorizeDiscussionThread(user, post.threadId, options);
  if (access instanceof NextResponse) return access;
  return { post, thread: access.thread };
}
