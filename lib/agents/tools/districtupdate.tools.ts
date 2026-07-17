/**
 * Sprint 6.4: District Competition / School-Update agent tools. Generates
 * DRAFT-only district standings narratives and school-facing milestone
 * celebration drafts on top of EXISTING league/leaderboard/streak/delivery
 * data - no new leaderboard or achievement-tracking system this sprint.
 *
 * getLeagueStandings/getPriorStandings reuse lib/league/weeklyScore.ts's
 * computeSchoolWeeklyScores/assignDistrictRanks (weekly, current) and the
 * persisted LeagueWeekSnapshot table (weekly, prior) exactly as the existing
 * /api/league/district route does, plus the term-based LeagueSnapshot table
 * (the "monthly" periodType - no literal monthly cadence exists in this
 * platform, only weekly and per-term; term is the closest existing
 * longer-than-weekly snapshot, so "monthly" maps onto it here rather than
 * building a new cadence - noted explicitly, not silently assumed).
 *
 * getMilestoneCandidates surfaces CURRENT qualifying facts (e.g. "this
 * subject IS currently on-track", "this streak IS currently >= 30 days"),
 * not "just crossed a threshold" delta events - no persisted history exists
 * for WAEC readiness or streaks the way it does for league rank, and
 * building that history layer for a retention-only, lower-priority agent
 * is exactly the scope-creep the sprint brief says to avoid. Simpler,
 * still grounded, still conservative, still positive-only.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { enqueueEscalation } from "@/lib/agents/escalation";
import {
  currentWeekWindow,
  previousWeekWindow,
  computeSchoolWeeklyScores,
  assignDistrictRanks,
} from "@/lib/league/weeklyScore";
import { aggregateWaecForStudents } from "@/lib/waec/aggregate";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { getDeliveryComplianceForSchool } from "@/lib/moe/deliveryCompliance";
import type { ToolDefinition } from "@/lib/agents/types";

const SCOPES = ["district", "school"] as const;
type Scope = (typeof SCOPES)[number];
const PERIOD_TYPES = ["weekly", "monthly"] as const;
type PeriodType = (typeof PERIOD_TYPES)[number];
const SIGNIFICANCE = ["LOW", "MEDIUM", "HIGH"] as const;
type Significance = (typeof SIGNIFICANCE)[number];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "2026-T1" | "2026-T2" | "2026-T3", same rule as app/api/league/route.ts. */
function currentTerm(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const term = month <= 4 ? "T1" : month <= 8 ? "T2" : "T3";
  return `${year}-${term}`;
}

function previousTerm(term: string): string {
  const [yearStr, t] = term.split("-");
  const year = Number(yearStr);
  if (t === "T1") return `${year - 1}-T3`;
  if (t === "T2") return `${year}-T1`;
  return `${year}-T2`;
}

const standingEntrySchema = z.object({
  schoolId: z.string(),
  schoolName: z.string(),
  rank: z.number(),
  score: z.number(),
});
const standingsSchema = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string(),
  periodType: z.enum(PERIOD_TYPES),
  periodLabel: z.string(),
  standings: z.array(standingEntrySchema),
});
export type Standings = z.infer<typeof standingsSchema>;

// ─── districtupdate.getLeagueStandings ───────────────────────────────────────

const getLeagueStandingsInput = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string(),
  periodType: z.enum(PERIOD_TYPES),
});

async function currentWeeklyStandings(scope: Scope, scopeId: string): Promise<Standings> {
  const window = currentWeekWindow();
  const scores = await computeSchoolWeeklyScores(window);
  const ranked = assignDistrictRanks(scores);

  const district = scope === "district" ? scopeId : ranked.find((r) => r.schoolId === scopeId)?.district;
  const filtered = district ? ranked.filter((r) => r.district === district) : [];
  const standings = (scope === "school" ? filtered.filter((r) => r.schoolId === scopeId) : filtered).map((r) => ({
    schoolId: r.schoolId,
    schoolName: r.schoolName,
    rank: r.rank,
    score: round2(r.score),
  }));

  return {
    scope,
    scopeId,
    periodType: "weekly",
    periodLabel: window.weekStart.toISOString().slice(0, 10),
    standings,
  };
}

