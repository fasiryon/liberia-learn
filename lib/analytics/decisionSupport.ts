import { prisma } from "@/lib/db";

type SchoolScope = {
  schoolId: string;
  days: number;
};

type JsonRecord = Record<string, unknown>;

export type ScoreBand = {
  label: "0-49" | "50-64" | "65-79" | "80-100";
  count: number;
};

export type AdminSchoolIntelligence = {
  classPerformanceDistribution: ScoreBand[];
  engagementLevels: {
    totalStudents: number;
    activeStudents: number;
    activeRatePct: number;
    lessonStarts: number;
    lessonCompletions: number;
    completionRatePct: number;
  };
  teacherEffectiveness: Array<{
    teacherId: string;
    teacherName: string;
    classCount: number;
    scheduledLessons: number;
    deliveredLessons: number;
    deliveryRatePct: number;
    lessonCompletionRatePct: number;
    averageQuizScorePct: number | null;
  }>;
  weakSubjects: Array<{
    subject: string;
    averageQuizScorePct: number | null;
    lessonCompletionRatePct: number;
    attempts: number;
    scheduledLessons: number;
    reason: string;
  }>;
  lowCompletionClasses: Array<{
    classId: string;
    className: string;
    subject: string;
    completionRatePct: number;
    scheduledLessons: number;
  }>;
};

export type MoeDecisionIntelligence = {
  districtComparisons: Array<{
    districtId: string;
    districtName: string;
    schoolCount: number;
    studentCount: number;
    averageQuizScorePct: number | null;
    deliveryRatePct: number;
    activeRatePct: number;
  }>;
  schoolComparisons: Array<{
    schoolId: string;
    schoolName: string;
    districtName: string;
    studentCount: number;
    averageQuizScorePct: number | null;
    deliveryRatePct: number;
    activeRatePct: number;
  }>;
  subjectWeaknessHeatmap: Array<{
    subject: string;
    districtId: string;
    districtName: string;
    averageQuizScorePct: number | null;
    attempts: number;
    severity: "low" | "medium" | "high";
  }>;
  curriculumAdoptionTrends: Array<{
    subject: string;
    scheduledLessons: number;
    deliveredLessons: number;
    deliveryRatePct: number;
  }>;
  readinessDeliverySummary: {
    schoolsWithActivity: number;
    schoolsWithDeliveredLessons: number;
    deliveryRatePct: number;
    nationalActiveRatePct: number;
  };
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? clampPercent((numerator / denominator) * 100) : 0;
}

