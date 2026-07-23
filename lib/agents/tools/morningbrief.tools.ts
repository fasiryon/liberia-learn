/**
 * Sprint 7.4: Morning Brief agent tools. getTeacherSignals deliberately
 * reuses Sprint 7.2's buildClassDifferentiationRollup across every class the
 * teacher teaches today - not a new intervention-detection pipeline - plus
 * one new lightweight query for ungraded submissions (a signal 7.2 does not
 * compute). saveBrief writes to TeacherMorningBrief only, upserting on the
 * (teacherUserId, briefDate) unique constraint so a sweep re-run for a day
 * that already has a brief is a safe no-op, not a duplicate.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { buildClassDifferentiationRollup } from "@/lib/teacher/classDifferentiation";
import type { ToolDefinition } from "@/lib/agents/types";

const interventionSchema = z.object({
  studentName: z.string(),
  className: z.string(),
  type: z.string(),
  label: z.string(),
  reason: z.string(),
});

const certificateUnlockSchema = z.object({
  studentName: z.string(),
  className: z.string(),
  subject: z.string(),
  completionPct: z.number(),
  remainingLessons: z.number(),
});

const classSummarySchema = z.object({
  classId: z.string(),
  className: z.string(),
  studentCount: z.number(),
});

const teacherSignalsSchema = z.object({
  teacherUserId: z.string(),
  teacherName: z.string(),
  schoolId: z.string().nullable(),
  briefDate: z.string(),
  classes: z.array(classSummarySchema),
  interventionsNeeded: z.array(interventionSchema),
  interventionsTotalCount: z.number(),
  certificateUnlocksClose: z.array(certificateUnlockSchema),
  ungradedSubmissionsCount: z.number(),
});
export type TeacherSignals = z.infer<typeof teacherSignalsSchema>;

const MAX_INTERVENTIONS_LISTED = 3;
const MAX_CERTIFICATES_LISTED = 3;

// ─── morningbrief.getTeacherSignals ─────────────────────────────────────────

const getTeacherSignalsInput = z.object({
  teacherUserId: z.string(),
});

export const morningbriefGetTeacherSignalsTool: ToolDefinition<
  z.infer<typeof getTeacherSignalsInput>,
  TeacherSignals
> = {
  name: "morningbrief.getTeacherSignals",
  description:
    "Load a teacher's real classes, students needing intervention (reusing the Sprint 7.2 differentiation rollup), students close to a certificate unlock, and ungraded submission count.",
  domain: "teacher",
  inputSchema: getTeacherSignalsInput,
  outputSchema: teacherSignalsSchema,
  auditTag: "agent.tool.morningbrief.getTeacherSignals",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) => {
    const teacher = await prisma.user.findUnique({
      where: { id: input.teacherUserId },
      select: { name: true, schoolId: true },
    });
    if (!teacher) throw new Error("Teacher not found");

    const classes = await prisma.class.findMany({
      where: { teacherId: input.teacherUserId },
      select: { id: true, name: true, _count: { select: { enrollments: true } } },
    });

    const interventionsNeeded: z.infer<typeof interventionSchema>[] = [];
    const certificateUnlocksClose: z.infer<typeof certificateUnlockSchema>[] = [];
    let interventionsTotalCount = 0;

    for (const cls of classes) {
      const rollup = await buildClassDifferentiationRollup(cls.id).catch(() => null);
      if (!rollup) continue;
      for (const group of rollup.groups) {
        if (group.type === "ON_TRACK") continue;
        interventionsTotalCount += group.students.length;
        for (const student of group.students) {
          if (interventionsNeeded.length < MAX_INTERVENTIONS_LISTED && student.hero) {
            interventionsNeeded.push({
              studentName: student.name,
              className: cls.name,
              type: student.hero.type,
              label: student.hero.label,
              reason: student.hero.reason,
            });
          }
          if (
            certificateUnlocksClose.length < MAX_CERTIFICATES_LISTED &&
            student.certificateProximity
          ) {
            certificateUnlocksClose.push({
              studentName: student.name,
              className: cls.name,
              subject: student.certificateProximity.subject,
              completionPct: student.certificateProximity.completionPct,
              remainingLessons: student.certificateProximity.remainingLessons,
            });
          }
        }
      }
    }

    const classIds = classes.map((c) => c.id);
    const ungradedSubmissionsCount =
      classIds.length > 0
        ? await prisma.assignmentSubmission.count({
            where: {
              turnedInAt: { not: null },
              gradedAt: null,
              Assignment: { classId: { in: classIds } },
            },
          })
        : 0;

    return {
      teacherUserId: input.teacherUserId,
      teacherName: teacher.name ?? "Teacher",
      schoolId: teacher.schoolId,
      briefDate: new Date().toISOString().slice(0, 10),
      classes: classes.map((c) => ({
        classId: c.id,
        className: c.name,
        studentCount: c._count.enrollments,
      })),
      interventionsNeeded,
      interventionsTotalCount,
      certificateUnlocksClose,
      ungradedSubmissionsCount,
    };
  },
};
registerTool(morningbriefGetTeacherSignalsTool);

// ─── morningbrief.saveBrief ─────────────────────────────────────────────────

const saveBriefInput = z.object({
  teacherUserId: z.string(),
  briefDate: z.string(),
  briefText: z.string().min(1),
  dataSnapshot: teacherSignalsSchema,
});
const saveBriefOutput = z.object({ briefId: z.string() });

export const morningbriefSaveBriefTool: ToolDefinition<
  z.infer<typeof saveBriefInput>,
  z.infer<typeof saveBriefOutput>
> = {
  name: "morningbrief.saveBrief",
  description: "Save the generated morning brief for one teacher and date. Upserts - safe to call again for the same day.",
  domain: "teacher",
  inputSchema: saveBriefInput,
  outputSchema: saveBriefOutput,
  auditTag: "agent.tool.morningbrief.saveBrief",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) => {
    const teacher = await prisma.user.findUnique({
      where: { id: input.teacherUserId },
      select: { schoolId: true },
    });
    if (!teacher?.schoolId) throw new Error("Teacher has no school context");

    const briefDate = new Date(`${input.briefDate}T00:00:00.000Z`);
    const row = await prisma.teacherMorningBrief.upsert({
      where: { teacherUserId_briefDate: { teacherUserId: input.teacherUserId, briefDate } },
      create: {
        teacherUserId: input.teacherUserId,
        schoolId: teacher.schoolId,
        briefDate,
        briefText: input.briefText,
        dataSnapshot: input.dataSnapshot as object,
      },
      update: {
        briefText: input.briefText,
        dataSnapshot: input.dataSnapshot as object,
      },
      select: { id: true },
    });
    return { briefId: row.id };
  },
};
registerTool(morningbriefSaveBriefTool);
