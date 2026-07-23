/**
 * Morning Brief sweep (Sprint 7.4). Finds every teacher with at least one
 * class who does not already have today's brief, and invokes the agent
 * once per teacher. Mirrors lib/agents/contentqa/sweep.ts's shape: a
 * cron-driven scan, not a per-teacher webhook - invoked by
 * app/api/cron/morning-brief-sweep.
 */
import { prisma } from "@/lib/db";
import { runAgent } from "@/lib/agents/runtime";
import { logger } from "@/lib/logger";

export interface MorningBriefSweepItem {
  teacherUserId: string;
  outcome: "generated" | "already_exists" | "invoke_failed";
  invocationId?: string | null;
}

export interface MorningBriefSweepResult {
  ranAt: string;
  briefDate: string;
  items: MorningBriefSweepItem[];
}

function todayDateOnly(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function alreadyHasBrief(teacherUserId: string, briefDate: Date): Promise<boolean> {
  const existing = await prisma.teacherMorningBrief.findUnique({
    where: { teacherUserId_briefDate: { teacherUserId, briefDate } },
    select: { id: true },
  });
  return existing !== null;
}

function buildInstruction(teacherUserId: string, briefDate: string): string {
  return [
    "Generate today's morning brief for this teacher.",
    `teacherUserId: ${teacherUserId}`,
    `briefDate: ${briefDate}`,
    "Your first tool call must be exactly \"morningbrief.getTeacherSignals\" with this teacherUserId.",
  ].join("\n");
}

export async function runMorningBriefSweep(now: Date = new Date()): Promise<MorningBriefSweepResult> {
  const briefDateStr = todayDateOnly(now);
  const briefDate = new Date(`${briefDateStr}T00:00:00.000Z`);

  const teachersWithClasses = await prisma.class.findMany({
    where: { teacherId: { not: null } },
    select: { teacherId: true },
    distinct: ["teacherId"],
  });
  const teacherIds = teachersWithClasses
    .map((c) => c.teacherId)
    .filter((id): id is string => Boolean(id));

  const items: MorningBriefSweepItem[] = [];
  for (const teacherUserId of teacherIds) {
    if (await alreadyHasBrief(teacherUserId, briefDate)) {
      items.push({ teacherUserId, outcome: "already_exists" });
      continue;
    }
    try {
      const result = await runAgent("morning-brief", buildInstruction(teacherUserId, briefDateStr), {
        userRole: "system",
        triggeredBy: "SCHEDULE",
      });
      items.push({ teacherUserId, outcome: "generated", invocationId: result.invocationId });
    } catch (e) {
      logger.warn("[morning-brief.sweep] invocation failed", {
        teacherUserId,
        message: e instanceof Error ? e.message : String(e),
      });
      items.push({ teacherUserId, outcome: "invoke_failed" });
    }
  }

  return { ranAt: now.toISOString(), briefDate: briefDateStr, items };
}
