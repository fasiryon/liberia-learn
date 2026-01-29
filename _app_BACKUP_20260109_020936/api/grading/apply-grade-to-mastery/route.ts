import { NextResponse } from "next/server";
import { PrismaClient, EvidenceSourceType, MasteryMeasurementType } from "@prisma/client";

export const runtime = "nodejs"; // needed for Prisma in Next

const prisma = new PrismaClient();

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const studentId: string = body.studentId;
    const skillId: string = body.skillId;
    const gradeId: string = body.gradeId;
    const measurementType: MasteryMeasurementType =
      body.measurementType ?? "FORMATIVE";
    const alpha: number = typeof body.alpha === "number" ? body.alpha : 0.35;
    const sourceType: EvidenceSourceType = body.sourceType ?? "ASSESSMENT";
    const weight: number = typeof body.weight === "number" ? body.weight : 1;

    if (!studentId || !skillId || !gradeId) {
      return NextResponse.json(
        { ok: false, error: "studentId, skillId, and gradeId are required" },
        { status: 400 }
      );
    }

    // Grade model fields you confirmed exist: id, percent, letter, computedAt, studentId, classId
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { id: true, percent: true, studentId: true, classId: true, computedAt: true, letter: true },
    });

    if (!grade) {
      return NextResponse.json({ ok: false, error: "Grade not found" }, { status: 404 });
    }

    // Safety: if caller studentId differs, we still apply to provided studentId (you may enforce match later)
    const gradePercent = typeof grade.percent === "number" ? grade.percent : 0;

    // current mastery (longitudinal "current state" table)
    const existing = await prisma.masteryRecord.findUnique({
      where: { studentId_skillId: { studentId, skillId } },
      select: { level: true },
    });

    const previousMastery = clamp(((existing?.level ?? 0) as number) / 100);

    // EMA update: next = (1-a)*prev + a*(grade%)
    const a = clamp(alpha, 0.01, 1);
    const gradeAsMastery = clamp(gradePercent / 100);
    const nextMastery = clamp((1 - a) * previousMastery + a * gradeAsMastery);
    const nextLevel = Math.round(nextMastery * 100);

    // write snapshot (append-only)
    const snapshot = await prisma.objectiveMasterySnapshot.create({
      data: {
        studentId,
        skillId,
        masteryLevel: nextMastery,
        measurementType,
        contextNote: `Auto snapshot from Grade ${gradeId}`,
        // measuredAt defaults to now()
      },
      select: { id: true, measuredAt: true, masteryLevel: true },
    });

    // evidence link
    const evidence = await prisma.masteryEvidence.create({
      data: {
        snapshotId: snapshot.id,
        gradeId,
        sourceType,
        weight,
        note: "API apply-grade-to-mastery",
      },
      select: { id: true, snapshotId: true, gradeId: true, sourceType: true, weight: true },
    });

    // upsert current mastery record
    const masteryRecord = await prisma.masteryRecord.upsert({
      where: { studentId_skillId: { studentId, skillId } },
      create: {
        studentId,
        skillId,
        level: nextLevel,
        lastAssessedAt: new Date(),
      },
      update: {
        level: nextLevel,
        lastAssessedAt: new Date(),
      },
      select: { level: true, lastAssessedAt: true },
    });

    return NextResponse.json({
      ok: true,
      calc: {
        previousMastery,
        gradePercent,
        nextMastery,
        nextLevel,
        alpha: a,
      },
      snapshot,
      evidence,
      masteryRecord,
    });
  } catch (e: any) {
    console.error("apply-grade-to-mastery API error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
