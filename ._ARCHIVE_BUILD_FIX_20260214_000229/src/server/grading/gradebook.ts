// src/server/grading/gradebook.ts
import { PrismaClient } from "@prisma/client";

export type GradebookResult = {
  classId: string;
  studentId: string;
  overallPercent: number; // 0..100
  byCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    weightPercent: number; // 0..100
    earnedPoints: number;
    possiblePoints: number;
    categoryPercent: number; // 0..100
    weightedContribution: number; // 0..100
  }>;
  computedAt: string;
};

function safeNumber(n: any, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Computes a student's weighted grade for a class using:
 * - GradeCategory (category weights)
 * - GradableItem (points + category + countsTowardGrade + lockState)
 * - GradeRecord (score for a submission)
 *
 * Notes:
 * - We treat any GradableItem as gradable: assessments, assignments, labs, projects.
 * - A GradableItem is included if:
 *    - countsTowardGrade = true
 *    - lockState != "ARCHIVED" (if you use it)
 *    - submission has a GradeRecord OR score exists
 */
export async function computeStudentGradebook(
  prisma: PrismaClient,
  classId: string,
  studentId: string
): Promise<GradebookResult> {
  // 1) Load class policy + categories
  const [policy, categories] = await Promise.all([
    prisma.classGradePolicy.findUnique({
      where: { classId },
    }),
    prisma.gradeCategory.findMany({
      where: { classId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Default behavior if teacher hasn't set categories yet:
  // - If no categories exist, treat everything as 100% "General"
  const hasCategories = categories.length > 0;

  // 2) Pull all gradable items for the class that count toward grade
  const items = await prisma.gradableItem.findMany({
    where: {
      classId,
      countsTowardGrade: true,
      // If you have lockState enum/string, exclude archived:
      // lockState: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      title: true,
      maxPoints: true,
      categoryId: true,
    },
  });

  if (items.length === 0) {
    return {
      classId,
      studentId,
      overallPercent: 0,
      byCategory: hasCategories
        ? categories.map((c) => ({
            categoryId: c.id,
            categoryName: c.name,
            weightPercent: safeNumber(c.weightPercent),
            earnedPoints: 0,
            possiblePoints: 0,
            categoryPercent: 0,
            weightedContribution: 0,
          }))
        : [
            {
              categoryId: null,
              categoryName: "General",
              weightPercent: 100,
              earnedPoints: 0,
              possiblePoints: 0,
              categoryPercent: 0,
              weightedContribution: 0,
            },
          ],
      computedAt: new Date().toISOString(),
    };
  }

  const itemIds = items.map((i) => i.id);

  // 3) Pull student submissions for those items
  // We assume:
  // - GradableSubmission links student + gradableItem
  // - GradeRecord links to submissionId with pointsEarned/scorePercent/etc
  const submissions = await prisma.gradableSubmission.findMany({
    where: {
      gradableItemId: { in: itemIds },
      studentId,
    },
    select: {
      id: true,
      gradableItemId: true,
      // If you allow group submissions, you can add fields here later
      gradeRecords: {
        orderBy: { createdAt: "desc" },
        take: 1, // use most recent record by default
        select: {
          id: true,
          pointsEarned: true,
          percent: true,
          lockState: true,
        },
      },
    },
  });

  // Build quick lookup: itemId -> latestGradeRecord
  const latestByItem = new Map<
    string,
    { pointsEarned: number | null; percent: number | null }
  >();

  for (const s of submissions) {
    const gr = s.gradeRecords?.[0];
    if (!gr) continue;
    latestByItem.set(s.gradableItemId, {
      pointsEarned: gr.pointsEarned ?? null,
      percent: gr.percent ?? null,
    });
  }

  // 4) Compute per-category totals
  type Bucket = {
    categoryId: string | null;
    categoryName: string;
    weightPercent: number;
    earnedPoints: number;
    possiblePoints: number;
  };

  const buckets = new Map<string, Bucket>();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const defaultWeightMode = policy?.weightingMode ?? "CATEGORY"; // safe default

  function bucketKey(categoryId: string | null) {
    return categoryId ?? "__general__";
  }

  function ensureBucket(categoryId: string | null): Bucket {
    const key = bucketKey(categoryId);
    const existing = buckets.get(key);
    if (existing) return existing;

    if (!hasCategories || categoryId === null) {
      const b: Bucket = {
        categoryId: null,
        categoryName: "General",
        weightPercent: 100,
        earnedPoints: 0,
        possiblePoints: 0,
      };
      buckets.set(key, b);
      return b;
    }

    const cat = categoryById.get(categoryId);
    const b: Bucket = {
      categoryId,
      categoryName: cat?.name ?? "Uncategorized",
      weightPercent: safeNumber(cat?.weightPercent ?? 0),
      earnedPoints: 0,
      possiblePoints: 0,
    };
    buckets.set(key, b);
    return b;
  }

  for (const item of items) {
    const grade = latestByItem.get(item.id);
    if (!grade) continue; // not graded yet

    const possible = safeNumber(item.maxPoints, 0);
    if (possible <= 0) continue;

    // Use pointsEarned if available; otherwise percent * possible
    let earned = 0;
    if (grade.pointsEarned !== null && grade.pointsEarned !== undefined) {
      earned = safeNumber(grade.pointsEarned, 0);
    } else if (grade.percent !== null && grade.percent !== undefined) {
      earned = (safeNumber(grade.percent, 0) / 100) * possible;
    }

    earned = clamp(earned, 0, possible);

    const b = ensureBucket(hasCategories ? (item.categoryId ?? null) : null);
    b.earnedPoints += earned;
    b.possiblePoints += possible;
  }

  // If categories exist, make sure every category appears (even empty)
  if (hasCategories) {
    for (const c of categories) ensureBucket(c.id);
  }

  // 5) Compute weighted total
  const byCategory = Array.from(buckets.values()).map((b) => {
    const categoryPercent =
      b.possiblePoints > 0 ? (b.earnedPoints / b.possiblePoints) * 100 : 0;

    return {
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      weightPercent: clamp(safeNumber(b.weightPercent, 0), 0, 100),
      earnedPoints: Math.round(b.earnedPoints * 100) / 100,
      possiblePoints: Math.round(b.possiblePoints * 100) / 100,
      categoryPercent: Math.round(categoryPercent * 100) / 100,
      weightedContribution: 0, // fill next
    };
  });

  let overall = 0;

  if (!hasCategories || defaultWeightMode === "POINTS") {
    // POINTS mode: overall is simply total earned / total possible
    const totalEarned = byCategory.reduce((a, c) => a + c.earnedPoints, 0);
    const totalPossible = byCategory.reduce((a, c) => a + c.possiblePoints, 0);
    overall = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

    // Contributions purely informational
    for (const c of byCategory) {
      c.weightedContribution =
        totalPossible > 0 ? (c.earnedPoints / totalPossible) * 100 : 0;
      c.weightedContribution = Math.round(c.weightedContribution * 100) / 100;
    }
  } else {
    // CATEGORY mode: normalize category weights to 100 and sum
    const sumWeights = byCategory.reduce((a, c) => a + c.weightPercent, 0) || 0;

    const normalized = sumWeights > 0 ? sumWeights : 100;

    for (const c of byCategory) {
      const w = sumWeights > 0 ? c.weightPercent / normalized : 0;
      const contrib = w * c.categoryPercent;
      c.weightedContribution = Math.round(contrib * 100) / 100;
      overall += contrib;
    }
  }

  overall = clamp(overall, 0, 100);
  overall = Math.round(overall * 100) / 100;

  return {
    classId,
    studentId,
    overallPercent: overall,
    byCategory,
    computedAt: new Date().toISOString(),
  };
}


