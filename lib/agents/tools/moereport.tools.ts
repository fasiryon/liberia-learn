/**
 * Sprint 6.3: MOE Narrative-Report agent tools. This agent generates
 * plain-language written reports on top of EXISTING MOE data aggregation -
 * it does not implement new data pipelines. getScopeData calls into the
 * platform's existing WAEC readiness aggregator (lib/waec/aggregate.ts) and
 * delivery-compliance aggregator (lib/moe/deliveryCompliance.ts, extracted
 * from the existing /api/moe/delivery-compliance route this sprint) rather
 * than reimplementing either. detectNotableChanges is pure deterministic
 * comparison - no LLM call - per Escalation Point 2's approved thresholds;
 * the LLM only ever writes prose around facts this function already decided.
 * saveDraftReport writes ONLY "DRAFT" status; no other status value is ever
 * written by any code path in this sprint.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { enqueueEscalation } from "@/lib/agents/escalation";
import { aggregateWaecForStudents } from "@/lib/waec/aggregate";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { getDeliveryComplianceByDistrict, getDeliveryComplianceForSchool } from "@/lib/moe/deliveryCompliance";
import type { ToolDefinition } from "@/lib/agents/types";

const SCOPES = ["national", "district", "school"] as const;
type Scope = (typeof SCOPES)[number];
const PERIOD_TYPES = ["monthly", "quarterly"] as const;
type PeriodType = (typeof PERIOD_TYPES)[number];
const SIGNIFICANCE = ["LOW", "MEDIUM", "HIGH"] as const;
type Significance = (typeof SIGNIFICANCE)[number];

const subjectAggregateSchema = z.object({
  subjectId: z.string(),
  name: z.string(),
  assessedStudents: z.number(),
  avgReadiness: z.number().nullable(),
  atRisk: z.number(),
  onTrack: z.number(),
});

const scopeDataSchema = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  enrollment: z.number(),
  activeStudents: z.number(),
  waecReadiness: z.object({
    studentCount: z.number(),
    subjects: z.array(subjectAggregateSchema),
  }),
  deliveryCompliance: z.object({
    scheduledWorkTotal: z.number(),
    scheduledWorkDelivered: z.number(),
    compliancePct: z.number().nullable(),
  }),
});
export type ScopeData = z.infer<typeof scopeDataSchema>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── moereport.getScopeData ──────────────────────────────────────────────────

const getScopeDataInput = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

function studentWhereForScope(scope: Scope, scopeId: string | undefined) {
  if (scope === "school") {
    if (!scopeId) throw new Error("scopeId is required for scope=school");
    return { user: { schoolId: scopeId } };
  }
  if (scope === "district") {
    if (!scopeId) throw new Error("scopeId is required for scope=district");
    return { user: { school: { districtId: scopeId } } };
  }
  return {};
}

export const moereportGetScopeDataTool: ToolDefinition<
  z.infer<typeof getScopeDataInput>,
  ScopeData
> = {
  name: "moereport.getScopeData",
  description: "Load aggregated real numbers (enrollment, engagement, WAEC readiness, delivery compliance) for a scope and period.",
  domain: "moe",
  inputSchema: getScopeDataInput,
  outputSchema: scopeDataSchema,
  auditTag: "agent.tool.moereport.getScopeData",
  estimatedCostUnits: 3,
  requiresAuth: ["system"],
  handler: async (input) => {
    const where = studentWhereForScope(input.scope, input.scopeId);

    const students = await prisma.student.findMany({
      where,
      select: { id: true, currentGrade: true },
    });
    const allStudentIds = students.map((s) => s.id);
    const waecEligibleIds = students
      .filter((s) => (s.currentGrade ?? 0) >= WAEC_MIN_GRADE)
      .map((s) => s.id);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    const [subjects, activeRows, deliveryCompliance] = await Promise.all([
      aggregateWaecForStudents(waecEligibleIds),
      allStudentIds.length === 0
        ? Promise.resolve([])
        : prisma.derivedStudentProgress.findMany({
            distinct: ["studentId"],
            where: { studentId: { in: allStudentIds }, derivedAt: { gte: periodStart, lte: periodEnd } },
            select: { studentId: true },
          }),
      input.scope === "national"
        ? getDeliveryComplianceByDistrict().then((r) => r.national)
        : input.scope === "district"
          ? getDeliveryComplianceByDistrict().then(
              (r) =>
                r.byDistrict.find((d) => d.districtId === input.scopeId) ?? {
                  scheduledWorkTotal: 0,
                  scheduledWorkDelivered: 0,
                  compliancePct: null,
                }
            )
          : getDeliveryComplianceForSchool(input.scopeId as string),
    ]);

    return {
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      enrollment: allStudentIds.length,
      activeStudents: activeRows.length,
      waecReadiness: { studentCount: waecEligibleIds.length, subjects },
      deliveryCompliance: {
        scheduledWorkTotal: deliveryCompliance.scheduledWorkTotal,
        scheduledWorkDelivered: deliveryCompliance.scheduledWorkDelivered,
        compliancePct: deliveryCompliance.compliancePct,
      },
    };
  },
};
registerTool(moereportGetScopeDataTool);

// ─── moereport.getPriorReport ────────────────────────────────────────────────

const getPriorReportInput = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string().optional(),
  periodType: z.enum(PERIOD_TYPES),
});
const priorReportSchema = z.object({
  reportId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  narrativeText: z.string(),
  dataSnapshot: scopeDataSchema,
});
const getPriorReportOutput = priorReportSchema.nullable();

export const moereportGetPriorReportTool: ToolDefinition<
  z.infer<typeof getPriorReportInput>,
  z.infer<typeof getPriorReportOutput>
> = {
  name: "moereport.getPriorReport",
  description: "Load the most recent previously-generated report for this scope/period type, if one exists.",
  domain: "moe",
  inputSchema: getPriorReportInput,
  outputSchema: getPriorReportOutput,
  auditTag: "agent.tool.moereport.getPriorReport",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) => {
    const row = await prisma.reportDraft.findFirst({
      where: { scope: input.scope, scopeId: input.scopeId ?? null, periodType: input.periodType },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return {
      reportId: row.id,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      narrativeText: row.narrativeText,
      dataSnapshot: row.dataSnapshot as unknown as ScopeData,
    };
  },
};
registerTool(moereportGetPriorReportTool);

// ─── moereport.detectNotableChanges ──────────────────────────────────────────

const detectNotableChangesInput = z.object({
  currentData: scopeDataSchema,
  priorData: scopeDataSchema.nullable(),
});
const changeSchema = z.object({
  metric: z.string(),
  direction: z.enum(["up", "down"]),
  magnitude: z.number(),
  significance: z.enum(SIGNIFICANCE),
});
const detectNotableChangesOutput = z.object({ changes: z.array(changeSchema) });

/**
 * Escalation Point 2 (approved thresholds): percentage-point swing bands for
 * WAEC readiness / delivery compliance / engagement rate (LOW < 3pp, MEDIUM
 * 3-7pp, HIGH > 7pp), relative percent-change bands for enrollment (LOW <
 * 2%, MEDIUM 2-5%, HIGH > 5%). Simple, stated, defensible per the spec's
 * requirement - tune later once real reports are seen.
 */