async function currentTermlyStandings(scope: Scope, scopeId: string): Promise<Standings> {
  const term = currentTerm();
  const rows = await prisma.leagueSnapshot.findMany({
    where: {
      term,
      ...(scope === "district" ? { school: { district: scopeId } } : { schoolId: scopeId }),
    },
    orderBy: { districtRank: "asc" },
    include: { school: { select: { name: true } } },
  });

  return {
    scope,
    scopeId,
    periodType: "monthly",
    periodLabel: term,
    standings: rows
      .filter((r) => r.districtRank != null)
      .map((r) => ({
        schoolId: r.schoolId,
        schoolName: r.school.name,
        rank: r.districtRank as number,
        score: round2(r.avgGrade * 0.5 + r.attendance * 0.3 + r.lessonCompletion * 0.2),
      })),
  };
}

export const districtupdateGetLeagueStandingsTool: ToolDefinition<
  z.infer<typeof getLeagueStandingsInput>,
  Standings
> = {
  name: "districtupdate.getLeagueStandings",
  description: "Load current real district-competition standings for a district or a single school.",
  domain: "system",
  inputSchema: getLeagueStandingsInput,
  outputSchema: standingsSchema,
  auditTag: "agent.tool.districtupdate.getLeagueStandings",
  estimatedCostUnits: 2,
  requiresAuth: ["system"],
  handler: async (input) =>
    input.periodType === "weekly"
      ? currentWeeklyStandings(input.scope, input.scopeId)
      : currentTermlyStandings(input.scope, input.scopeId),
};
registerTool(districtupdateGetLeagueStandingsTool);

// ─── districtupdate.getPriorStandings ────────────────────────────────────────

const getPriorStandingsInput = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string(),
  periodType: z.enum(PERIOD_TYPES),
});
const priorStandingsOutput = standingsSchema.nullable();

async function priorWeeklyStandings(scope: Scope, scopeId: string): Promise<Standings | null> {
  const window = previousWeekWindow();
  const rows = await prisma.leagueWeekSnapshot.findMany({
    where: {
      weekStart: window.weekStart,
      ...(scope === "district" ? { district: scopeId } : { schoolId: scopeId }),
    },
    orderBy: { rank: "asc" },
  });
  if (rows.length === 0) return null;

  return {
    scope,
    scopeId,
    periodType: "weekly",
    periodLabel: window.weekStart.toISOString().slice(0, 10),
    standings: rows.map((r) => ({ schoolId: r.schoolId, schoolName: r.schoolName, rank: r.rank, score: round2(r.score) })),
  };
}

async function priorTermlyStandings(scope: Scope, scopeId: string): Promise<Standings | null> {
  const term = previousTerm(currentTerm());
  const rows = await prisma.leagueSnapshot.findMany({
    where: {
      term,
      ...(scope === "district" ? { school: { district: scopeId } } : { schoolId: scopeId }),
    },
    orderBy: { districtRank: "asc" },
    include: { school: { select: { name: true } } },
  });
  const standings = rows
    .filter((r) => r.districtRank != null)
    .map((r) => ({
      schoolId: r.schoolId,
      schoolName: r.school.name,
      rank: r.districtRank as number,
      score: round2(r.avgGrade * 0.5 + r.attendance * 0.3 + r.lessonCompletion * 0.2),
    }));
  if (standings.length === 0) return null;

  return { scope, scopeId, periodType: "monthly", periodLabel: term, standings };
}

export const districtupdateGetPriorStandingsTool: ToolDefinition<
  z.infer<typeof getPriorStandingsInput>,
  z.infer<typeof priorStandingsOutput>
> = {
  name: "districtupdate.getPriorStandings",
  description: "Load the previous period's standings for the same scope, if available.",
  domain: "system",
  inputSchema: getPriorStandingsInput,
  outputSchema: priorStandingsOutput,
  auditTag: "agent.tool.districtupdate.getPriorStandings",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) =>
    input.periodType === "weekly"
      ? priorWeeklyStandings(input.scope, input.scopeId)
      : priorTermlyStandings(input.scope, input.scopeId),
};
registerTool(districtupdateGetPriorStandingsTool);

// ─── districtupdate.detectStandingsChanges ───────────────────────────────────

