import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const format = (searchParams.get("format") ?? "json").toLowerCase();

    if (!classId) return NextResponse.json({ error: "Missing classId" }, { status: 400 });

    if (!(prisma as any).gradableItem) {
      return NextResponse.json(
        { error: "GradableItem model not found yet. Add models + prisma generate." },
        { status: 501 }
      );
    }

    const items = await (prisma as any).gradableItem.findMany({
      where: { classId },
      include: {
        submissions: { include: { gradeRecord: true } }
      }
    });

    if (format === "csv") {
      const rows: string[] = [];
      rows.push("gradableItemId,title,type,studentId,attempt,scorePoints,scorePercent,gradedAt");
      for (const it of items) {
        for (const s of it.submissions ?? []) {
          const g = s.gradeRecord;
          rows.push([
            it.id,
            JSON.stringify(it.title ?? ""),
            it.type,
            s.studentId,
            s.attemptNumber ?? 1,
            g?.scorePoints ?? "",
            g?.scorePercent ?? "",
            g?.gradedAt ? new Date(g.gradedAt).toISOString() : ""
          ].join(","));
        }
      }

      return new NextResponse(rows.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8"
        }
      });
    }

    return NextResponse.json({ ok: true, classId, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Export failed", details: String(e?.message ?? e) }, { status: 500 });
  }
}
