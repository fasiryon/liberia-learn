import { prisma } from "@/lib/db";

export type ProductMetricsPeriod = "7d" | "30d" | "90d";

export type MetricTrend = "up" | "down" | "flat";

export type MetricValue = {
  value: number;
  previousValue: number;
  delta: number;
  trend: MetricTrend;
};

export type DistrictOutcome = {
  districtId: string;
  districtName: string;
  lessonCompletionRate: number;
  examPassRate: number;
  guardianEngagementRate: number;
  interventionImpactRate: number;
  compositeScore: number;
};

export type ProductMetricsDashboard = {
  generatedAt: string;
  scope: "school" | "national";
  period: ProductMetricsPeriod;
  learningOutcomes: {
    lessonCompletionRate: MetricValue;
    examCompletionRate: MetricValue;
    examPassRate: MetricValue;
    avgExamScore: MetricValue;
    masteryProgressRate: MetricValue;
  };
  engagement: {
    assignmentSubmissionRate: MetricValue;
    guardianEngagementRate: MetricValue;
    aiTutorAdoptionRate: MetricValue;
    teacherAiAssistAdoptionRate: MetricValue;
    interventionAcceptanceRate: MetricValue;
  };
  platformMetrics: {
    moeExportCount: MetricValue;
    activeStudentsPercent: MetricValue;
    activeTeachersPercent: MetricValue;
  };
  nationalOutcomes: {
    nationalLessonCompletionRate: number;
    nationalExamPassRate: number;
    nationalGuardianEngagementRate: number;
    interventionImpactRate: number;
    topPerformingDistricts: DistrictOutcome[];
    lowestPerformingDistricts: DistrictOutcome[];
  } | null;
};

type WindowRange = {
  currentFrom: Date;
  currentTo: Date;
  previousFrom: Date;
  previousTo: Date;
};

type BaseSnapshot = {
  lessonCompletionRate: number;
  examCompletionRate: number;
  examPassRate: number;
  avgExamScore: number;
  masteryProgressRate: number;
  assignmentSubmissionRate: number;
  guardianEngagementRate: number;
  aiTutorAdoptionRate: number;
  teacherAiAssistAdoptionRate: number;
  interventionAcceptanceRate: number;
  moeExportCount: number;
  activeStudentsPercent: number;
  activeTeachersPercent: number;
};

type ProductMetricsPrisma = typeof prisma & {
  user?: { findMany: (args?: unknown) => Promise<Array<{ id: string; role: string }>> };
  studentProgress?: { findMany: (args?: unknown) => Promise<Array<{ studentId: string; startedAt: Date | null; completedAt: Date | null; scheduledWork: { class: { schoolId: string } } }>> };
  examAttempt?: { findMany: (args?: unknown) => Promise<Array<{ passed: boolean; score: number; submittedAt: Date | null; student: { userId: string }; exam: { schoolId: string } }>> };
  assignmentSubmission?: { findMany: (args?: unknown) => Promise<Array<{ studentId: string; turnedInAt: Date | null; Student: { userId: string } }>> };
  homeworkSubmission?: { findMany: (args?: unknown) => Promise<Array<{ Student: { userId: string } }>> };
  studentGuardian?: { findMany: (args?: unknown) => Promise<Array<{ guardianId: string; student: { user: { schoolId: string | null } } }>> };
  auditLog?: { findMany: (args?: unknown) => Promise<Array<{ userId: string | null }>> };
  exportRecord?: { count: (args?: unknown) => Promise<number> };
  district?: { findMany: (args?: unknown) => Promise<Array<{ id: string; name: string; schools: Array<{ id: string }> }>> };
  guardianMessage?: { findMany: (args?: unknown) => Promise<Array<{ guardianId: string; schoolId: string }>> };
  interventionRecommendation?: { findMany: (args?: unknown) => Promise<Array<{ status: string; schoolId: string }>> };
  studentPerformanceEvent?: { findMany: (args?: unknown) => Promise<Array<{ studentId: string; score: number }>> };
  aiInteractionLog?: { findMany: (args?: unknown) => Promise<Array<{ userId: string | null; requestType: string | null; feature: string | null }>> };
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function asPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return round2((numerator / denominator) * 100);
}

