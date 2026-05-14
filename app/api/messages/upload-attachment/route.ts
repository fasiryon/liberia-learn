import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!["STUDENT", "TEACHER", "GUARDIAN"].includes(user.role as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file field is required" }, { status: 400 });
    }

    const blob = file as File;

    if (blob.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(blob.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Vercel Blob — lazy import so build doesn't fail when BLOB_READ_WRITE_TOKEN is absent
    let url: string;
    try {
      const { put } = await import("@vercel/blob");
      const safeName = blob.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blobResult = await put(`message-attachments/${user.id}/${Date.now()}_${safeName}`, blob, {
        access: "public",
      });
      url = blobResult.url;
    } catch (err: any) {
      return NextResponse.json(
        { error: "Attachment storage unavailable: " + (err?.message ?? "unknown") },
        { status: 503 }
      );
    }

    return NextResponse.json({ url, name: blob.name, type: blob.type }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