function classifyPercentagePoint(delta: number): Significance {
  const abs = Math.abs(delta);
  if (abs > 7) return "HIGH";
  if (abs >= 3) return "MEDIUM";
  return "LOW";
}
function classifyRelativePercent(pctChange: number): Significance {
  const abs = Math.abs(pctChange);
  if (abs > 5) return "HIGH";
  if (abs >= 2) return "MEDIUM";
  return "LOW";
}

export const moereportDetectNotableChangesTool: ToolDefinition<
  z.infer<typeof detectNotableChangesInput>,
  z.infer<typeof detectNotableChangesOutput>
> = {
  name: "moereport.detectNotableChanges",
  description: "Deterministically compare current vs prior period data and classify significance. Not an LLM call.",
  domain: "moe",
  inputSchema: detectNotableChangesInput,
  outputSchema: detectNotableChangesOutput,
  auditTag: "agent.tool.moereport.detectNotableChanges",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async (input) => {
    const changes: z.infer<typeof changeSchema>[] = [];
    const { currentData, priorData } = input;
    if (!priorData) return { changes };

    if (priorData.enrollment > 0 && currentData.enrollment !== priorData.enrollment) {
      const pctChange = ((currentData.enrollment - priorData.enrollment) / priorData.enrollment) * 100;
      changes.push({
        metric: "enrollment",
        direction: pctChange > 0 ? "up" : "down",
        magnitude: round2(pctChange),
        significance: classifyRelativePercent(pctChange),
      });
    }

    const curCompliance = currentData.deliveryCompliance.compliancePct;
    const priorCompliance = priorData.deliveryCompliance.compliancePct;
    if (curCompliance != null && priorCompliance != null && curCompliance !== priorCompliance) {
      const delta = curCompliance - priorCompliance;
      changes.push({
        metric: "deliveryCompliance",
        direction: delta > 0 ? "up" : "down",
        magnitude: round2(delta),
        significance: classifyPercentagePoint(delta),
      });
    }

    const curEngagement =
      currentData.enrollment > 0 ? (currentData.activeStudents / currentData.enrollment) * 100 : null;
    const priorEngagement =
      priorData.enrollment > 0 ? (priorData.activeStudents / priorData.enrollment) * 100 : null;
    if (curEngagement != null && priorEngagement != null && curEngagement !== priorEngagement) {
      const delta = curEngagement - priorEngagement;
      changes.push({
        metric: "engagementRate",
        direction: delta > 0 ? "up" : "down",
        magnitude: round2(delta),
        significance: classifyPercentagePoint(delta),
      });
    }

    const priorSubjects = new Map<string, z.infer<typeof subjectAggregateSchema>>(
      priorData.waecReadiness.subjects.map((s) => [s.subjectId, s])
    );
    for (const cur of currentData.waecReadiness.subjects) {
      const prior = priorSubjects.get(cur.subjectId);
      if (!prior || cur.avgReadiness == null || prior.avgReadiness == null) continue;
      if (cur.avgReadiness === prior.avgReadiness) continue;
      const delta = cur.avgReadiness - prior.avgReadiness;
      changes.push({
        metric: `waecReadiness.${cur.subjectId}`,
        direction: delta > 0 ? "up" : "down",
        magnitude: round2(delta),
        significance: classifyPercentagePoint(delta),
      });
    }

    return { changes };
  },
};
registerTool(moereportDetectNotableChangesTool);

