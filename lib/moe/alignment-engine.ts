// lib/moe/alignment-engine.ts
import { prisma } from "@/lib/db";
import type { $Enums } from "@prisma/client";
import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
type GradeBand = $Enums.GradeBand;
type Subject = $Enums.Subject;


export function gradeToBand(grade: number): GradeBand {
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  if (grade <= 9) return "G7_9";
  return "G10_12";
}

const SUBJECT_MAP: Record<string, Subject> = {
  math: "MATH",
  mathematics: "MATH",
  science: "SCIENCE",
  literacy: "LITERACY",
  english: "LITERACY",
  reading: "LITERACY",
  civics: "CIVICS",
  "social studies": "CIVICS",
  "computer science": "COMPUTER_SCIENCE",
  computing: "COMPUTER_SCIENCE",
  ict: "COMPUTER_SCIENCE",
  engineering: "ENGINEERING",
  arts: "ARTS",
  pe: "PE",
  career: "CAREER",
};

export interface AlignmentResult {
  contentId: string;
  standards: Array<{
    code: string;
    description: string;
    confidence: "high" | "medium" | "low";
  }>;
  alignedAt: string;
  method: "keyword" | "ai" | "exact";
}

export async function alignContentToMOE(
  contentId: string
): Promise<AlignmentResult> {
  const content = await prisma.curriculumContent.findUnique({
    where: { id: contentId },
  });

  if (!content) throw new Error(`CurriculumContent ${contentId} not found`);

  const grade = content.grade;
  const subjectStr = content.subject.toLowerCase();
  const subject: Subject | undefined = SUBJECT_MAP[subjectStr];
  const band = gradeToBand(grade);

  const payload = content.payload as any;

  // Collect lesson text from payload fields
  const textParts: string[] = [];
  if (payload) {
    for (const key of [
      "title",
      "description",
      "objectives",
      "content",
      "summary",
      "lessonPlan",
    ]) {
      const val = payload[key];
      if (typeof val === "string") textParts.push(val);
      else if (Array.isArray(val))
        textParts.push(val.filter((v: any) => typeof v === "string").join(" "));
      else if (typeof val === "object" && val)
        textParts.push(JSON.stringify(val));
    }
  }
  const lessonText = textParts.join(" ").toLowerCase();

  // Fetch candidate standards
  const whereClause: any = { band };
  if (subject) whereClause.subject = subject;

  const candidates = await prisma.standard.findMany({
    where: whereClause,
    select: { code: true, description: true },
  });

  if (candidates.length === 0) {
    const result: AlignmentResult = {
      contentId,
      standards: [],
      alignedAt: new Date().toISOString(),
      method: "keyword",
    };
    await prisma.curriculumContent.update({
      where: { id: contentId },
      data: { moeAlignments: result as any },
    });
    return result;
  }

  // Score each candidate by keyword overlap
  const scored = candidates.map((c) => {
    const descWords = c.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    if (descWords.length === 0) return { ...c, score: 0 };
    const matched = descWords.filter((w) => lessonText.includes(w)).length;
    return { ...c, score: matched / descWords.length };
  });

  const goodMatches = scored.filter((s) => s.score >= 0.15);

  let result: AlignmentResult;

  if (goodMatches.length > 0) {
    // Keyword matching worked
    const top3 = goodMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => ({
        code: s.code,
        description: s.description,
        confidence: (s.score >= 0.4
          ? "high"
          : s.score >= 0.25
            ? "medium"
            : "low") as "high" | "medium" | "low",
      }));

    result = {
      contentId,
      standards: top3,
      alignedAt: new Date().toISOString(),
      method: "keyword",
    };
  } else {
    // Fall back to AI
    const client = getOpenAIClientOrThrow();

    const candidateList = candidates
      .map((c) => `${c.code}: ${c.description}`)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You match lesson content to curriculum standards. Return ONLY a JSON array of matching standard codes. Example: ["LR-MATH-G1_3-01","LR-MATH-G1_3-02"]',
        },
        {
          role: "user",
          content: `Lesson text:\n${lessonText.slice(0, 1500)}\n\nCandidate standards:\n${candidateList}\n\nReturn the codes that match as a JSON array.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    let matchedCodes: string[] = [];
    try {
      matchedCodes = JSON.parse(raw);
    } catch {
      matchedCodes = [];
    }

    const aiStandards = matchedCodes
      .filter((code) => candidates.some((c) => c.code === code))
      .slice(0, 3)
      .map((code) => {
        const c = candidates.find((c) => c.code === code)!;
        return { code, description: c.description, confidence: "medium" as const };
      });

    result = {
      contentId,
      standards: aiStandards,
      alignedAt: new Date().toISOString(),
      method: "ai",
    };
  }

  // Save to DB
  await prisma.curriculumContent.update({
    where: { id: contentId },
    data: { moeAlignments: result as any },
  });

  return result;
}

export async function alignAllContent(
  opts: { force?: boolean } = {}
): Promise<{ success: number; failed: number }> {
  // Include both "published" (approved content) and "accepted" (legacy status)
  const where: any = { status: { in: ["published", "accepted"] } };
  if (!opts.force) {
    where.moeAlignments = null;
  }

  const contents = await prisma.curriculumContent.findMany({
    where,
    select: { id: true },
  });

  let success = 0;
  let failed = 0;

  for (let i = 0; i < contents.length; i++) {
    try {
      await alignContentToMOE(contents[i].id);
      success++;
      console.log(
        `[MOE-Align] ${i + 1}/${contents.length} aligned: ${contents[i].id}`
      );
    } catch (err: any) {
      failed++;
      console.error(
        `[MOE-Align] ${i + 1}/${contents.length} FAILED: ${contents[i].id}`,
        err?.message
      );
    }

    // Rate limit: 200ms between calls
    if (i < contents.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { success, failed };
}
