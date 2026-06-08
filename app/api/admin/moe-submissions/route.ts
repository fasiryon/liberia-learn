import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = [
  "ENROLLMENT_REPORT",
  "TERM_SUMMARY",
  "ATTENDANCE_REPORT",
  "FINANCIAL_REPORT",
  "INCIDENT_REPORT",
  "OTHER",
];

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const submissions = await prisma.moeSubmission.findMany({
      where: { schoolId },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });

    return NextResponse.json(submissions);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const formData = await req.formData();
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || undefined;
    const file = formData.get("file") as File | null;

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });

    const blobPath = `moe-submissions/${schoolId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
    const blob = await put(blobPath, file, { access: "private" });

    const submission = await prisma.moeSubmission.create({
      data: {
        schoolId,
        schoolName: school?.name ?? "Unknown School",
        submittedBy: user.name ?? user.email ?? user.id,
        type,
        title: title.trim(),
        description: description?.trim() || null,
        fileUrl: blob.url,
        fileName: file.name,
        fileSizeBytes: file.size,
        status: "SUBMITTED",
      },
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
