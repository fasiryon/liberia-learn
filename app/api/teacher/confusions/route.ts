import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isConfusionDetectionEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function severityWeight(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

export async function GET(req: NextRequest) {
  try {
    if (!isConfusionDetectionEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const rows = await (prisma as any).confusionSignal.findMany({
      where: {
        schoolId: user.schoolId,
        ...(studentId ? { studentId } : {}),
      },
      take: 50,
    });

    rows.sort((a: any, b: any) => {
      const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load confusion signals" },
      { status: error?.status ?? 500 }
    );
  }
}
