import LessonDeliveryClient from "./LessonDeliveryClient";
import ToolkitOverlay from "@/components/toolkit/ToolkitOverlay";
import ToolkitProvider from "@/components/toolkit/ToolkitProvider";
import { prisma } from "@/lib/db";
import { isToolkitLessonIntegrationEnabled } from "@/lib/serverFlags";
import type { Subject, ToolContext } from "@/lib/toolkit/toolRegistry";

function subjectToToolkitSubject(subject: string | null | undefined): Subject {
  const normalized = (subject ?? "").toLowerCase().replace(/_/g, " ");
  if (normalized.includes("math")) return "math";
  if (["biology", "chemistry", "physics", "science", "earth science"].some((value) => normalized.includes(value))) {
    return "science";
  }
  if (normalized.includes("english") || normalized.includes("literacy") || normalized.includes("language")) return "english";
  if (normalized.includes("engineering")) return "engineering";
  if (normalized.includes("computer") || normalized === "cs") return "cs";
  return "science";
}

function gradeToBand(grade: number): ToolContext["gradeBand"] {
  if (grade <= 3) return "1-3";
  if (grade <= 6) return "4-6";
  if (grade <= 9) return "7-9";
  return "10-12";
}

export default async function StudentLessonPage({ params }: { params: { id: string } }) {
  const scheduledWork = await prisma.scheduledWork.findUnique({
    where: { id: params.id },
    select: {
      class: {
        select: {
          subject: true,
        },
      },
      content: {
        select: {
          subject: true,
          grade: true,
        },
      },
    },
  });
  const context: ToolContext = {
    subject: subjectToToolkitSubject(scheduledWork?.class.subject ?? scheduledWork?.content.subject),
    gradeBand: gradeToBand(scheduledWork?.content.grade ?? 7),
    lessonType: "lesson",
  };
  const lessonContent = <LessonDeliveryClient lessonId={params.id} />;

  return (
    <main className="ll-page min-h-screen px-4 py-8 text-slate-50">
      <div className="ll-shell max-w-5xl">
        {isToolkitLessonIntegrationEnabled() ? (
          <ToolkitProvider context={context}>
            {lessonContent}
            <ToolkitOverlay context={context} />
          </ToolkitProvider>
        ) : (
          lessonContent
        )}
      </div>
    </main>
  );
}