const detectStandingsChangesInput = z.object({
  currentStandings: standingsSchema,
  priorStandings: standingsSchema.nullable(),
});
const standingsChangeSchema = z.object({
  entity: z.string(),
  direction: z.enum(["up", "down"]),
  positions_moved: z.number(),
  metric: z.string(),
  significance: z.enum(SIGNIFICANCE),
});
const detectStandingsChangesOutput = z.object({ changes: z.array(standingsChangeSchema) });

/**
 * Escalation Point 2 (approved thresholds): LOW = 1 position moved,
 * MEDIUM = 2-3, HIGH = 4+ OR crossing into/out of the #1 spot (always HIGH
 * regardless of magnitude, mirroring Sprint 6.3's "gap opened/closed = always
 * HIGH" rule).
 */
function classifyPositionsMoved(positionsMoved: number, currentRank: number, priorRank: number): Significance {
  if (currentRank === 1 && priorRank !== 1) return "HIGH";
  if (priorRank === 1 && currentRank !== 1) return "HIGH";
  const abs = Math.abs(positionsMoved);
  if (abs >= 4) return "HIGH";
  if (abs >= 2) return "MEDIUM";
  return "LOW";
}

export const districtupdateDetectStandingsChangesTool: ToolDefinition<
  z.infer<typeof detectStandingsChangesInput>,
  z.infer<typeof detectStandingsChangesOutput>
> = {
  name: "districtupdate.detectStandingsChanges",
  description: "Deterministically compare current vs prior standings and classify significance. Not an LLM call.",
  domain: "system",
  inputSchema: detectStandingsChangesInput,
  outputSchema: detectStandingsChangesOutput,
  auditTag: "agent.tool.districtupdate.detectStandingsChanges",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async (input) => {
    const changes: z.infer<typeof standingsChangeSchema>[] = [];
    if (!input.priorStandings) return { changes };

    const priorByschool = new Map(input.priorStandings.standings.map((s) => [s.schoolId, s]));
    for (const cur of input.currentStandings.standings) {
      const prior = priorByschool.get(cur.schoolId);
      if (!prior) continue;
      const positionsMoved = prior.rank - cur.rank;
      if (positionsMoved === 0) continue;
      changes.push({
        entity: cur.schoolName,
        direction: positionsMoved > 0 ? "up" : "down",
        positions_moved: Math.abs(positionsMoved),
        metric: "district_rank",
        significance: classifyPositionsMoved(positionsMoved, cur.rank, prior.rank),
      });
    }
    return { changes };
  },
};
registerTool(districtupdateDetectStandingsChangesTool);

// ─── districtupdate.getMilestoneCandidates ───────────────────────────────────

const milestoneScopeSchema = z.enum(["school", "class"]);
const getMilestoneCandidatesInput = z.object({
  scope: milestoneScopeSchema,
  scopeId: z.string(),
});
const milestoneCandidateSchema = z.object({
  type: z.enum(["league_standing_improved", "waec_readiness_on_track", "engagement_streak", "delivery_compliance"]),
  description: z.string(),
  detail: z.record(z.string(), z.union([z.string(), z.number()])),
});
const getMilestoneCandidatesOutput = z.object({ candidates: z.array(milestoneCandidateSchema) });

const STREAK_THRESHOLDS = [90, 60, 30, 14, 7];
const MIN_STREAK_STUDENTS = 3;
const COMPLIANCE_THRESHOLDS = [100, 90, 75];

async function leagueStandingImprovedCandidate(schoolId: string) {
  const [current, prior] = await Promise.all([
    currentWeeklyStandings("school", schoolId),
    priorWeeklyStandings("school", schoolId),
  ]);
  const cur = current.standings[0];
  const prev = prior?.standings[0];
  if (!cur || !prev) return null;
  const positionsMoved = prev.rank - cur.rank;
  if (positionsMoved <= 0) return null;
  return {
    type: "league_standing_improved" as const,
    description: `${cur.schoolName} moved up ${positionsMoved} position(s) in the district league this week.`,
    detail: { schoolName: cur.schoolName, currentRank: cur.rank, priorRank: prev.rank, positionsMoved },
  };
}

