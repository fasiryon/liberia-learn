import { prisma } from "@/lib/db";

export type GradePipelineStatus = "NOT_STARTED" | "PROCESSING" | "BLOCKED" | "COMPLETE";

export type GradePipelineProgress = {
  grade: number;
  subjects: string[];
  curriculumCompletionPct: number;
  audioCompletionPct: number;
  textbookCompletionPct: number;
  status: GradePipelineStatus;
  currentSubject: string | null;
  errorMessage: string | null;
};

type SafetyOptions = {
  maxGradesPerDay?: number;
  costThresholdUsd?: number;
  maxFailureRate?: number;
  allowParallelGrades?: boolean;
  lockTtlMs?: number;
};

const DEFAULT_MAX_GRADES_PER_DAY = 3;
const DEFAULT_COST_THRESHOLD_USD = 25;
const DEFAULT_MAX_FAILURE_RATE = 0.2;
const DEFAULT_LOCK_TTL_MS = 60 * 60 * 1000;
const GRADE_PIPELINE_LOCK_KEY = "grade-pipeline";
const DEFAULT_TEXTBOOK_FORMATS = ["student"];

function normalizeSubjects(subjects: string[]) {
  return [...new Set(subjects.map((subject) => subject.trim().toUpperCase()).filter(Boolean))].sort();
}

