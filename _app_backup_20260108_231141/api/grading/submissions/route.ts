import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = ["gradableItemId", "studentId", "submissionType", "payload"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return NextResponse.json({ error: `Missing required field: ${k}` }, { status: 400 });
      }
    }

    if (!(prisma as any).gradableSubmission) {
      return NextResponse.json(
        {
          error: "GradableSubmission model not found in Prisma client yet.",
          fix: "Add GradableSubmission to schema.prisma, run: npx prisma generate"
        },
        { status: 501 }
      );
    }

    const sub = await (prisma as any).gradableSubmission.create({
      data: {
        gradableItemId: body.gradableItemId,
        studentId: body.studentId,
        attemptNumber: Number(body.attemptNumber ?? 1),
        submissionType: body.submissionType,
        payload: body.payload,
        recordedOffline: Boolean(body.recordedOffline ?? false),
        timeSpentMinutes: body.timeSpentMinutes ?? null,
        status: "SUBMITTED",
        turnedInAt: new Date()
      }
    });

    return NextResponse.json({ ok: true, submission: sub }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to submit work", details: String(e?.message ?? e) }, { status: 500 });
  }
}
