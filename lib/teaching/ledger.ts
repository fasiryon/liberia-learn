import { prisma } from "@/lib/db";
import { readMoeAlignmentCodes } from "@/lib/moe/alignmentReader";
import { getLessonSlides } from "@/lib/teaching/lessonContent";

export async function buildAndSaveLedger(
  sessionId: string
): Promise<{ ledgerId: string }> {
  const session = await prisma.teachingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error(`Teaching session not found: ${sessionId}`);

  const turns = await prisma.teachingTurn.findMany({
    where: { sessionId },
    orderBy: { turnIndex: "asc" },
  });

  const content = await prisma.curriculumContent.findUnique({
    where: { contentId: session.contentId },
    include: {
      audioAssets: {
        where: { status: "GENERATED" },
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const payload = (content?.payload ?? {}) as Record<string, unknown>;
  const objectives = Array.isArray(payload.objectives)
    ? payload.objectives.filter((value): value is string => typeof value === "string")
    : [];
  const standardsCovered = readMoeAlignmentCodes(content?.moeAlignments);

  const questionsAsked = turns
    .filter((turn) => turn.role === "student")
    .map((turn) => ({
      turnIndex: turn.turnIndex,
      role: turn.role,
      text: turn.inputText,
    }));

  const outOfScopeQuestions = turns
    .filter((turn) => turn.deferred)
    .map((turn) => ({ turnIndex: turn.turnIndex, text: turn.inputText }));

  const confidenceFlags = turns.map((turn) => ({
    turnIndex: turn.turnIndex,
    mode: turn.guardrailMode,
    deferred: turn.deferred,
  }));

  const whisperPromptsIssued = turns.filter(
    (turn) => turn.whisperPrompt !== null
  ).length;

  const ledger = await prisma.teachingLedger.create({
    data: {
      sessionId,
      contentId: session.contentId,
      facilitatorId: session.facilitatorId,
      schoolId: session.schoolId,
      grade: session.grade,
      subject: session.subject,
      standardsCovered,
      objectives,
      resourcesUsed: {
        slideCount: getLessonSlides(payload).length,
        audioAssetId: content?.audioAssets[0]?.id ?? null,
      },
      questionsAsked,
      aggregatedResponses: {
        totalTurns: turns.length,
        deferredTurns: outOfScopeQuestions.length,
        whisperPromptsIssued,
      },
      quizResults: null,
      homeworkAssigned: null,
      transcript: turns.map((turn) => ({
        turnIndex: turn.turnIndex,
        role: turn.role,
        inputText: turn.inputText,
        responseText: turn.responseText,
        deferred: turn.deferred,
        lessonDirectorAction: turn.lessonDirectorAction,
        createdAt: turn.createdAt.toISOString(),
      })),
      confidenceFlags,
      outOfScopeQuestions,
      status: "DRAFT",
    },
  });

  return { ledgerId: ledger.id };
}
