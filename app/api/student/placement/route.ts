// app/api/student/placement/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    name?: string | null;
    email?: string | null;
  };
};

export async function POST(req: Request) {
  try {
    const rawSession = await getServerSession(authOptions);
    const session = rawSession as AppSession | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can take placement tests" }, { status: 403 });
    }

    const userId = session.user.id as string;

    const student = await prisma.student.findFirst({
      where: { userId },
    });

    if (!student) {
      return NextResponse.json({ error: "Student record not found" }, { status: 404 });
    }

    const body = await req.json();

    // Expecting from frontend:
    // {
    //   band: "G1_3" | "G4_6" | "G7_9" | "G10_12",
    //   levelLabel: "Elementary" | "Middle" | "High",
    //   estimatedGrade: number,      // 1–12
    //   rawScore: number,            // correct answers or scaled
    //   totalQuestions: number,
    //   details?: any,
    //   questions?: any,
    //   answers?: any
    // }

    const {
      band,
      levelLabel,
      estimatedGrade,
      rawScore,
      totalQuestions,
      details,
      questions,
      answers,
    } = body ?? {};

    if (
      !band ||
      typeof levelLabel !== "string" ||
      typeof estimatedGrade !== "number" ||
      typeof rawScore !== "number" ||
      typeof totalQuestions !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid placement payload" },
        { status: 400 }
      );
    }

    // ---- IMPORTANT PART: use `any` so TS stops complaining about `band` ----
    const placementData: any = {
      studentId: student.id,
      band,                  // GradeBand enum in schema
      levelLabel,
      estimatedGrade,
      rawScore,
      totalQuestions,
      details: details ?? null,
      questions: questions ?? null,
      answers: answers ?? null,
    };

    const placement = await prisma.placementTest.create({
      data: placementData,
    });

    // Update student's currentGrade with the recommended level
    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        currentGrade: estimatedGrade,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        placement,
        currentGrade: updatedStudent.currentGrade,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Placement API error:", err);
    return NextResponse.json(
      { error: "Failed to record placement test" },
      { status: 500 }
    );
  }
}