async function waecReadinessCandidates(userIds: string[]) {
  const students = await prisma.student.findMany({
    where: { user: { id: { in: userIds } }, currentGrade: { gte: WAEC_MIN_GRADE } },
    select: { id: true },
  });
  if (students.length === 0) return [];
  const subjects = await aggregateWaecForStudents(students.map((s) => s.id));
  return subjects
    .filter((s) => s.avgReadiness != null && s.avgReadiness >= 75 && s.assessedStudents > 0)
    .map((s) => ({
      type: "waec_readiness_on_track" as const,
      description: `${s.name} readiness is on track at an average of ${s.avgReadiness} across ${s.assessedStudents} assessed student(s).`,
      detail: { subject: s.name, avgReadiness: s.avgReadiness as number, assessedStudents: s.assessedStudents },
    }));
}

async function engagementStreakCandidate(userIds: string[]) {
  if (userIds.length === 0) return null;
  for (const threshold of STREAK_THRESHOLDS) {
    const count = await prisma.studentStreak.count({
      where: { studentId: { in: userIds }, currentStreak: { gte: threshold } },
    });
    if (count >= MIN_STREAK_STUDENTS) {
      return {
        type: "engagement_streak" as const,
        description: `${count} student(s) currently have an active learning streak of at least ${threshold} days.`,
        detail: { thresholdDays: threshold, studentCount: count },
      };
    }
  }
  return null;
}

async function schoolDeliveryComplianceCandidate(schoolId: string) {
  const compliance = await getDeliveryComplianceForSchool(schoolId);
  if (compliance.compliancePct == null) return null;
  for (const threshold of COMPLIANCE_THRESHOLDS) {
    if (compliance.compliancePct >= threshold) {
      return {
        type: "delivery_compliance" as const,
        description: `Scheduled work delivery is at ${compliance.compliancePct}%, at or above the ${threshold}% mark.`,
        detail: { compliancePct: compliance.compliancePct, thresholdPct: threshold },
      };
    }
  }
  return null;
}

async function classDeliveryComplianceCandidate(classId: string) {
  const classRow = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, scheduledWork: { select: { id: true, isDelivered: true } } },
  });
  if (!classRow) return null;
  const total = classRow.scheduledWork.length;
  if (total === 0) return null;
  const delivered = classRow.scheduledWork.filter((sw) => sw.isDelivered).length;
  const pct = round2((delivered / total) * 100);
  for (const threshold of COMPLIANCE_THRESHOLDS) {
    if (pct >= threshold) {
      return {
        type: "delivery_compliance" as const,
        description: `${classRow.name}'s scheduled work delivery is at ${pct}%, at or above the ${threshold}% mark.`,
        detail: { compliancePct: pct, thresholdPct: threshold },
      };
    }
  }
  return null;
}

/**
 * Escalation Point 3 (approved starter list, positive-only, explicitly
 * excludes anything risk/intervention/safeguarding-adjacent):
 * (A) league standing improved - school scope only.
 * (B) a WAEC subject's average readiness is currently on-track (>=75).
 * (C) an engagement streak is currently at or above a round-number milestone.
 * (D) delivery compliance is currently at or above a round threshold.
 * Class scope supports (C) and (D) only - (A)/(B) are school-wide concepts
 * with no natural class-level equivalent in existing data.
 */
export const districtupdateGetMilestoneCandidatesTool: ToolDefinition<
  z.infer<typeof getMilestoneCandidatesInput>,
  z.infer<typeof getMilestoneCandidatesOutput>
> = {
  name: "districtupdate.getMilestoneCandidates",
  description: "Load real, factual, positive-only milestone candidates worth drafting an update about.",
  domain: "system",
  inputSchema: getMilestoneCandidatesInput,
  outputSchema: getMilestoneCandidatesOutput,
  auditTag: "agent.tool.districtupdate.getMilestoneCandidates",
  estimatedCostUnits: 3,
  requiresAuth: ["system"],
  handler: async (input) => {
    const candidates: z.infer<typeof milestoneCandidateSchema>[] = [];

    if (input.scope === "school") {
      const students = await prisma.user.findMany({
        where: { role: "STUDENT", schoolId: input.scopeId },
        select: { id: true },
      });
      const userIds = students.map((s) => s.id);

      const [standing, waec, streak, compliance] = await Promise.all([
        leagueStandingImprovedCandidate(input.scopeId),
        waecReadinessCandidates(userIds),
        engagementStreakCandidate(userIds),
        schoolDeliveryComplianceCandidate(input.scopeId),
      ]);
      if (standing) candidates.push(standing);
      candidates.push(...waec);
      if (streak) candidates.push(streak);
      if (compliance) candidates.push(compliance);
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { classId: input.scopeId },
        select: { Student: { select: { userId: true } } },
      });
      const userIds = enrollments.map((e) => e.Student.userId);

      const [streak, compliance] = await Promise.all([
        engagementStreakCandidate(userIds),
        classDeliveryComplianceCandidate(input.scopeId),
      ]);
      if (streak) candidates.push(streak);
      if (compliance) candidates.push(compliance);
    }

    return { candidates };
  },
};
registerTool(districtupdateGetMilestoneCandidatesTool);

