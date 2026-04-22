import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { TeacherLabReviewForm } from "@/app/teacher/labs/TeacherLabReviewForm";

export const dynamic = "force-dynamic";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, typeof entry === "string" ? entry : JSON.stringify(entry)])
  );
}

function formatLabType(value: string | null | undefined) {
  if (!value) return "Lab";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function TeacherLabSessionReviewPage({
  params,
}: {
  params: { sessionId: string };
}) {
  if (!isVirtualLabsEnabled()) {
    notFound();
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      throw new Error("No school context available.");
    }

    const session = await prisma.labSession.findUnique({
      where: { id: params.sessionId },
      include: {
        student: { select: { name: true, email: true } },
      },
    });

    if (!session || session.schoolId !== user.schoolId || !session.scheduledWorkId) {
      notFound();
    }

    const scheduledWork = await prisma.scheduledWork.findUnique({
      where: { id: session.scheduledWorkId },
      include: {
        class: { select: { name: true, teacherId: true, schoolId: true } },
      },
    });

    if (!scheduledWork || scheduledWork.class.schoolId !== user.schoolId) {
      notFound();
    }

    if (user.role === "TEACHER" && scheduledWork.class.teacherId !== user.id) {
      notFound();
    }

    const lab = await prisma.virtualLab.findUnique({
      where: { labId: session.labId },
      select: {
        labId: true,
        title: true,
        subject: true,
        grade: true,
        labType: true,
        estimatedMinutes: true,
        payload: true,
      },
    });

    if (!lab) {
      notFound();
    }

    const payload = (lab.payload as Record<string, unknown> | null) ?? {};
    const procedure = asArray<{ stepNumber?: number; instruction?: string; teacherNote?: string | null; durationMinutes?: number }>(
      payload.procedure
    );
    const observationForm = asArray<{ field?: string; prompt?: string }>(payload.observationForm);
    const analysisQuestions = asArray<{ question?: string }>(payload.analysisQuestions);
    const observations = asRecord(session.observations);
    const aiAnalysis =
      session.aiAnalysis && typeof session.aiAnalysis === "object" && !Array.isArray(session.aiAnalysis)
        ? (session.aiAnalysis as Record<string, unknown>)
        : null;
    const whatWentWell = asArray<string>(aiAnalysis?.whatWentWell);
    const areasToImprove = asArray<string>(aiAnalysis?.areasToImprove);

    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-3">
            <Link href="/teacher/labs" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Lab Reviews
            </Link>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--ll-silver)]">Teacher Lab Review</p>
                  <h1 className="mt-2 text-3xl font-bold">{lab.title}</h1>
                  <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                    Review the student submission, compare it with the AI analysis, and record your final score.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 text-sm text-[var(--ll-text)]">
                  <div>{lab.subject} Grade {lab.grade}</div>
                  <div>{formatLabType(lab.labType)}</div>
                  <div>{lab.estimatedMinutes ?? 0} minutes</div>
                </div>
              </div>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ll-text-muted)]">Student</p>
              <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">{session.student.name ?? session.student.email ?? "Student"}</p>
              <p className="text-sm text-[var(--ll-text-muted)]">{session.student.email ?? "No email on file"}</p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ll-text-muted)]">Class</p>
              <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">{scheduledWork.class.name}</p>
              <p className="text-sm text-[var(--ll-text-muted)]">
                Started {session.startedAt ? new Date(session.startedAt).toLocaleString() : "Not started"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ll-text-muted)]">Submission</p>
              <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">
                {session.completedAt ? "Submitted" : "In progress"}
              </p>
              <p className="text-sm text-[var(--ll-text-muted)]">
                {session.completedAt ? new Date(session.completedAt).toLocaleString() : "Awaiting completion"}
              </p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
                <h2 className="text-xl font-semibold text-[var(--ll-text)]">Lab Definition</h2>
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{String(payload.labObjective ?? "No lab objective was stored for this lab.")}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ll-silver)]">Materials Needed</h3>
                    <ul className="mt-2 space-y-2 text-sm text-[var(--ll-text)]">
                      {asArray<string>(payload.materialsNeeded).map((item) => (
                        <li key={item} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ll-yellow)]">Safety Notes</h3>
                    <div className="mt-2 rounded-xl border border-amber-500/20 bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm text-[var(--ll-yellow)]">
                      {String(payload.safetyNotes ?? "No special safety notes recorded.")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
                <h2 className="text-xl font-semibold text-[var(--ll-text)]">Procedure Review</h2>
                <div className="mt-4 space-y-4">
                  {procedure.map((step, index) => (
                    <div key={`${step.stepNumber ?? index}-${step.instruction ?? "step"}`} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--ll-yellow)]">Step {step.stepNumber ?? index + 1}</p>
                        <span className="text-xs text-[var(--ll-text-faint)]">{step.durationMinutes ?? 0} min</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--ll-text)]">{step.instruction ?? "Instruction unavailable"}</p>
                      {step.teacherNote ? (
                        <p className="mt-2 text-xs italic text-[var(--ll-text-muted)]">Teacher note: {step.teacherNote}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
                <h2 className="text-xl font-semibold text-[var(--ll-text)]">Student Submission</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--ll-text)]">Observations</h3>
                    {observationForm.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-muted)]">No observation form was stored for this lab.</p>
                    ) : (
                      observationForm.map((field, index) => (
                        <div key={`${field.field ?? index}`} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-text-faint)]">{field.field ?? `Observation ${index + 1}`}</p>
                          <p className="mt-1 text-sm text-[var(--ll-text)]">{field.prompt ?? "Observation prompt unavailable"}</p>
                          <p className="mt-3 text-sm text-[var(--ll-text)]">{observations[field.field ?? ""] ?? "No response recorded."}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--ll-text)]">Analysis Answers</h3>
                    {analysisQuestions.length === 0 ? (
                      <p className="text-sm text-[var(--ll-text-muted)]">No analysis questions were stored for this lab.</p>
                    ) : (
                      analysisQuestions.map((question, index) => (
                        <div key={`${question.question ?? index}`} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 p-4">
                          <p className="text-sm font-medium text-[var(--ll-text)]">{question.question ?? `Question ${index + 1}`}</p>
                          <p className="mt-3 text-sm text-[var(--ll-text)]">
                            {observations[`analysis:${index}`] ?? "No answer recorded."}
                          </p>
                        </div>
                      ))
                    )}
                    <div className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-text-faint)]">Conclusion</p>
                      <p className="mt-2 text-sm text-[var(--ll-text)]">{session.conclusions ?? "No conclusion submitted."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
                <h2 className="text-xl font-semibold text-[var(--ll-text)]">AI Review</h2>
                {aiAnalysis ? (
                  <div className="mt-4 space-y-4 text-sm text-[var(--ll-text)]">
                    <div className="rounded-xl border border-emerald-500/20 bg-[var(--ll-yellow)]/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Suggested Score</p>
                      <p className="mt-2 text-3xl font-bold text-[var(--ll-yellow)]">{String(aiAnalysis.suggestedScore ?? "Pending")}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ll-text)]">Observation Feedback</h3>
                      <p className="mt-1">{String(aiAnalysis.observationFeedback ?? "No observation feedback available.")}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ll-text)]">Conclusion Feedback</h3>
                      <p className="mt-1">{String(aiAnalysis.conclusionFeedback ?? "No conclusion feedback available.")}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ll-text)]">What Went Well</h3>
                      <ul className="mt-2 space-y-2">
                        {whatWentWell.map((item) => (
                          <li key={item} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ll-text)]">Areas To Improve</h3>
                      <ul className="mt-2 space-y-2">
                        {areasToImprove.map((item) => (
                          <li key={item} className="rounded-xl border border-white/5 bg-[var(--ll-bg)]/60 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-cyan-500/20 bg-[var(--ll-silver-soft)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-silver)]">Connection To Standard</p>
                      <p className="mt-2">{String(aiAnalysis.connectionToStandard ?? "Not available")}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Teacher Note</p>
                      <p className="mt-2">{String(aiAnalysis.teacherNote ?? "No teacher note available.")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--ll-text-muted)]">AI analysis has not been generated for this session yet.</p>
                )}
              </div>

              <TeacherLabReviewForm
                sessionId={session.id}
                initialScore={session.score}
                initialFeedback={session.teacherFeedback}
              />
            </div>
          </section>
        </div>
      </main>
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_NOT_FOUND") {
      throw error;
    }

    return (
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error?.message ?? "Unable to load this lab session."}
        </div>
      </main>
    );
  }
}
