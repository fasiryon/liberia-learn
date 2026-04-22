import { requireRole } from "@/lib/auth";

import TeacherLessonViewClient from "./TeacherLessonViewClient";

export default async function TeacherLessonPage({
  params,
}: {
  params: { contentId: string };
}) {
  await requireRole("TEACHER");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl">
        <TeacherLessonViewClient contentId={params.contentId} />
      </div>
    </main>
  );
}
