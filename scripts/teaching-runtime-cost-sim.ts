/**
 * Measures real per-session Teaching Runtime cost against one genuinely
 * aligned lesson and one genuinely unaligned lesson.
 *
 * Usage:
 *   npx tsx scripts/teaching-runtime-cost-sim.ts [alignedContentId] [unalignedContentId] [--turns=50] [--only=both]
 *   npx tsx scripts/teaching-runtime-cost-sim.ts --resume-session=<sessionId> [--turns=50]
 *
 * If content IDs are omitted, candidates are selected fresh from the current
 * database using hasGenuineMoeAlignment(). Run with --turns=1 as the paid
 * per-invocation probe before authorizing the full 50-turn simulation.
 */
process.env.AGENT_TEACHING_RUNTIME_ENABLED = "true";
process.env.TEACHING_RUNTIME_COST_SIM = "true";

import "@/lib/agents/bootstrap";
import { prisma } from "@/lib/db";
import { hasGenuineMoeAlignment } from "@/lib/moe/alignmentReader";
import { determineAlignmentMode } from "@/lib/teaching/alignment";
import { runTeachingTurn } from "@/lib/teaching/runtime";

type Candidate = {
  contentId: string;
  grade: number;
  subject: string;
  moeAlignments: unknown;
};

type SimulationLabel = "ALIGNED" | "UNALIGNED";
type SimulationMode = "both" | "aligned" | "unaligned";

let activeSimulationSessionId: string | null = null;
let shutdownStarted = false;

