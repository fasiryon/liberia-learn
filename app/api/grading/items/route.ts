import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * NOTE:
 * This endpoint is “ready”, but it expects you to add Prisma models:
 * - GradableItem, GradeCategory, ClassGradePolicy, etc.
 *
 * Until then, it returns a helpful error instead of crashing.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Minimal validation
    const required = ["classId", "title", "type", "scoringType", "gradingMethod", "countsTowardGrade"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return NextResponse.json({ error: `Missing required field: ${k}` }, { status: 400 });
      }
    }

    // If your schema doesn't have GradableItem yet, fail gracefully.
    if (!(prisma as any).gradableItem) {
      return NextResponse.json(
        {
          error: "GradableItem model not found in Prisma client yet.",
          fix: "Add GradableItem to schema.prisma, run: npx prisma generate"
        },
        { status: 501 }
      );
    }

    const item = await (prisma as any).gradableItem.create({
      data: {
        classId: body.classId,
        title: body.title,
        description: body.description ?? null,
        type: body.type,
        scoringType: body.scoringType,
        gradingMethod: body.gradingMethod,
        countsTowardGrade: Boolean(body.countsTowardGrade),
        categoryId: body.categoryId ?? null,
        maxPoints: body.maxPoints ?? null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        publishedToParents: Boolean(body.publishedToParents ?? false),
        improvementPolicy: body.improvementPolicy ?? null,
        checkpointSequence: body.checkpointSequence ?? null,
        lockState: "DRAFT"
      }
    });

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to create item", details: String(e?.message ?? e) }, { status: 500 });
  }
}

