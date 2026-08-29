import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LabSessionClient } from "@/app/student/labs/LabSessionClient";
import { projectStudentLabPayload } from "@/lib/curriculum/studentLessonProjection";

export const dynamic = "force-dynamic";

export default async function StudentLabDetailPage({
  params,
}: {
  params: { labId: string };
}) {
  try {
    const user = await requireRole("STUDENT");

    const session = await prisma.labSession.findFirst({
      where: {
        labId: params.labId,
        studentId: user.id,
        schoolId: user.schoolId ?? undefined,
      },
      select: {
        id: true,
        completedAt: true,
      },
    });

    if (!session) {
      return (
        <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text)]">
            No lab session was found for this assignment.
          </div>
        </main>
      );
    }

    const lab = await prisma.virtualLab.findUnique({
      where: { labId: params.labId },
      select: {
        labId: true,
        title: true,
        estimatedMinutes: true,
        payload: true,
      },
    });

    if (!lab) {
      return (
        <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text)]">
            This lab definition is no longer available.
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/student/labs" className="ll-interactive inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to Labs
          </Link>
          <LabSessionClient
            lab={{
              labId: lab.labId,
              title: lab.title,
              estimatedMinutes: lab.estimatedMinutes,
              payload: projectStudentLabPayload(lab.payload),
            }}
            sessionId={session.id}
            initialCompleted={Boolean(session.completedAt)}
          />
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error?.message ?? "Unable to load the lab."}
        </div>
      </main>
    );
  }
}