function optionValue(name: string): string | undefined {
  return process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

function requestedTurnCount(): number {
  const turns = Number(optionValue("turns") ?? "50");
  if (!Number.isInteger(turns) || turns < 1 || turns > 60) {
    throw new Error("--turns must be an integer from 1 through 60");
  }
  return turns;
}

function requestedMode(): SimulationMode {
  const mode = optionValue("only") ?? "both";
  if (mode !== "both" && mode !== "aligned" && mode !== "unaligned") {
    throw new Error("--only must be one of: both, aligned, unaligned");
  }
  return mode;
}

function scriptedInputs(turns: number, offset = 0) {
  return Array.from({ length: turns }, (_, localIndex) => {
    const index = offset + localIndex;
    if (index % 10 === 7) {
      return {
        role: "student" as const,
        text: "What is the capital of France, and why is it famous?",
        correct: false,
      };
    }
    if (index % 5 === 0) {
      return {
        role: "facilitator" as const,
        text: `Move to the next literal part of this lesson (step ${index}).`,
      };
    }
    return {
      role: "student" as const,
      text: `Question ${index}: explain that lesson part again using only the material provided.`,
      correct: index % 7 !== 0,
    };
  });
}

async function findCandidates(): Promise<{
  alignedContentId: string;
  unalignedContentId: string;
}> {
  const rows = (await prisma.curriculumContent.findMany({
    where: {
      status: { in: ["APPROVED", "approved", "published"] },
    },
    select: {
      contentId: true,
      grade: true,
      subject: true,
      moeAlignments: true,
    },
    orderBy: { contentId: "asc" },
  })) as Candidate[];

  const aligned = rows.find((row) =>
    hasGenuineMoeAlignment(row.moeAlignments)
  );
  const unaligned = rows.find(
    (row) => !hasGenuineMoeAlignment(row.moeAlignments)
  );
  if (!aligned || !unaligned) {
    throw new Error(
      "Could not find both a genuinely aligned and genuinely unaligned approved lesson"
    );
  }
  return {
    alignedContentId: aligned.contentId,
    unalignedContentId: unaligned.contentId,
  };
}

async function simulationActor() {
  const teacher = await prisma.user.findFirst({
    where: {
      role: "TEACHER",
      schoolId: { not: null },
    },
    select: { id: true, schoolId: true },
    orderBy: { id: "asc" },
  });
  if (!teacher?.schoolId) {
    throw new Error("No school-scoped teacher exists for audited simulation");
  }
  return { facilitatorId: teacher.id, schoolId: teacher.schoolId };
}

async function runSimulatedSession(
  contentId: string,
  label: SimulationLabel,
  targetTurns: number,
  actor: { facilitatorId: string; schoolId: string },
  resumeSessionId?: string
) {
  const content = await prisma.curriculumContent.findUnique({
    where: { contentId },
  });
  if (!content) throw new Error(`Content not found: ${contentId}`);

  const alignmentMode = determineAlignmentMode(content.moeAlignments);
  if (
    (label === "ALIGNED" && alignmentMode !== "FULL_CONFIDENCE") ||
    (label === "UNALIGNED" && alignmentMode !== "DEFERRED")
  ) {
    throw new Error(`${label} candidate no longer matches live alignment state`);
  }

  const session = resumeSessionId
    ? await prisma.teachingSession.findUnique({
        where: { id: resumeSessionId },
      })
    : await prisma.teachingSession.create({
        data: {
          contentId: content.contentId,
          facilitatorId: actor.facilitatorId,
          schoolId: actor.schoolId,
          grade: String(content.grade),
          subject: content.subject,
          alignmentMode,
          status: "ACTIVE",
        },
      });
  if (!session) throw new Error(`Teaching session not found: ${resumeSessionId}`);
  if (session.status !== "ACTIVE") {
    throw new Error(
      `Teaching session ${session.id} cannot resume from status ${session.status}`
    );
  }
  if (
    session.contentId !== content.contentId ||
    session.facilitatorId !== actor.facilitatorId ||
    session.schoolId !== actor.schoolId ||
    session.alignmentMode !== alignmentMode
  ) {
    throw new Error(`Teaching session ${session.id} does not match live simulation state`);
  }

  const persistedBefore = await prisma.teachingTurn.count({
    where: { sessionId: session.id },
  });
  if (persistedBefore > targetTurns) {
    throw new Error(
      `Teaching session ${session.id} already has ${persistedBefore} turns, above target ${targetTurns}`
    );
  }
  const remainingTurns = targetTurns - persistedBefore;
  activeSimulationSessionId = session.id;
  try {
    for (const input of scriptedInputs(remainingTurns, persistedBefore)) {
      await runTeachingTurn(session.id, input, {
        userRole: "TEACHER",
      });
    }
    await prisma.teachingSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
  } catch (error) {
    await prisma.teachingSession.updateMany({
      where: { id: session.id, status: "ACTIVE" },
      data: { status: "ABORTED", endedAt: new Date() },
    });
    throw error;
  } finally {
    activeSimulationSessionId = null;
  }

  const turns = await prisma.teachingTurn.findMany({
    where: { sessionId: session.id },
    select: { llmCostUSD: true, deferred: true },
  });
  const totalCostUSD = turns.reduce((sum, turn) => sum + turn.llmCostUSD, 0);
  const deferredCount = turns.filter((turn) => turn.deferred).length;
  const perTurnUSD = totalCostUSD / turns.length;
  console.log(
    `[${label}] session ${session.id}: ${turns.length} turns, $${totalCostUSD.toFixed(6)} total, $${perTurnUSD.toFixed(6)}/turn, ${deferredCount} deferrals`
  );
  return { totalCostUSD, perTurnUSD, deferredCount };
}

async function main() {
  const targetTurns = requestedTurnCount();
  const resumeSessionId = optionValue("resume-session");
  if (resumeSessionId) {
    const session = await prisma.teachingSession.findUnique({
      where: { id: resumeSessionId },
      select: {
        contentId: true,
        facilitatorId: true,
        schoolId: true,
        alignmentMode: true,
      },
    });
    if (!session) throw new Error(`Teaching session not found: ${resumeSessionId}`);
    if (
      session.alignmentMode !== "FULL_CONFIDENCE" &&
      session.alignmentMode !== "DEFERRED"
    ) {
      throw new Error(
        `Teaching session ${resumeSessionId} has unsupported alignment mode ${session.alignmentMode}`
      );
    }
    const label =
      session.alignmentMode === "FULL_CONFIDENCE" ? "ALIGNED" : "UNALIGNED";
    const resumed = await runSimulatedSession(
      session.contentId,
      label,
      targetTurns,
      {
        facilitatorId: session.facilitatorId,
        schoolId: session.schoolId,
      },
      resumeSessionId
    );
    console.log(
      `Resumed ${label.toLowerCase()} lesson: $${resumed.totalCostUSD.toFixed(6)}/session, $${resumed.perTurnUSD.toFixed(6)}/turn, ${resumed.deferredCount} deferrals`
    );
    return;
  }

  const mode = requestedMode();
  const positional = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith("--"));
  const selected =
    positional.length >= 2
      ? {
          alignedContentId: positional[0],
          unalignedContentId: positional[1],
        }
      : await findCandidates();
  const actor = await simulationActor();

  console.log(
    `Candidates: aligned=${selected.alignedContentId}, unaligned=${selected.unalignedContentId}`
  );
  const aligned =
    mode === "both" || mode === "aligned"
      ? await runSimulatedSession(
          selected.alignedContentId,
          "ALIGNED",
          targetTurns,
          actor
        )
      : null;
  const unaligned =
    mode === "both" || mode === "unaligned"
      ? await runSimulatedSession(
          selected.unalignedContentId,
          "UNALIGNED",
          targetTurns,
          actor
        )
      : null;

  console.log("Summary:");
  if (aligned) {
    console.log(
      `  Aligned lesson: $${aligned.totalCostUSD.toFixed(6)}/session, $${aligned.perTurnUSD.toFixed(6)}/turn, ${aligned.deferredCount} deferrals`
    );
  }
  if (unaligned) {
    console.log(
      `  Unaligned lesson: $${unaligned.totalCostUSD.toFixed(6)}/session, $${unaligned.perTurnUSD.toFixed(6)}/turn, ${unaligned.deferredCount} deferrals`
    );
  }
}

async function abortActiveSimulation(signal: string) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  if (activeSimulationSessionId) {
    await prisma.teachingSession.updateMany({
      where: { id: activeSimulationSessionId, status: "ACTIVE" },
      data: { status: "ABORTED", endedAt: new Date() },
    });
  }
  await prisma.$disconnect();
  console.error(`Simulation stopped by ${signal}`);
  process.exit(1);
}

process.once("SIGINT", () => void abortActiveSimulation("SIGINT"));
process.once("SIGTERM", () => void abortActiveSimulation("SIGTERM"));

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
