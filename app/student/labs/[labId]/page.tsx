import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LabSessionClient } from "@/app/student/labs/LabSessionClient";

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
        <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
          <div className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
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
        <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
          <div className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
            This lab definition is no longer available.
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
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
              payload: (lab.payload as any) ?? {},
            }}
            sessionId={session.id}
            initialCompleted={Boolean(session.completedAt)}
          />
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error?.message ?? "Unable to load the lab."}
        </div>
      </main>
    );
  }
}
