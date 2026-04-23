import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  extractCurriculumImportText,
  normalizeImportedCurriculum,
  persistImportedCurriculum,
} from "@/lib/curriculum/importer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN", "TEACHER");
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Curriculum file is required." }, { status: 400 });
    }

    const subject = String(formData.get("subject") ?? "").trim() || undefined;
    const gradeValue = Number(formData.get("grade") ?? 0);
    const grade =
      Number.isInteger(gradeValue) && gradeValue >= 1 && gradeValue <= 12
        ? gradeValue
        : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = extractCurriculumImportText({
      fileName: file.name,
      mimeType: file.type,
      buffer,
      subject,
      grade,
    });

    const imported = normalizeImportedCurriculum({
      text: extracted.text,
      format: extracted.format,
      fileName: file.name,
      subject,
      grade,
    });
    const result = await persistImportedCurriculum({ imported, user });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "curriculum.import.created",
      resourceType: "curriculum_import",
      resourceId: result.version.id,
      details: {
        fileName: file.name,
        sourceFormat: imported.sourceFormat,
        subject: imported.subject,
        grade: imported.grade,
        unitCount: result.unitCount,
        lessonCount: result.lessonCount,
      },
    });

    return NextResponse.json({
      ok: true,
      sourceFormat: imported.sourceFormat,
      versionName: result.version.versionName,
      unitCount: result.unitCount,
      lessonCount: result.lessonCount,
      importedLessons: result.importedLessons,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Curriculum import failed." },
      { status: error?.status ?? 500 }
    );
  }
}
