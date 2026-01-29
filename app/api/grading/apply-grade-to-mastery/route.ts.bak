import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERSION = "dup-guard-v1";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { studentId, skillId, gradeId, measurementType = "FORMATIVE", alpha = 0.35 } = body || {};

    if (!studentId || !skillId || !gradeId) {
      return NextResponse.json({ ok: false, version: VERSION, error: "studentId, skillId, and gradeId are required" }, { status: 400 });
    }

    // ✅ BLOCK duplicate grade usage BEFORE writing anything
    const existing = await prisma.masteryEvidence.findFirst({
      where: { gradeId },
      select: { id: true, snapshotId: true, recordedAt: true },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, version: VERSION, error: "gradeId already used as evidence", existing },
        { status: 409 }
      );
    }

    const prevSnapshot = await prisma.objectiveMasterySnapshot.findFirst({
      where: { studentId, skillId },
      orderBy: { measuredAt: "desc" },
      select: { masteryLevel: true },
    });

    const previousMastery = prevSnapshot?.masteryLevel ?? 0;

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { id: true, percent: true, studentId: true, classId: true, computedAt: true, letter: true },
    });

    if (!grade) {
      return NextResponse.json({ ok: false, version: VERSION, error: "gradeId not found" }, { status: 404 });
    }

    const gradePercent = Number(grade.percent ?? 0);

    const a = Number(alpha ?? 0.35);
    const gradeMastery = Math.max(0, Math.min(1, gradePercent / 100));
    const nextMastery = (1 - a) * previousMastery + a * gradeMastery;
    const nextLevel = Math.round(nextMastery * 100);

    const snapshot = await prisma.objectiveMasterySnapshot.create({
      data: { studentId, skillId, masteryLevel: nextMastery, measuredAt: new Date() },
      select: { id: true, measuredAt: true, masteryLevel: true },
    });

    const evidence = await prisma.masteryEvidence.create({
      data: {
        snapshotId: snapshot.id,
        gradeId,
        sourceType: "ASSESSMENT",
        weight: 1,
        note: `Auto snapshot from Grade ${gradeId}`,
      },
      select: { id: true, snapshotId: true, gradeId: true, sourceType: true, weight: true },
    });

    const masteryRecord = await prisma.masteryRecord.upsert({
      where: { studentId_skillId: { studentId, skillId } },
      create: { studentId, skillId, level: nextLevel, lastAssessedAt: new Date() },
      update: { level: nextLevel, lastAssessedAt: new Date() },
      select: { level: true, lastAssessedAt: true },
    });

    return NextResponse.json({
      ok: true,
      version: VERSION,
      calc: { previousMastery, gradePercent, nextMastery, nextLevel, alpha: a },
      snapshot,
      evidence,
      masteryRecord,
      measurementType,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Unique constraint failed") || msg.includes("P2002")) {
      return NextResponse.json({ ok: false, version: VERSION, error: "gradeId already used (unique constraint)" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, version: VERSION, error: msg }, { status: 500 });
  }
}