// ─── districtupdate.saveDraftUpdate ──────────────────────────────────────────

const saveDraftUpdateInput = z.object({
  type: z.enum(["standings", "milestone"]),
  scope: z.enum(["district", "school", "class"]),
  scopeId: z.string(),
  draftText: z.string().min(1),
  dataSnapshot: z.record(z.string(), z.any()),
  changesSummary: z.array(z.union([standingsChangeSchema, milestoneCandidateSchema])).nullish(),
});
const saveDraftUpdateOutput = z.object({ updateId: z.string() });

/**
 * Always writes status "DRAFT" - the input schema does not accept a status
 * field, so no argument an LLM could pass changes that.
 */
export const districtupdateSaveDraftUpdateTool: ToolDefinition<
  z.infer<typeof saveDraftUpdateInput>,
  z.infer<typeof saveDraftUpdateOutput>
> = {
  name: "districtupdate.saveDraftUpdate",
  description: "Save a generated standings narrative or milestone draft as DRAFT. No other status is ever written.",
  domain: "system",
  inputSchema: saveDraftUpdateInput,
  outputSchema: saveDraftUpdateOutput,
  auditTag: "agent.tool.districtupdate.saveDraftUpdate",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) => {
    const row = await prisma.districtUpdateDraft.create({
      data: {
        type: input.type,
        scope: input.scope,
        scopeId: input.scopeId,
        draftText: input.draftText,
        dataSnapshot: input.dataSnapshot as object,
        changesSummary: (input.changesSummary ?? null) as object | undefined,
        status: "DRAFT",
      },
    });
    return { updateId: row.id };
  },
};
registerTool(districtupdateSaveDraftUpdateTool);

// ─── districtupdate.flagForHumanReview ───────────────────────────────────────

const flagForHumanReviewInput = z.object({
  updateId: z.string(),
  reason: z.string().min(1),
});
const flagForHumanReviewOutput = z.object({ flagId: z.string() });

async function resolveSchoolIdForDraft(scope: string, scopeId: string): Promise<string | null> {
  if (scope === "school") return scopeId;
  if (scope === "class") {
    const cls = await prisma.class.findUnique({ where: { id: scopeId }, select: { schoolId: true } });
    return cls?.schoolId ?? null;
  }
  return null;
}

/**
 * Routes into the existing, tenant-scoped /admin/agents Escalations panel -
 * no parallel review queue, same reuse as Sprint 6.3's moereport agent.
 */
export const districtupdateFlagForHumanReviewTool: ToolDefinition<
  z.infer<typeof flagForHumanReviewInput>,
  z.infer<typeof flagForHumanReviewOutput>
> = {
  name: "districtupdate.flagForHumanReview",
  description: "Flag a generated draft for human attention via the existing escalation queue.",
  domain: "system",
  inputSchema: flagForHumanReviewInput,
  outputSchema: flagForHumanReviewOutput,
  auditTag: "agent.tool.districtupdate.flagForHumanReview",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input, ctx) => {
    const draft = await prisma.districtUpdateDraft.findUnique({
      where: { id: input.updateId },
      select: { scope: true, scopeId: true },
    });
    const schoolId = draft ? await resolveSchoolIdForDraft(draft.scope, draft.scopeId) : null;

    const { id } = await enqueueEscalation({
      agentName: ctx.agentName,
      reason: `district-update: ${input.reason} (updateId=${input.updateId})`,
      priority: "MEDIUM",
      schoolId,
      traceId: ctx.traceId ?? null,
    });
    return { flagId: id };
  },
};
registerTool(districtupdateFlagForHumanReviewTool);
