import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

type JsonObject = Record<string, unknown>;

function toJson(value?: JsonObject | null): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

export type TagMisconceptionInput = {
  studentId: string;
  schoolId?: string | null;
  categoryId?: string | null;
  categoryCode?: string | null;
  categoryLabel?: string | null;
  categoryDescription?: string | null;
  subject?: string | null;
  strandKey?: string | null;
  assessmentAttemptId?: string | null;
  interventionId?: string | null;
  chainId?: string | null;
  taggedByUserId?: string | null;
  sourceEventId?: string | null;
  origin?: string | null;
  status?: string | null;
  confidence?: number | null;
  evidence?: JsonObject | null;
  teacherNote?: string | null;
  createCategoryIfMissing?: boolean;
};

async function resolveCategory(input: TagMisconceptionInput) {
  if (input.categoryId) {
    return { id: input.categoryId };
  }

  if (!input.categoryCode) {
    throw new Error("categoryId_or_categoryCode_required");
  }

  if (input.createCategoryIfMissing === false) {
    const existing = await prisma.misconceptionCategory.findFirst({
      where: {
        schoolId: input.schoolId ?? null,
        code: input.categoryCode,
      },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("misconception_category_not_found");
    }
    return existing;
  }

  return prisma.misconceptionCategory.upsert({
    where: {
      MisconceptionCategory_schoolId_code_key: {
        schoolId: input.schoolId ?? null,
        code: input.categoryCode,
      },
    },
    update: {
      label: input.categoryLabel ?? input.categoryCode,
      description: input.categoryDescription ?? null,
      subject: input.subject ?? null,
      strandKey: input.strandKey ?? null,
      isActive: true,
    },
    create: {
      schoolId: input.schoolId ?? null,
      subject: input.subject ?? null,
      strandKey: input.strandKey ?? null,
      code: input.categoryCode,
      label: input.categoryLabel ?? input.categoryCode,
      description: input.categoryDescription ?? null,
      createdByUserId: input.taggedByUserId ?? null,
      isSystem: true,
    },
    select: { id: true },
  });
}

export async function tagMisconception(input: TagMisconceptionInput) {
  const category = await resolveCategory(input);

  const tag = await prisma.misconceptionTag.create({
    data: {
      studentId: input.studentId,
      schoolId: input.schoolId ?? null,
      assessmentAttemptId: input.assessmentAttemptId ?? null,
      interventionId: input.interventionId ?? null,
      chainId: input.chainId ?? null,
      categoryId: category.id,
      status: input.status ?? "active",
      origin: input.origin ?? "assessment_evaluation",
      confidence: input.confidence ?? null,
      evidence: toJson(input.evidence),
      teacherNote: input.teacherNote ?? null,
      taggedByUserId: input.taggedByUserId ?? null,
      sourceEventId: input.sourceEventId ?? null,
    },
  });

  await logLearningEvent({
    schoolId: input.schoolId ?? null,
    studentId: input.studentId,
    userId: input.taggedByUserId ?? null,
    actor: input.taggedByUserId ? { type: "user", id: input.taggedByUserId } : null,
    target: { type: "misconception_tag", id: tag.id },
    eventType: "misconception.tagged",
    source: input.origin ?? "assessment_evaluation",
    metadata: {
      categoryId: category.id,
      assessmentAttemptId: input.assessmentAttemptId ?? null,
      interventionId: input.interventionId ?? null,
      chainId: input.chainId ?? null,
    },
  });

  return tag;
}