function buildMetric(current: number, previous: number): MetricValue {
  const delta = round2(current - previous);
  return {
    value: round2(current),
    previousValue: round2(previous),
    delta,
    trend: delta > 0.25 ? "up" : delta < -0.25 ? "down" : "flat",
  };
}

function resolveWindow(period: ProductMetricsPeriod): WindowRange {
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const currentTo = new Date();
  const currentFrom = new Date(currentTo);
  currentFrom.setUTCDate(currentTo.getUTCDate() - days);
  const previousTo = new Date(currentFrom);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousTo.getUTCDate() - days);
  return { currentFrom, currentTo, previousFrom, previousTo };
}

function schoolWhere(schoolId: string | null) {
  return schoolId ? { schoolId } : {};
}

function buildMetricWhere(schoolId: string | null, from: Date, to: Date) {
  return {
    timestamp: { gte: from, lt: to },
    ...(schoolId ? { schoolId } : {}),
  };
}

function buildRoleSets(users: Array<{ id: string; role: string }>) {
  const students = new Set<string>();
  const teachers = new Set<string>();
  for (const user of users) {
    if (user.role === "STUDENT") students.add(user.id);
    if (user.role === "TEACHER") teachers.add(user.id);
  }
  return { students, teachers };
}

function distinctCount(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

async function loadSnapshot({
  schoolId,
  from,
  to,
}: {
  schoolId: string | null;
  from: Date;
  to: Date;
}): Promise<BaseSnapshot> {
  const productPrisma = prisma as ProductMetricsPrisma;
  if (
    !productPrisma.user?.findMany ||
    !productPrisma.studentProgress?.findMany ||
    !productPrisma.examAttempt?.findMany ||
    !productPrisma.assignmentSubmission?.findMany ||
    !productPrisma.homeworkSubmission?.findMany ||
    !productPrisma.studentGuardian?.findMany ||
    !productPrisma.auditLog?.findMany ||
    !productPrisma.exportRecord?.count
  ) {
    return {
      lessonCompletionRate: 0,
      examCompletionRate: 0,
      examPassRate: 0,
      avgExamScore: 0,
      masteryProgressRate: 0,
      assignmentSubmissionRate: 0,
      guardianEngagementRate: 0,
      aiTutorAdoptionRate: 0,
      teacherAiAssistAdoptionRate: 0,
      interventionAcceptanceRate: 0,
      moeExportCount: 0,
      activeStudentsPercent: 0,
      activeTeachersPercent: 0,
    };
  }

  const users = await productPrisma.user.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      role: { in: ["STUDENT", "TEACHER"] },
    },
    select: { id: true, role: true },
  });

  const safeUsers = Array.isArray(users) ? users : [];
  const studentUsers = safeUsers.filter((user) => user.role === "STUDENT");
  const teacherUsers = safeUsers.filter((user) => user.role === "TEACHER");
  const roleSets = buildRoleSets(safeUsers);

  const [
    progressRows,
    examAttempts,
    assignmentRows,
    homeworkRows,
    studentPerformanceRows,
    guardianLinks,
    guardianMessages,
    aiRows,
    interventions,
    exportRecords,
    studentActivityAudit,
    teacherActivityAudit,
  ] = await Promise.all([
    productPrisma.studentProgress.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        scheduledWork: schoolId ? { class: { schoolId } } : undefined,
      },
      select: {
        studentId: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    productPrisma.examAttempt.findMany({
      where: {
        startedAt: { gte: from, lt: to },
        exam: schoolId ? { schoolId } : undefined,
      },
      select: {
        passed: true,
        score: true,
        submittedAt: true,
        student: { select: { userId: true } },
      },
    }),
    productPrisma.assignmentSubmission.findMany({
      where: {
        Assignment: schoolId ? { Class: { schoolId } } : undefined,
      },
      select: {
        studentId: true,
        turnedInAt: true,
        Student: { select: { userId: true } },
      },
    }),
    productPrisma.homeworkSubmission.findMany({
      where: {
        submittedAt: { gte: from, lt: to },
        Homework: schoolId ? { Class: { schoolId } } : undefined,
      },
      select: {
        Student: { select: { userId: true } },
      },
    }),
    (productPrisma.studentPerformanceEvent?.findMany
      ? productPrisma.studentPerformanceEvent.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        studentId: true,
        score: true,
      },
      })
      : Promise.resolve([])) as Promise<Array<{ studentId: string; score: number }>>,
    productPrisma.studentGuardian.findMany({
      where: schoolId ? { student: { user: { schoolId } } } : undefined,
      select: {
        guardianId: true,
      },
    }),
    (productPrisma.guardianMessage?.findMany
      ? productPrisma.guardianMessage.findMany({
      where: {
        sentAt: { gte: from, lt: to },
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        guardianId: true,
      },
      })
      : Promise.resolve([])) as Promise<Array<{ guardianId: string }>>,
    (productPrisma.aiInteractionLog?.findMany
      ? productPrisma.aiInteractionLog.findMany({
      where: buildMetricWhere(schoolId, from, to),
      select: {
        userId: true,
        requestType: true,
        feature: true,
      },
      })
      : Promise.resolve([])) as Promise<Array<{ userId: string | null; requestType: string | null; feature: string | null }>>,
    (productPrisma.interventionRecommendation?.findMany
      ? productPrisma.interventionRecommendation.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        status: true,
      },
      })
      : Promise.resolve([])) as Promise<Array<{ status: string }>>,
    productPrisma.exportRecord.count({
      where: {
        createdAt: { gte: from, lt: to },
        ...(schoolId ? { user: { schoolId } } : {}),
      },
    }),
    productPrisma.auditLog.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        userId: { in: Array.from(roleSets.students) },
      },
      select: { userId: true },
    }),
    productPrisma.auditLog.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        userId: { in: Array.from(roleSets.teachers) },
      },
      select: { userId: true },
    }),
  ]);

  const safeProgressRows = Array.isArray(progressRows) ? progressRows : [];
  const safeExamAttempts = Array.isArray(examAttempts) ? examAttempts : [];
  const safeAssignmentRows = Array.isArray(assignmentRows) ? assignmentRows : [];
  const safeHomeworkRows = Array.isArray(homeworkRows) ? homeworkRows : [];
  const safeStudentPerformanceRows = Array.isArray(studentPerformanceRows) ? studentPerformanceRows : [];
  const safeGuardianLinks = Array.isArray(guardianLinks) ? guardianLinks : [];
  const safeGuardianMessages = Array.isArray(guardianMessages) ? guardianMessages : [];
  const safeAiRows = Array.isArray(aiRows) ? aiRows : [];
  const safeInterventions = Array.isArray(interventions) ? interventions : [];
  const safeStudentAudit = Array.isArray(studentActivityAudit) ? studentActivityAudit : [];
  const safeTeacherAudit = Array.isArray(teacherActivityAudit) ? teacherActivityAudit : [];
  const safeExportRecords = typeof exportRecords === "number" ? exportRecords : 0;

  const completedLessons = safeProgressRows.filter((row) => row.completedAt).length;
  const totalLessonRows = safeProgressRows.length;

  const submittedAttempts = safeExamAttempts.filter((attempt) => attempt.submittedAt);
  const passedAttempts = submittedAttempts.filter((attempt) => attempt.passed).length;
  const avgExamScore =
    submittedAttempts.length > 0
      ? round2(submittedAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / submittedAttempts.length)
      : 0;

  const performanceByStudent = new Map<string, number[]>();
  for (const event of safeStudentPerformanceRows) {
    const existing = performanceByStudent.get(event.studentId) ?? [];
    existing.push(event.score);
    performanceByStudent.set(event.studentId, existing);
  }
  const improvingStudents = Array.from(performanceByStudent.values()).filter((scores) => {
    if (scores.length < 2) return false;
    const midpoint = Math.floor(scores.length / 2);
    const prior = scores.slice(0, midpoint);
    const recent = scores.slice(midpoint);
    if (prior.length === 0 || recent.length === 0) return false;
    const priorAvg = prior.reduce((sum, value) => sum + value, 0) / prior.length;
    const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    return recentAvg > priorAvg;
  }).length;

  const assignmentScopeRows = safeAssignmentRows.filter((row: any) => !schoolId || row?.Student?.userId);
  const turnedInAssignments = assignmentScopeRows.filter((row) => row.turnedInAt && row.turnedInAt >= from && row.turnedInAt < to).length;

  const linkedGuardians = distinctCount(safeGuardianLinks.map((row) => row.guardianId));
  const engagedGuardians = distinctCount(safeGuardianMessages.map((row) => row.guardianId));

  const aiTutorUsers = distinctCount(
    safeAiRows
      .filter((row) => {
        if (!row.userId || !roleSets.students.has(row.userId)) return false;
        return row.requestType !== "teacher_assist";
      })
      .map((row) => row.userId)
  );

  const teacherAssistUsers = distinctCount(
    safeAiRows
      .filter((row) => {
        if (!row.userId || !roleSets.teachers.has(row.userId)) return false;
        return row.requestType === "teacher_assist" || row.feature === "teacher_assist";
      })
      .map((row) => row.userId)
  );

  const actionedInterventions = safeInterventions.filter((row) => row.status === "actioned").length;

  const studentActivityUserIds = new Set<string>([
    ...safeStudentAudit.map((row) => row.userId).filter((value): value is string => Boolean(value)),
    ...safeProgressRows.map((row: any) => row?.studentId).filter((value): value is string => Boolean(value)),
    ...submittedAttempts.map((row: any) => row?.student?.userId).filter((value): value is string => Boolean(value)),
    ...assignmentScopeRows
      .filter((row) => row.turnedInAt && row.turnedInAt >= from && row.turnedInAt < to)
      .map((row: any) => row?.Student?.userId)
      .filter((value): value is string => Boolean(value)),
    ...safeHomeworkRows.map((row: any) => row?.Student?.userId).filter((value): value is string => Boolean(value)),
  ]);

  const teacherActivityUserIds = new Set<string>([
    ...safeTeacherAudit.map((row) => row.userId).filter((value): value is string => Boolean(value)),
    ...safeAiRows
      .filter((row) => row.userId && roleSets.teachers.has(row.userId))
      .map((row) => row.userId as string),
  ]);

  return {
    lessonCompletionRate: asPercent(completedLessons, totalLessonRows),
    examCompletionRate: asPercent(submittedAttempts.length, examAttempts.length),
    examPassRate: asPercent(passedAttempts, submittedAttempts.length),
    avgExamScore,
    masteryProgressRate: asPercent(improvingStudents, performanceByStudent.size),
    assignmentSubmissionRate: asPercent(turnedInAssignments, assignmentScopeRows.length),
    guardianEngagementRate: asPercent(engagedGuardians, linkedGuardians),
    aiTutorAdoptionRate: asPercent(aiTutorUsers, studentUsers.length),
    teacherAiAssistAdoptionRate: asPercent(teacherAssistUsers, teacherUsers.length),
    interventionAcceptanceRate: asPercent(actionedInterventions, safeInterventions.length),
    moeExportCount: safeExportRecords,
    activeStudentsPercent: asPercent(studentActivityUserIds.size, studentUsers.length),
    activeTeachersPercent: asPercent(teacherActivityUserIds.size, teacherUsers.length),
  };
}

