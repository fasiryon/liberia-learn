import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

const TEMPLATES: Record<string, { filename: string; content: string }> = {
  students: {
    filename: "student-import-template.csv",
    content: [
      "firstName,lastName,grade,dateOfBirth,guardianPhone",
      "Fatu,Kollie,7,2012-03-15,+231770123456",
      "Emmanuel,Pewu,9,2010-07-22,+231880234567",
      "Mary,Gongloe,5,2014-11-08,+231550345678",
      "Boima,Nimely,1,2019-06-12,+231770456789",
      "Musu,Varney,12,2007-03-30,+231880567890",
    ].join("\n"),
  },
  teachers: {
    filename: "teacher-import-template.csv",
    content: [
      "firstName,lastName,email,subject,classGrade,section",
      "Mulbah,Sirleaf,mulbah.sirleaf@school.edu.lr,MATH,7,A",
      "Mary,Pewee,mary.pewee@school.edu.lr,LITERACY,8,B",
      "Emmanuel,Kollie,e.kollie@school.edu.lr,SCIENCE,9,A",
    ].join("\n"),
  },
  guardians: {
    filename: "guardian-import-template.csv",
    content: [
      "firstName,lastName,email,phone,studentFirstName,studentLastName,relationship",
      "Joy,Gongloe,joy.gongloe@email.com,+231770123456,Mary,Gongloe,Mother",
      "Isaac,Pewu,isaac.pewu@email.com,+231880234567,Emmanuel,Pewu,Father",
    ].join("\n"),
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { importType: string } }
) {
  try {
    await requireRole("ADMIN");
    const template = TEMPLATES[params.importType];
    if (!template) {
      return NextResponse.json({ error: "Unknown import type" }, { status: 400 });
    }

    return new NextResponse(template.content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${template.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: any) {
    return handleApiError(err, {
      requestId: "",
      route: `/api/admin/import/template/${params.importType}`,
      method: "GET",
    });
  }
}