// ─── moereport.saveDraftReport ───────────────────────────────────────────────

const saveDraftReportInput = z.object({
  scope: z.enum(SCOPES),
  scopeId: z.string().optional(),
  periodType: z.enum(PERIOD_TYPES),
  periodStart: z.string(),
  periodEnd: z.string(),
  narrativeText: z.string().min(1),
  dataSnapshot: scopeDataSchema,
  changesSummary: z.array(changeSchema).optional(),
});
const saveDraftReportOutput = z.object({ reportId: z.string() });

/**
 * Always writes status "DRAFT" - the input schema does not even accept a
 * status field, so there is no argument an LLM could pass to change that.
 * Escalation Point 1 (approved): stores dataSnapshot alongside the prose so
 * a historical report stays accurate even if aggregation logic changes later.
 */
export const moereportSaveDraftReportTool: ToolDefinition<
  z.infer<typeof saveDraftReportInput>,
  z.infer<typeof saveDraftReportOutput>
> = {
  name: "moereport.saveDraftReport",
  description: "Save a generated narrative report as DRAFT. No other status is ever written.",
  domain: "moe",
  inputSchema: saveDraftReportInput,
  outputSchema: saveDraftReportOutput,
  auditTag: "agent.tool.moereport.saveDraftReport",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) => {
    const row = await prisma.reportDraft.create({
      data: {
        scope: input.scope,
        scopeId: input.scopeId ?? null,
        periodType: input.periodType,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        narrativeText: input.narrativeText,
        dataSnapshot: input.dataSnapshot as object,
        changesSummary: (input.changesSummary ?? null) as object | undefined,
        status: "DRAFT",
      },
    });
    return { reportId: row.id };
  },
};
registerTool(moereportSaveDraftReportTool);

// ─── moereport.flagForHumanReview ────────────────────────────────────────────

const flagForHumanReviewInput = z.object({
  reportId: z.string(),
  reason: z.string().min(1),
});
const flagForHumanReviewOutput = z.object({ flagId: z.string() });

/**
 * Routes into the existing, tenant-scoped /admin/agents Escalations panel
 * (lib/agents/admin/escalations.ts) - no parallel review queue. MOE reports
 * are national/district-level artifacts with no single school owner, so
 * schoolId is intentionally null here (the panel already supports
 * platform-wide, school-less escalations - see the 2026-07-16 tenant-scoping
 * fix's own doc comment).
 */
export const moereportFlagForHumanReviewTool: ToolDefinition<
  z.infer<typeof flagForHumanReviewInput>,
  z.infer<typeof flagForHumanReviewOutput>
> = {
  name: "moereport.flagForHumanReview",
  description: "Flag a generated report draft for human attention via the existing escalation queue.",
  domain: "moe",
  inputSchema: flagForHumanReviewInput,
  outputSchema: flagForHumanReviewOutput,
  auditTag: "agent.tool.moereport.flagForHumanReview",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input, ctx) => {
    const { id } = await enqueueEscalation({
      agentName: ctx.agentName,
      reason: `moe-narrative-report: ${input.reason} (reportId=${input.reportId})`,
      priority: "MEDIUM",
      schoolId: null,
      traceId: ctx.traceId ?? null,
    });
    return { flagId: id };
  },
};
registerTool(moereportFlagForHumanReviewTool);
