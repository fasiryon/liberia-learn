import { prisma } from "@/lib/db";

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

export async function getQueueOperationsReport(schoolId?: string | null) {
  const now = new Date();
  const tasks = await prisma.curriculumReviewTask.findMany({
    where: { ...(schoolId !== undefined ? { schoolId } : {}) },
    select: { status: true, priorityBand: true, createdAt: true, dueAt: true, completedAt: true },
  });
  const open = tasks.filter((task) => !["COMPLETED", "CANCELLED", "EXPIRED"].includes(task.status));
  const agesHours = open.map((task) => (now.getTime() - task.createdAt.getTime()) / 3_600_000);
  const turnaroundHours = tasks
    .filter((task) => task.completedAt)
    .map((task) => ((task.completedAt as Date).getTime() - task.createdAt.getTime()) / 3_600_000);
  const activeClaims = await prisma.curriculumReviewAssignment.count({ where: { status: "ACTIVE", leaseExpiresAt: { gt: now } } });
  const abandonedClaims = await prisma.curriculumReviewAssignment.count({ where: { status: "EXPIRED" } });
  return {
    generatedAt: now,
    sampleSize: tasks.length,
    openVolume: open.length,
    byStatus: Object.fromEntries(Array.from(new Set(tasks.map((task) => task.status))).map((status) => [status, tasks.filter((task) => task.status === status).length])),
    byRiskBand: Object.fromEntries(Array.from(new Set(tasks.map((task) => task.priorityBand))).map((band) => [band, tasks.filter((task) => task.priorityBand === band).length])),
    ageP90Hours: percentile(agesHours, 0.9),
    turnaroundP90Hours: percentile(turnaroundHours, 0.9),
    slaWarning: open.filter((task) => task.dueAt > now && task.dueAt.getTime() - now.getTime() <= 3_600_000).length,
    slaBreached: open.filter((task) => task.dueAt <= now).length,
    throughput: tasks.filter((task) => task.completedAt).length,
    activeClaims,
    abandonedClaims,
  };
}

export async function getReviewerQualityReport(reviewerProfileId?: string) {
  const assessments = await prisma.curriculumReviewAssessment.findMany({
    where: { status: "SUBMITTED", ...(reviewerProfileId ? { reviewerProfileId } : {}) },
    include: { task: { include: { assessments: { where: { status: "SUBMITTED" } } } } },
  });
  const comparable = assessments.filter((assessment) => assessment.task.assessments.length >= 2);
  const agreementCount = comparable.filter((assessment) =>
    assessment.task.assessments.some((other) => other.id !== assessment.id && other.recommendation === assessment.recommendation),
  ).length;
  const sampleSize = comparable.length;
  return {
    reviewerProfileId: reviewerProfileId ?? null,
    sampleSize,
    suppressed: Boolean(reviewerProfileId) && sampleSize < 5,
    metrics: reviewerProfileId && sampleSize < 5
      ? null
      : {
          agreementRate: sampleSize ? agreementCount / sampleSize : null,
          disagreementRate: sampleSize ? (sampleSize - agreementCount) / sampleSize : null,
          escalationRate: sampleSize ? comparable.filter((assessment) => assessment.recommendation === "ESCALATE").length / sampleSize : null,
        },
    interpretation: "Diagnostic only. This report is not a personnel ranking.",
  };
}

export async function getCredentialCoverageReport() {
  const scopes = await prisma.reviewerCredentialScope.findMany({
    where: { credential: { status: "VERIFIED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
    include: { credential: { select: { credentialType: true, authority: true } } },
  });
  return {
    generatedAt: new Date(),
    sampleSize: scopes.length,
    coverage: scopes.map((scope) => ({
      credentialType: scope.credential.credentialType,
      authority: scope.credential.authority,
      subject: scope.subject,
      gradeMin: scope.gradeMin,
      gradeMax: scope.gradeMax,
      domains: scope.domains,
      curriculumScopes: scope.curriculumScopes,
      schoolId: scope.schoolId,
    })),
  };
}