async function buildDistrictOutcomes(window: WindowRange): Promise<DistrictOutcome[]> {
  const productPrisma = prisma as ProductMetricsPrisma;
  if (
    !productPrisma.district?.findMany ||
    !productPrisma.studentProgress?.findMany ||
    !productPrisma.examAttempt?.findMany ||
    !productPrisma.studentGuardian?.findMany
  ) {
    return [];
  }

  const [districts, progressRows, examAttempts, guardianLinks, guardianMessages, interventions] = await Promise.all([
    productPrisma.district.findMany({
      select: {
        id: true,
        name: true,
        schools: {
          select: { id: true },
        },
      },
    }),
    productPrisma.studentProgress.findMany({
      where: {
        createdAt: { gte: window.currentFrom, lt: window.currentTo },
      },
      select: {
        completedAt: true,
        scheduledWork: {
          select: {
            class: {
              select: {
                schoolId: true,
              },
            },
          },
        },
      },
    }),
    productPrisma.examAttempt.findMany({
      where: {
        startedAt: { gte: window.currentFrom, lt: window.currentTo },
      },
      select: {
        passed: true,
        submittedAt: true,
        exam: { select: { schoolId: true } },
      },
    }),
    productPrisma.studentGuardian.findMany({
      select: {
        guardianId: true,
        student: {
          select: {
            user: {
              select: {
                schoolId: true,
              },
            },
          },
        },
      },
    }),
    (productPrisma.guardianMessage?.findMany
      ? productPrisma.guardianMessage.findMany({
      where: { sentAt: { gte: window.currentFrom, lt: window.currentTo } },
      select: { guardianId: true, schoolId: true },
      })
      : Promise.resolve([])) as Promise<Array<{ guardianId: string; schoolId: string }>>,
    (productPrisma.interventionRecommendation?.findMany
      ? productPrisma.interventionRecommendation.findMany({
      where: { createdAt: { gte: window.currentFrom, lt: window.currentTo } },
      select: { status: true, schoolId: true },
      })
      : Promise.resolve([])) as Promise<Array<{ status: string; schoolId: string }>>,
  ]);

  const safeDistricts = Array.isArray(districts) ? districts : [];
  const safeProgressRows = Array.isArray(progressRows) ? progressRows : [];
  const safeExamAttempts = Array.isArray(examAttempts) ? examAttempts : [];
  const safeGuardianLinks = Array.isArray(guardianLinks) ? guardianLinks : [];
  const safeGuardianMessages = Array.isArray(guardianMessages) ? guardianMessages : [];
  const safeInterventions = Array.isArray(interventions) ? interventions : [];

  const districtBySchoolId = new Map<string, { districtId: string; districtName: string }>();
  for (const district of safeDistricts) {
    for (const school of district.schools) {
      districtBySchoolId.set(school.id, {
        districtId: district.id,
        districtName: district.name,
      });
    }
  }

  const buckets = new Map<
    string,
    {
      districtId: string;
      districtName: string;
      lessonTotal: number;
      lessonCompleted: number;
      examSubmitted: number;
      examPassed: number;
      linkedGuardians: Set<string>;
      engagedGuardians: Set<string>;
      interventionsTotal: number;
      interventionsActioned: number;
    }
  >();

  function ensureDistrict(districtId: string, districtName: string) {
    const existing = buckets.get(districtId);
    if (existing) return existing;
    const created = {
      districtId,
      districtName,
      lessonTotal: 0,
      lessonCompleted: 0,
      examSubmitted: 0,
      examPassed: 0,
      linkedGuardians: new Set<string>(),
      engagedGuardians: new Set<string>(),
      interventionsTotal: 0,
      interventionsActioned: 0,
    };
    buckets.set(districtId, created);
    return created;
  }

  for (const row of safeProgressRows) {
    const schoolId = (row as any)?.scheduledWork?.class?.schoolId;
    if (!schoolId) continue;
    const district = districtBySchoolId.get(schoolId);
    if (!district) continue;
    const bucket = ensureDistrict(district.districtId, district.districtName);
    bucket.lessonTotal += 1;
    if (row.completedAt) bucket.lessonCompleted += 1;
  }

  for (const row of safeExamAttempts) {
    const examSchoolId = (row as any)?.exam?.schoolId;
    if (!examSchoolId) continue;
    const district = districtBySchoolId.get(examSchoolId);
    if (!district || !row.submittedAt) continue;
    const bucket = ensureDistrict(district.districtId, district.districtName);
    bucket.examSubmitted += 1;
    if (row.passed) bucket.examPassed += 1;
  }

  for (const row of safeGuardianLinks) {
    const schoolId = (row as any)?.student?.user?.schoolId;
    if (!schoolId) continue;
    const district = districtBySchoolId.get(schoolId);
    if (!district) continue;
    ensureDistrict(district.districtId, district.districtName).linkedGuardians.add(row.guardianId);
  }

  for (const row of safeGuardianMessages) {
    const district = districtBySchoolId.get(row.schoolId);
    if (!district) continue;
    ensureDistrict(district.districtId, district.districtName).engagedGuardians.add(row.guardianId);
  }

  for (const row of safeInterventions) {
    const district = districtBySchoolId.get(row.schoolId);
    if (!district) continue;
    const bucket = ensureDistrict(district.districtId, district.districtName);
    bucket.interventionsTotal += 1;
    if (row.status === "actioned") bucket.interventionsActioned += 1;
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const lessonCompletionRate = asPercent(bucket.lessonCompleted, bucket.lessonTotal);
      const examPassRate = asPercent(bucket.examPassed, bucket.examSubmitted);
      const guardianEngagementRate = asPercent(bucket.engagedGuardians.size, bucket.linkedGuardians.size);
      const interventionImpactRate = asPercent(bucket.interventionsActioned, bucket.interventionsTotal);
      const compositeParts = [lessonCompletionRate, examPassRate, guardianEngagementRate].filter((value) => value > 0);
      const compositeScore =
        compositeParts.length > 0
          ? round2(compositeParts.reduce((sum, value) => sum + value, 0) / compositeParts.length)
          : 0;

      return {
        districtId: bucket.districtId,
        districtName: bucket.districtName,
        lessonCompletionRate,
        examPassRate,
        guardianEngagementRate,
        interventionImpactRate,
        compositeScore,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore || a.districtName.localeCompare(b.districtName));
}

export async function getProductMetricsDashboard({
  period = "30d",
  schoolId = null,
}: {
  period?: ProductMetricsPeriod;
  schoolId?: string | null;
}): Promise<ProductMetricsDashboard> {
  const window = resolveWindow(period);
  const [current, previous, districtOutcomes] = await Promise.all([
    loadSnapshot({ schoolId, from: window.currentFrom, to: window.currentTo }),
    loadSnapshot({ schoolId, from: window.previousFrom, to: window.previousTo }),
    schoolId ? Promise.resolve([]) : buildDistrictOutcomes(window),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    scope: schoolId ? "school" : "national",
    period,
    learningOutcomes: {
      lessonCompletionRate: buildMetric(current.lessonCompletionRate, previous.lessonCompletionRate),
      examCompletionRate: buildMetric(current.examCompletionRate, previous.examCompletionRate),
      examPassRate: buildMetric(current.examPassRate, previous.examPassRate),
      avgExamScore: buildMetric(current.avgExamScore, previous.avgExamScore),
      masteryProgressRate: buildMetric(current.masteryProgressRate, previous.masteryProgressRate),
    },
    engagement: {
      assignmentSubmissionRate: buildMetric(current.assignmentSubmissionRate, previous.assignmentSubmissionRate),
      guardianEngagementRate: buildMetric(current.guardianEngagementRate, previous.guardianEngagementRate),
      aiTutorAdoptionRate: buildMetric(current.aiTutorAdoptionRate, previous.aiTutorAdoptionRate),
      teacherAiAssistAdoptionRate: buildMetric(
        current.teacherAiAssistAdoptionRate,
        previous.teacherAiAssistAdoptionRate
      ),
      interventionAcceptanceRate: buildMetric(
        current.interventionAcceptanceRate,
        previous.interventionAcceptanceRate
      ),
    },
    platformMetrics: {
      moeExportCount: buildMetric(current.moeExportCount, previous.moeExportCount),
      activeStudentsPercent: buildMetric(current.activeStudentsPercent, previous.activeStudentsPercent),
      activeTeachersPercent: buildMetric(current.activeTeachersPercent, previous.activeTeachersPercent),
    },
    nationalOutcomes: schoolId
      ? null
      : {
          nationalLessonCompletionRate: current.lessonCompletionRate,
          nationalExamPassRate: current.examPassRate,
          nationalGuardianEngagementRate: current.guardianEngagementRate,
          interventionImpactRate: current.interventionAcceptanceRate,
          topPerformingDistricts: districtOutcomes.slice(0, 5),
          lowestPerformingDistricts: [...districtOutcomes].reverse().slice(0, 5),
        },
  };
}
