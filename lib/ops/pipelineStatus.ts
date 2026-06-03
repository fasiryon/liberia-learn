import { prisma } from "@/lib/db";

export type PipelineStatus = {
  curriculum: {
    approved: number;
    needsReview: number;
    pending: number;
    total: number;
  };
  audio: {
    withAudio: number;
    total: number;
  };
  scaffolds: number;
  codeExercises: {
    total: number;
    validated: number;
  };
};

export async function getPipelineStatus(): Promise<PipelineStatus> {
  try {
    const [approved, needsReview, pending, total, withAudio, audioTotal, scaffolds, codeTotal, codeValidated] =
      await Promise.all([
        prisma.curriculumContent.count({
          where: { status: { in: ["APPROVED", "published", "PUBLISHED"] } },
        }),
        prisma.curriculumContent.count({ where: { status: "NEEDS_REVIEW" } }),
        prisma.curriculumContent.count({
          where: { status: { in: ["PENDING", "DRAFT"] } },
        }),
        prisma.curriculumContent.count(),
        prisma.lessonAudio.count({
          where: { generatedAt: { not: null } },
        }),
        prisma.curriculumContent.count(),
        prisma.lessonVariant.count({ where: { variantType: "scaffold" } }),
        (prisma as any).codeExercise
          ? (prisma as any).codeExercise.count()
          : Promise.resolve(0),
        (prisma as any).codeExercise
          ? (prisma as any).codeExercise.count({
              where: { validatedAt: { not: null } },
            })
          : Promise.resolve(0),
      ]);

    return {
      curriculum: { approved, needsReview, pending, total },
      audio: { withAudio, total: audioTotal },
      scaffolds,
      codeExercises: { total: codeTotal, validated: codeValidated },
    };
  } catch {
    return {
      curriculum: { approved: 0, needsReview: 0, pending: 0, total: 0 },
      audio: { withAudio: 0, total: 0 },
      scaffolds: 0,
      codeExercises: { total: 0, validated: 0 },
    };
  }
}
