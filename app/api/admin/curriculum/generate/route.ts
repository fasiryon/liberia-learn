// app/api/admin/curriculum/generate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { createHash } from "crypto";

// Rate limit: 10 requests per 5 minutes per userId
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 5 * 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const RequestSchema = z.object({
  grade: z.number().int().min(1).max(12),
  subject: z.string().min(1),
  topic: z.string().min(1).max(200),
  moeAlignmentCodes: z.array(z.string()).optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { grade, subject, topic, moeAlignmentCodes } = parsed.data;

    // Generate the lesson via AI
    const payload = await generateCurriculumPayload({
      grade,
      subject,
      topic,
      moeAlignmentCodes,
      liberiaContext: true,
    });

    // Derive contentId and hash
    const contentId = `${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;
    const payloadStr = JSON.stringify(payload);
    const hash = createHash("sha256").update(payloadStr).digest("hex").slice(0, 40);

    // Upsert into CurriculumContent
    const record = await prisma.curriculumContent.upsert({
      where: { contentId },
      update: {
        grade,
        subject,
        payload,
        moeAlignments: payload.moeAlignments ?? [],
        hash,
        version: new Date().toISOString().slice(0, 10),
        status: "published",
      },
      create: {
        contentId,
        grade,
        subject,
        contentType: "lesson",
        status: "published",
        version: new Date().toISOString().slice(0, 10),
        payload,
        moeAlignments: payload.moeAlignments ?? [],
        hash,
      },
    });

    return NextResponse.json({
      ok: true,
      contentId: record.contentId,
      recordId: record.id,
      payloadPreview: {
        title: payload.title,
        objectivesCount: payload.objectives.length,
      },
    });
  } catch (err: any) {
    console.error("Curriculum generate error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate curriculum" },
      { status: err?.status ?? 500 }
    );
  }
}