function scoreBand(scorePct: number): ScoreBand["label"] {
  if (scorePct < 50) return "0-49";
  if (scorePct < 65) return "50-64";
  if (scorePct < 80) return "65-79";
  return "80-100";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function subjectFromPayload(payload: unknown, fallback: string | null | undefined) {
  const record = asRecord(payload);
  return typeof record.subject === "string" ? record.subject : fallback ?? "GENERAL";
}

export async function buildAdminSchoolIntelligence({
  schoolId,
  days,
}: SchoolScope): Promise<AdminSchoolIntelligence> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [classes, scheduledWork, progress, attempts, activeEvents, totalStudents] =
    await Promise.all([
      prisma.class.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          subject: true,
          teacherId: true,
          Teacher: { select: { id: true, name: true, email: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      prisma.scheduledWork.findMany({
        where: { class: { schoolId }, scheduledDate: { gte: since } },
        select: {
          id: true,
          classId: true,
          isDelivered: true,
          content: { select: { subject: true, payload: true } },
        },
      }),
      prisma.studentProgress.findMany({
        where: {
          scheduledWork: {
            class: { schoolId },
            scheduledDate: { gte: since },
          },
        },
        select: {
          scheduledWorkId: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.assessmentAttempt.findMany({
        where: {
          schoolId,
          attemptedAt: { gte: since },
          score: { not: null },
        },
        select: {
          classId: true,
          subject: true,
          score: true,
        },
      }),
      prisma.learningEvent.findMany({
        where: {
          schoolId,
          createdAt: { gte: since },
          studentId: { not: null },
        },
        distinct: ["studentId"],
        select: { studentId: true },
      }),
      prisma.student.count({
        where: {
          deletedAt: null,
          user: { schoolId },
        },
      }),
    ]);

  const classMeta = new Map(
    classes.map((row) => [
      row.id,
      {
        name: row.name,
        subject: String(row.subject),
        teacherId: row.teacherId ?? "unassigned",
        teacherName: row.Teacher?.name ?? row.Teacher?.email ?? "Unassigned teacher",
        enrollmentCount: row._count.enrollments,
      },
    ])
  );
  const progressByWork = new Map<string, { started: number; completed: number }>();
  for (const row of progress) {
    const current = progressByWork.get(row.scheduledWorkId) ?? { started: 0, completed: 0 };
    if (row.startedAt || row.completedAt) current.started += 1;
    if (row.completedAt) current.completed += 1;
    progressByWork.set(row.scheduledWorkId, current);
  }

  const classScores = new Map<string, number[]>();
  const subjectScores = new Map<string, number[]>();
  for (const attempt of attempts) {
    if (typeof attempt.score !== "number") continue;
    if (attempt.classId) {
      const classList = classScores.get(attempt.classId) ?? [];
      classList.push(attempt.score);
      classScores.set(attempt.classId, classList);
    }
    const subject = attempt.subject ?? "GENERAL";
    const subjectList = subjectScores.get(subject) ?? [];
    subjectList.push(attempt.score);
    subjectScores.set(subject, subjectList);
  }

  const bandCounts = new Map<ScoreBand["label"], number>([
    ["0-49", 0],
    ["50-64", 0],
    ["65-79", 0],
    ["80-100", 0],
  ]);
  for (const scores of classScores.values()) {
    const score = average(scores);
    if (score != null) {
      const label = scoreBand(clampPercent(score * 100));
      bandCounts.set(label, (bandCounts.get(label) ?? 0) + 1);
    }
  }

  const teacherBuckets = new Map<
    string,
    {
      teacherId: string;
      teacherName: string;
      classIds: Set<string>;
      scheduledLessons: number;
      deliveredLessons: number;
      expectedCompletions: number;
      completions: number;
      scores: number[];
    }
  >();
  const subjectCompletion = new Map<
    string,
    { scheduledLessons: number; expectedCompletions: number; completions: number }
  >();
  const classCompletion = new Map<
    string,
    { className: string; subject: string; scheduledLessons: number; expected: number; completed: number }
  >();

  for (const work of scheduledWork) {
    const meta = classMeta.get(work.classId);
    const teacherId = meta?.teacherId ?? "unassigned";
    const teacherBucket = teacherBuckets.get(teacherId) ?? {
      teacherId,
      teacherName: meta?.teacherName ?? "Unassigned teacher",
      classIds: new Set<string>(),
      scheduledLessons: 0,
      deliveredLessons: 0,
      expectedCompletions: 0,
      completions: 0,
      scores: [],
    };
    teacherBucket.classIds.add(work.classId);
    teacherBucket.scheduledLessons += 1;
    if (work.isDelivered) teacherBucket.deliveredLessons += 1;

    const enrollmentCount = meta?.enrollmentCount ?? 0;
    const workProgress = progressByWork.get(work.id) ?? { started: 0, completed: 0 };
    teacherBucket.expectedCompletions += enrollmentCount;
    teacherBucket.completions += workProgress.completed;
    teacherBuckets.set(teacherId, teacherBucket);

    const subject = subjectFromPayload(work.content.payload, work.content.subject);
    const subjectBucket = subjectCompletion.get(subject) ?? {
      scheduledLessons: 0,
      expectedCompletions: 0,
      completions: 0,
    };
    subjectBucket.scheduledLessons += 1;
    subjectBucket.expectedCompletions += enrollmentCount;
    subjectBucket.completions += workProgress.completed;
    subjectCompletion.set(subject, subjectBucket);

    const classBucket = classCompletion.get(work.classId) ?? {
      className: meta?.name ?? "Class",
      subject: meta?.subject ?? subject,
      scheduledLessons: 0,
      expected: 0,
      completed: 0,
    };
    classBucket.scheduledLessons += 1;
    classBucket.expected += enrollmentCount;
    classBucket.completed += workProgress.completed;
    classCompletion.set(work.classId, classBucket);
  }

  for (const [classId, scores] of classScores) {
    const teacherId = classMeta.get(classId)?.teacherId ?? "unassigned";
    const bucket = teacherBuckets.get(teacherId);
    if (bucket) bucket.scores.push(...scores);
  }

  const lessonStarts = progress.filter((row) => row.startedAt || row.completedAt).length;
  const lessonCompletions = progress.filter((row) => row.completedAt).length;

  const weakSubjects = Array.from(subjectCompletion.entries())
    .map(([subject, completion]) => {
      const scores = subjectScores.get(subject) ?? [];
      const avgScore = average(scores);
      const completionRate = pct(completion.completions, completion.expectedCompletions);
      const averageQuizScorePct = avgScore == null ? null : clampPercent(avgScore * 100);
      const reasons = [];
      if (averageQuizScorePct != null && averageQuizScorePct < 70) {
        reasons.push(`quiz average ${averageQuizScorePct}%`);
      }
      if (completionRate < 70) {
        reasons.push(`completion ${completionRate}%`);
      }
      return {
        subject,
        averageQuizScorePct,
        lessonCompletionRatePct: completionRate,
        attempts: scores.length,
        scheduledLessons: completion.scheduledLessons,
        reason: reasons.join(", ") || "no weak signal",
      };
    })
    .filter((row) => row.reason !== "no weak signal")
    .sort((left, right) => {
      const leftScore = left.averageQuizScorePct ?? 100;
      const rightScore = right.averageQuizScorePct ?? 100;
      return leftScore - rightScore || left.lessonCompletionRatePct - right.lessonCompletionRatePct;
    })
    .slice(0, 6);

  return {
    classPerformanceDistribution: Array.from(bandCounts.entries()).map(([label, count]) => ({
      label,
      count,
    })),
    engagementLevels: {
      totalStudents,
      activeStudents: activeEvents.filter((event) => event.studentId).length,
      activeRatePct: pct(activeEvents.filter((event) => event.studentId).length, totalStudents),
      lessonStarts,
      lessonCompletions,
      completionRatePct: pct(lessonCompletions, lessonStarts),
    },
    teacherEffectiveness: Array.from(teacherBuckets.values())
      .map((bucket) => {
        const avgScore = average(bucket.scores);
        return {
          teacherId: bucket.teacherId,
          teacherName: bucket.teacherName,
          classCount: bucket.classIds.size,
          scheduledLessons: bucket.scheduledLessons,
          deliveredLessons: bucket.deliveredLessons,
          deliveryRatePct: pct(bucket.deliveredLessons, bucket.scheduledLessons),
          lessonCompletionRatePct: pct(bucket.completions, bucket.expectedCompletions),
          averageQuizScorePct: avgScore == null ? null : clampPercent(avgScore * 100),
        };
      })
      .sort((left, right) => right.lessonCompletionRatePct - left.lessonCompletionRatePct),
    weakSubjects,
    lowCompletionClasses: Array.from(classCompletion.entries())
      .map(([classId, row]) => ({
        classId,
        className: row.className,
        subject: row.subject,
        completionRatePct: pct(row.completed, row.expected),
        scheduledLessons: row.scheduledLessons,
      }))
      .filter((row) => row.completionRatePct < 70 && row.scheduledLessons > 0)
      .sort((left, right) => left.completionRatePct - right.completionRatePct)
      .slice(0, 6),
  };
}

export async function buildMoeDecisionIntelligence(
  days = 30
): Promise<MoeDecisionIntelligence> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [schools, scheduledWork, attempts, activeEvents, totalStudents] = await Promise.all([
    prisma.school.findMany({
      select: {
        id: true,
        name: true,
        district: true,
        districtId: true,
        District: { select: { id: true, name: true } },
        _count: { select: { users: { where: { role: "STUDENT" } } } },
      },
    }),
    prisma.scheduledWork.findMany({
      where: { scheduledDate: { gte: since } },
      select: {
        id: true,
        isDelivered: true,
        class: { select: { schoolId: true } },
        content: { select: { subject: true, payload: true } },
      },
    }),
    prisma.assessmentAttempt.findMany({
      where: { attemptedAt: { gte: since }, score: { not: null } },
      select: { schoolId: true, subject: true, score: true },
    }),
    prisma.learningEvent.findMany({
      where: { createdAt: { gte: since }, schoolId: { not: null }, studentId: { not: null } },
      distinct: ["schoolId", "studentId"],
      select: { schoolId: true, studentId: true },
    }),
    prisma.student.count({ where: { deletedAt: null } }),
  ]);

  const schoolMeta = new Map(
    schools.map((school) => {
      const districtId = school.District?.id ?? school.districtId ?? school.district ?? "unknown";
      const districtName = school.District?.name ?? school.district ?? "Unassigned district";
      return [
        school.id,
        {
          schoolId: school.id,
          schoolName: school.name,
          districtId,
          districtName,
          studentCount: school._count.users,
        },
      ] as const;
    })
  );

  const schoolDelivery = new Map<string, { total: number; delivered: number; subjects: Map<string, { total: number; delivered: number }> }>();
  const subjectAdoption = new Map<string, { total: number; delivered: number }>();
  for (const work of scheduledWork) {
    const schoolId = work.class.schoolId;
    const subject = subjectFromPayload(work.content.payload, work.content.subject);
    const schoolBucket = schoolDelivery.get(schoolId) ?? {
      total: 0,
      delivered: 0,
      subjects: new Map<string, { total: number; delivered: number }>(),
    };
    schoolBucket.total += 1;
    if (work.isDelivered) schoolBucket.delivered += 1;
    const subjectBucket = schoolBucket.subjects.get(subject) ?? { total: 0, delivered: 0 };
    subjectBucket.total += 1;
    if (work.isDelivered) subjectBucket.delivered += 1;
    schoolBucket.subjects.set(subject, subjectBucket);
    schoolDelivery.set(schoolId, schoolBucket);

    const adoption = subjectAdoption.get(subject) ?? { total: 0, delivered: 0 };
    adoption.total += 1;
    if (work.isDelivered) adoption.delivered += 1;
    subjectAdoption.set(subject, adoption);
  }

  const activeBySchool = new Map<string, Set<string>>();
  for (const event of activeEvents) {
    if (!event.schoolId || !event.studentId) continue;
    const set = activeBySchool.get(event.schoolId) ?? new Set<string>();
    set.add(event.studentId);
    activeBySchool.set(event.schoolId, set);
  }

  const scoresBySchool = new Map<string, number[]>();
  const scoresByDistrictSubject = new Map<string, { scores: number[]; districtId: string; districtName: string; subject: string }>();
  for (const attempt of attempts) {
    if (!attempt.schoolId || typeof attempt.score !== "number") continue;
    const school = schoolMeta.get(attempt.schoolId);
    const subject = attempt.subject ?? "GENERAL";
    const schoolScores = scoresBySchool.get(attempt.schoolId) ?? [];
    schoolScores.push(attempt.score);
    scoresBySchool.set(attempt.schoolId, schoolScores);

    const districtId = school?.districtId ?? "unknown";
    const districtName = school?.districtName ?? "Unassigned district";
    const key = `${districtId}::${subject}`;
    const bucket = scoresByDistrictSubject.get(key) ?? {
      scores: [],
      districtId,
      districtName,
      subject,
    };
    bucket.scores.push(attempt.score);
    scoresByDistrictSubject.set(key, bucket);
  }

  const schoolComparisons = Array.from(schoolMeta.values())
    .map((school) => {
      const scores = scoresBySchool.get(school.schoolId) ?? [];
      const avgScore = average(scores);
      const delivery = schoolDelivery.get(school.schoolId) ?? {
        total: 0,
        delivered: 0,
      };
      const activeStudents = activeBySchool.get(school.schoolId)?.size ?? 0;
      return {
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        districtName: school.districtName,
        studentCount: school.studentCount,
        averageQuizScorePct: avgScore == null ? null : clampPercent(avgScore * 100),
        deliveryRatePct: pct(delivery.delivered, delivery.total),
        activeRatePct: pct(activeStudents, school.studentCount),
      };
    })
    .sort((left, right) => {
      const leftScore = left.averageQuizScorePct ?? 0;
      const rightScore = right.averageQuizScorePct ?? 0;
      return rightScore - leftScore;
    });

  const districtBuckets = new Map<
    string,
    { districtId: string; districtName: string; schools: Set<string>; students: number; scores: number[]; delivered: number; total: number; active: number }
  >();
  for (const school of schoolMeta.values()) {
    const bucket = districtBuckets.get(school.districtId) ?? {
      districtId: school.districtId,
      districtName: school.districtName,
      schools: new Set<string>(),
      students: 0,
      scores: [],
      delivered: 0,
      total: 0,
      active: 0,
    };
    bucket.schools.add(school.schoolId);
    bucket.students += school.studentCount;
    bucket.scores.push(...(scoresBySchool.get(school.schoolId) ?? []));
    const delivery = schoolDelivery.get(school.schoolId);
    bucket.total += delivery?.total ?? 0;
    bucket.delivered += delivery?.delivered ?? 0;
    bucket.active += activeBySchool.get(school.schoolId)?.size ?? 0;
    districtBuckets.set(school.districtId, bucket);
  }

  const totalDelivered = Array.from(schoolDelivery.values()).reduce(
    (sum, row) => sum + row.delivered,
    0
  );
  const totalScheduled = Array.from(schoolDelivery.values()).reduce(
    (sum, row) => sum + row.total,
    0
  );
  const activeNational = Array.from(activeBySchool.values()).reduce(
    (sum, set) => sum + set.size,
    0
  );

  return {
    districtComparisons: Array.from(districtBuckets.values())
      .map((bucket) => {
        const avgScore = average(bucket.scores);
        return {
          districtId: bucket.districtId,
          districtName: bucket.districtName,
          schoolCount: bucket.schools.size,
          studentCount: bucket.students,
          averageQuizScorePct: avgScore == null ? null : clampPercent(avgScore * 100),
          deliveryRatePct: pct(bucket.delivered, bucket.total),
          activeRatePct: pct(bucket.active, bucket.students),
        };
      })
      .sort((left, right) => {
        const leftScore = left.averageQuizScorePct ?? 0;
        const rightScore = right.averageQuizScorePct ?? 0;
        return rightScore - leftScore || right.deliveryRatePct - left.deliveryRatePct;
      }),
    schoolComparisons: schoolComparisons.slice(0, 12),
    subjectWeaknessHeatmap: Array.from(scoresByDistrictSubject.values())
      .map((bucket) => {
        const avgScore = average(bucket.scores);
        const scorePct = avgScore == null ? null : clampPercent(avgScore * 100);
        const severity: "low" | "medium" | "high" =
          scorePct == null || scorePct >= 70
            ? "low"
            : scorePct < 50
              ? "high"
              : "medium";
        return {
          subject: bucket.subject,
          districtId: bucket.districtId,
          districtName: bucket.districtName,
          averageQuizScorePct: scorePct,
          attempts: bucket.scores.length,
          severity,
        };
      })
      .filter((row) => row.severity !== "low")
      .sort((left, right) => (left.averageQuizScorePct ?? 100) - (right.averageQuizScorePct ?? 100))
      .slice(0, 12),
    curriculumAdoptionTrends: Array.from(subjectAdoption.entries())
      .map(([subject, row]) => ({
        subject,
        scheduledLessons: row.total,
        deliveredLessons: row.delivered,
        deliveryRatePct: pct(row.delivered, row.total),
      }))
      .sort((left, right) => right.scheduledLessons - left.scheduledLessons),
    readinessDeliverySummary: {
      schoolsWithActivity: activeBySchool.size,
      schoolsWithDeliveredLessons: Array.from(schoolDelivery.values()).filter(
        (row) => row.delivered > 0
      ).length,
      deliveryRatePct: pct(totalDelivered, totalScheduled),
      nationalActiveRatePct: pct(activeNational, totalStudents),
    },
  };
}
