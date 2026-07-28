import { prisma } from "@/lib/db";
import { runAgent } from "@/lib/agents/runtime";
import { getLessonNarration } from "@/lib/teaching/lessonContent";
import { decideNextAction, type TurnSignal } from "@/lib/teaching/lessonDirector";
import type { AlignmentMode } from "@/lib/teaching/alignment";
import type { TurnInput, TurnResult } from "@/lib/teaching/types";

function buildTurnMessage(params: {
  role: "facilitator" | "student";
  text: string;
  narration: string;
  objectives: string[];
  guardrailMode: AlignmentMode;
  action: string;
  grade: string;
  subject: string;
}): string {
  const guardrailInstruction =
    params.guardrailMode === "FULL_CONFIDENCE"
      ? "Guardrail mode: FULL_CONFIDENCE. Ground your response in the lesson content below and name the topic it comes from."
      : "Guardrail mode: DEFERRED. Narrate ONLY the literal lesson content below. If this input needs anything beyond it, call teaching.flagOutOfScope and give a short honest deferral.";

  return [
    `Grade ${params.grade} ${params.subject} lesson.`,
    `Lesson objectives: ${params.objectives.join("; ") || "none listed"}.`,
    `Lesson content: ${params.narration}`,
    guardrailInstruction,
    `Lesson Director pacing hint: ${params.action}.`,
    `${params.role === "facilitator" ? "Facilitator" : "Student"} input: ${params.text}`,
  ].join("\n\n");
}

export async function runTeachingTurn(
  sessionId: string,
  input: TurnInput,
  ctx: { userRole: string }
): Promise<TurnResult> {
  const session = await prisma.teachingSession.findUnique({ where: { id: sessionId } });
  if (!session) throw Object.assign(new Error("Teaching session not found"), { status: 404 });
  if (session.status !== "ACTIVE") {
    throw Object.assign(new Error(`Teaching session is not active (status: ${session.status})`), { status: 409 });
  }

  const priorTurns = await prisma.teachingTurn.findMany({
    where: { sessionId },
    orderBy: { turnIndex: "asc" },
    select: { turnIndex: true, role: true, deferred: true },
  });
  const turnIndex = priorTurns.length;

  const signals: TurnSignal[] = priorTurns.map((turn) => ({
    role: turn.role as "facilitator" | "student",
    correct: turn.deferred ? false : null,
  }));
  if (input.role === "student") signals.push({ role: "student", correct: input.correct ?? null });
  const action = decideNextAction(signals, turnIndex);

  const content = await prisma.curriculumContent.findUnique({
    where: { contentId: session.contentId },
  });
  const narration = getLessonNarration(content?.payload);
  const objectives = ((content?.payload as Record<string, unknown> | undefined)?.objectives as string[]) ?? [];
  const guardrailMode = session.alignmentMode as AlignmentMode;

  const message = buildTurnMessage({
    role: input.role,
    text: input.text,
    narration,
    objectives,
    guardrailMode,
    action,
    grade: session.grade,
    subject: session.subject,
  });

  const result = await runAgent("teaching-runtime", message, {
    userId: session.facilitatorId,
    userRole: "system",
    schoolId: session.schoolId,
    traceId: sessionId,
    triggeredBy: "USER",
  });

  const deferred = result.toolCalls.some((toolCall) => toolCall.tool === "teaching.flagOutOfScope" && toolCall.ok);
  const whisperCall = result.toolCalls.find(
    (toolCall) => toolCall.tool === "teaching.sendWhisperPrompt" && toolCall.ok
  );
  const whisperSent = Boolean(
    whisperCall && (whisperCall.result as { sent?: boolean } | undefined)?.sent
  );
  const responseText = result.response ?? "I could not generate a response for this turn.";

  await prisma.teachingTurn.create({
    data: {
      sessionId,
      turnIndex,
      role: input.role,
      inputText: input.text,
      responseText,
      guardrailMode,
      deferred,
      lessonDirectorAction: action,
      whisperPrompt: whisperCall
        ? {
            title: "Teaching Coach",
            body: (whisperCall.args as { message?: string })?.message,
          }
        : undefined,
      llmCostUSD: result.llmCostUSD,
      latencyMs: 0,
    },
  });

  void ctx;

  return {
    turnIndex,
    responseText,
    guardrailMode,
    deferred,
    lessonDirectorAction: action,
    whisperSent,
    llmCostUSD: result.llmCostUSD,
  };
}
