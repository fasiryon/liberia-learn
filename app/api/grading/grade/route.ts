import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { computePercent } from "@/src/lib/grading/engine";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = ["submissionId", "scorePoints"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return NextResponse.json({ error: `Missing required field: ${k}` }, { status: 400 });
      }
    }

    if (!(prisma as any).gradeRecord) {
      return NextResponse.json(
        {
          error: "GradeRecord model not found in Prisma client yet.",
          fix: "Add GradeRecord (and GradableItem) to schema.prisma, run: npx prisma generate"
        },
        { status: 501 }
      );
    }

    // Load submission + item for maxPoints
    const sub = await (prisma as any).gradableSubmission.findUnique({
      where: { id: body.submissionId },
      include: { item: true } // expects relation alias: item -> GradableItem
    });

    if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    const maxPoints = sub.item?.maxPoints ?? 100;
    const percent = computePercent(Number(body.scorePoints), Number(maxPoints));

    const record = await (prisma as any).gradeRecord.upsert({
      where: { submissionId: sub.id },
      create: {
        submissionId: sub.id,
        scorePoints: Number(body.scorePoints),
        scorePercent: percent,
        rubricResult: body.rubricResult ?? null,
        feedbackText: body.feedbackText ?? null,
        gradedByUserId: body.gradedByUserId ?? null,
        gradedAt: new Date(),
        aiConfidence: body.aiConfidence ?? null,
        humanReviewed: Boolean(body.humanReviewed ?? true)
      },
      update: {
        scorePoints: Number(body.scorePoints),
        scorePercent: percent,
        rubricResult: body.rubricResult ?? null,
        feedbackText: body.feedbackText ?? null,
        gradedByUserId: body.gradedByUserId ?? null,
        gradedAt: new Date(),
        aiConfidence: body.aiConfidence ?? null,
        humanReviewed: Boolean(body.humanReviewed ?? true)
      }
    });

    // Mark submission graded
    await (prisma as any).gradableSubmission.update({
      where: { id: sub.id },
      data: { status: "GRADED" }
    });

    return NextResponse.json({ ok: true, gradeRecord: record }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to grade submission", details: String(e?.message ?? e) }, { status: 500 });
  }
}
