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

/** Generate 1-3 lab objects for the given grade/subject/topic */
function generateLabs(grade: number, subject: string, topic: string) {
  // Deterministic labs based on subject — real AI generation can be added later
  const labs: Array<{
    id: string;
    title: string;
    objective: string;
    materials: string[];
    steps: string[];
    assessment: string;
    safetyNotes?: string;
  }> = [];

  const labId = `lab-${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;

  if (["MATH", "COMPUTER_SCIENCE", "ENGINEERING"].includes(subject)) {
    labs.push({
      id: `${labId}-1`,
      title: `Hands-On ${topic} Activity`,
      objective: `Students will demonstrate understanding of ${topic} through a practical exercise.`,
      materials: ["Paper", "Pencils", "Rulers", "Counters or bottle caps"],
      steps: [
        `Divide students into groups of 3-4.`,
        `Present the problem: apply ${topic} concepts to a real-world Liberian market scenario.`,
        `Each group works through the problem using physical counters or drawings.`,
        `Groups present their solutions to the class.`,
        `Class discusses different approaches and validates answers.`,
      ],
      assessment: "Observe group participation. Check written solutions for correct application of concepts.",
    });
  }

  if (["SCIENCE", "ENGINEERING"].includes(subject)) {
    labs.push({
      id: `${labId}-sci`,
      title: `${topic} Observation Lab`,
      objective: `Students will observe and record findings related to ${topic}.`,
      materials: ["Notebook", "Pencil", "Locally available materials", "Measuring tools if available"],
      steps: [
        `Teacher introduces the key concept of ${topic}.`,
        `Students make predictions about what they expect to observe.`,
        `Conduct the observation or simple experiment using local materials.`,
        `Record findings in their notebooks with drawings.`,
        `Compare predictions to actual results and discuss.`,
      ],
      assessment: "Review student notebooks for accurate observations and thoughtful comparisons.",
      safetyNotes: "Ensure students handle materials safely. Supervise any experiments closely.",
    });
  }

  if (["LITERACY", "CIVICS", "ARTS"].includes(subject)) {
    labs.push({
      id: `${labId}-lit`,
      title: `${topic} Discussion & Creative Activity`,
      objective: `Students will engage with ${topic} through discussion and creative expression.`,
      materials: ["Paper", "Colored pencils or crayons", "Reading materials"],
      steps: [
        `Read aloud or have students read a short passage related to ${topic}.`,
        `Facilitate a class discussion on key themes.`,
        `Students create a drawing, poem, or short essay responding to the topic.`,
        `Share and discuss student work.`,
      ],
      assessment: "Evaluate participation in discussion and quality of creative response.",
    });
  }

  // Fallback: always have at least one lab
  if (labs.length === 0) {
    labs.push({
      id: `${labId}-gen`,
      title: `Exploring ${topic}`,
      objective: `Students will explore ${topic} through guided practice.`,
      materials: ["Paper", "Pencils", "Classroom resources"],
      steps: [
        `Teacher reviews key concepts of ${topic}.`,
        `Students work in pairs on practice problems or discussion questions.`,
        `Pairs share their answers with the class.`,
        `Teacher provides feedback and clarification.`,
      ],
      assessment: "Check pair work for understanding. Ask follow-up questions to assess comprehension.",
    });
  }

  return labs;
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

    // Generate labs
    const labs = generateLabs(grade, subject, topic);

    // Determine approval status based on role
    const approvalStatus = user.role === "ADMIN" ? "APPROVED" : "PENDING_APPROVAL";

    // Enrich payload with labs, approval info, and createdByRole
    const enrichedPayload = {
      ...payload,
      labs,
      approvalStatus,
      createdByRole: user.role,
      createdByUserId: user.id,
      ...(user.role === "ADMIN"
        ? { approvedByUserId: user.id, approvedAt: new Date().toISOString() }
        : {}),
    };

    // Derive contentId and hash
    const contentId = `${subject.toLowerCase()}-g${grade}-${slugify(topic)}`;
    const payloadStr = JSON.stringify(enrichedPayload);
    const hash = createHash("sha256").update(payloadStr).digest("hex").slice(0, 40);

    // Use the DB-level status column for the approval workflow
    const dbStatus = approvalStatus === "APPROVED" ? "published" : "pending_approval";

    // Upsert into CurriculumContent
    const record = await prisma.curriculumContent.upsert({
      where: { contentId },
      update: {
        grade,
        subject,
        payload: enrichedPayload,
        moeAlignments: payload.moeAlignments ?? [],
        hash,
        version: new Date().toISOString().slice(0, 10),
        status: dbStatus,
      },
      create: {
        contentId,
        grade,
        subject,
        contentType: "lesson",
        status: dbStatus,
        version: new Date().toISOString().slice(0, 10),
        payload: enrichedPayload,
        moeAlignments: payload.moeAlignments ?? [],
        hash,
      },
    });

    return NextResponse.json({
      ok: true,
      contentId: record.contentId,
      recordId: record.id,
      approvalStatus,
      labsCount: labs.length,
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