function pct(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function getSafetyBlockReason(options: SafetyOptions = {}) {
  const maxGradesPerDay = options.maxGradesPerDay ?? DEFAULT_MAX_GRADES_PER_DAY;
  const costThresholdUsd = options.costThresholdUsd ?? DEFAULT_COST_THRESHOLD_USD;
  const maxFailureRate = options.maxFailureRate ?? DEFAULT_MAX_FAILURE_RATE;
  const today = startOfUtcDay();

  const [completedToday, audioCost, textbookCost, totalJobs, failedJobs] = await Promise.all([
    prisma.gradePipelineJob.count({
      where: { completedAt: { gte: today } },
    }),
    prisma.lessonAudio.aggregate({
      where: { generatedAt: { gte: today } },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.textbookGenerationJob.aggregate({
      where: { generatedAt: { gte: today } },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.gradePipelineJob.count(),
    prisma.gradePipelineJob.count({ where: { status: "BLOCKED" } }),
  ]);

  if (completedToday >= maxGradesPerDay) return "Max grades per day reached";

  const costToday =
    Number(audioCost._sum.estimatedCostUsd ?? 0) +
    Number(textbookCost._sum.estimatedCostUsd ?? 0);
  if (costToday > costThresholdUsd) return "Pipeline cost threshold exceeded";

  if (totalJobs > 0 && failedJobs / totalJobs > maxFailureRate) {
    return "Pipeline failure rate exceeded";
  }

  return null;
}

async function acquireGradeLock(owner: string, options: SafetyOptions = {}) {
  if (options.allowParallelGrades) return true;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS));
  const updated = await prisma.pipelineLock.updateMany({
    where: {
      lockKey: GRADE_PIPELINE_LOCK_KEY,
      OR: [{ expiresAt: { lt: now } }, { owner }],
    },
    data: { owner, expiresAt },
  });
  if (updated.count === 1) return true;

  try {
    await prisma.pipelineLock.create({
      data: { lockKey: GRADE_PIPELINE_LOCK_KEY, owner, expiresAt },
    });
    return true;
  } catch {
    return false;
  }
}

async function releaseGradeLock(owner: string) {
  await prisma.pipelineLock.deleteMany({
    where: { lockKey: GRADE_PIPELINE_LOCK_KEY, owner },
  });
}

export async function enqueueGrade(input: { grade: number; subjects: string[] }) {
  const grade = Number(input.grade);
  const subjects = normalizeSubjects(input.subjects);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    throw Object.assign(new Error("grade must be between 1 and 12."), { status: 400 });
  }
  if (subjects.length === 0) {
    throw Object.assign(new Error("at least one subject is required."), { status: 400 });
  }

  return prisma.gradePipelineJob.upsert({
    where: { grade },
    update: {
      subjects,
      status: "NOT_STARTED",
      currentSubject: null,
      errorMessage: null,
      failedAt: null,
    },
    create: { grade, subjects, status: "NOT_STARTED" },
  });
}

export async function getNextGrade(options: SafetyOptions = {}) {
  const blockReason = await getSafetyBlockReason(options);
  if (blockReason) return null;
  if (!options.allowParallelGrades) {
    const activeLock = await prisma.pipelineLock.findFirst({
      where: {
        lockKey: GRADE_PIPELINE_LOCK_KEY,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (activeLock) return null;
  }

  return prisma.gradePipelineJob.findFirst({
    where: { status: "NOT_STARTED" },
    orderBy: [{ grade: "asc" }, { createdAt: "asc" }],
  });
}

export async function markGradeProcessing(input: {
  grade: number;
  currentSubject?: string;
  owner?: string;
  allowParallelGrades?: boolean;
}) {
  const owner = input.owner ?? `grade-${input.grade}`;
  const locked = await acquireGradeLock(owner, {
    allowParallelGrades: input.allowParallelGrades,
  });
  if (!locked) return null;

  const updated = await prisma.gradePipelineJob.updateMany({
    where: { grade: input.grade, status: { in: ["NOT_STARTED", "BLOCKED"] } },
    data: {
      status: "PROCESSING",
      currentSubject: input.currentSubject?.trim().toUpperCase() ?? null,
      errorMessage: null,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (updated.count !== 1) {
    await releaseGradeLock(owner);
    return null;
  }

  return prisma.gradePipelineJob.findUnique({ where: { grade: input.grade } });
}

export async function markGradeComplete(input: { grade: number; owner?: string }) {
  const owner = input.owner ?? `grade-${input.grade}`;
  const result = await prisma.gradePipelineJob.update({
    where: { grade: input.grade },
    data: {
      status: "COMPLETE",
      currentSubject: null,
      errorMessage: null,
      completedAt: new Date(),
    },
  });
  await releaseGradeLock(owner);
  return result;
}

export async function markGradeFailed(input: { grade: number; errorMessage: string; owner?: string }) {
  const owner = input.owner ?? `grade-${input.grade}`;
  const result = await prisma.gradePipelineJob.update({
    where: { grade: input.grade },
    data: {
      status: "BLOCKED",
      errorMessage: input.errorMessage.slice(0, 1000),
      failedAt: new Date(),
    },
  });
  await releaseGradeLock(owner);
  return result;
}

export async function calculateGradeProgress(input: {
  grade: number;
  subjects?: string[];
}): Promise<Omit<GradePipelineProgress, "status" | "currentSubject" | "errorMessage">> {
  const subjects = normalizeSubjects(input.subjects ?? []);
  const subjectFilter = subjects.length ? { in: subjects } : undefined;

  const lessonWhere = {
    grade: input.grade,
    ...(subjectFilter ? { subject: subjectFilter } : {}),
    contentType: "lesson",
    status: "APPROVED",
  };

  const [lessonCount, audioGenerated, textbookGenerated] = await Promise.all([
    prisma.curriculumContent.count({ where: lessonWhere }),
    prisma.lessonAudio.count({
      where: {
        status: "GENERATED",
        lesson: lessonWhere,
      },
    }),
    prisma.textbookGenerationJob.count({
      where: {
        grade: input.grade,
        ...(subjectFilter ? { subject: subjectFilter } : {}),
        format: { in: DEFAULT_TEXTBOOK_FORMATS },
        status: "GENERATED",
      },
    }),
  ]);

  const textbookTotal = (subjects.length || 1) * DEFAULT_TEXTBOOK_FORMATS.length;

  return {
    grade: input.grade,
    subjects,
    curriculumCompletionPct: lessonCount > 0 ? 100 : 0,
    audioCompletionPct: pct(audioGenerated, lessonCount),
    textbookCompletionPct: pct(textbookGenerated, textbookTotal),
  };
}

export async function getGradePipelineStatus(): Promise<GradePipelineProgress[]> {
  const jobs = await prisma.gradePipelineJob.findMany({
    orderBy: { grade: "asc" },
  });

  return Promise.all(
    jobs.map(async (job) => {
      const progress = await calculateGradeProgress({ grade: job.grade, subjects: job.subjects });
      return {
        ...progress,
        subjects: job.subjects,
        status: job.status as GradePipelineStatus,
        currentSubject: job.currentSubject,
        errorMessage: job.errorMessage,
      };
    })
  );
}

export async function refreshGradeStatusForQueueEvent(input: {
  grade: number;
  subject?: string;
  errorMessage?: string;
}) {
  const job = await prisma.gradePipelineJob.findUnique({ where: { grade: input.grade } });
  if (!job) return null;

  if (input.errorMessage) {
    return markGradeFailed({ grade: input.grade, errorMessage: input.errorMessage });
  }

  const progress = await calculateGradeProgress({ grade: input.grade, subjects: job.subjects });
  if (
    progress.curriculumCompletionPct === 100 &&
    progress.audioCompletionPct === 100 &&
    progress.textbookCompletionPct === 100
  ) {
    return markGradeComplete({ grade: input.grade });
  }

  return prisma.gradePipelineJob.update({
    where: { grade: input.grade },
    data: {
      status: "PROCESSING",
      currentSubject: input.subject?.trim().toUpperCase() ?? job.currentSubject,
    },
  });
}
