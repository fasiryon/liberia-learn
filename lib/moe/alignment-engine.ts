// lib/moe/alignment-engine.ts
import { prisma } from "@/lib/db";
import { updateCurriculumContent } from "@/lib/curriculum/mutations/repository";
import { getPrompt } from "@/lib/ai/promptRegistry";
import type { $Enums } from "@prisma/client";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { buildPrompt } from "@/lib/ai/promptRegistry";
import { logger } from "@/lib/logger";
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
  social_studies: "CIVICS",
  "computer science": "COMPUTER_SCIENCE",
  computer_science: "COMPUTER_SCIENCE",
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
    await updateCurriculumContent(
      { id: contentId },
      { moeAlignments: result as any },
      {
        revisionKind: "ALIGNMENT_CHANGE",
        originKind: "DETERMINISTIC_GENERATED",
        generatorName: "moeAlignmentEngine",
        generatorVersion: "1.0.0",
        requestedCompleteness: "VERIFIED",
        auditAction: "curriculum.revision.alignment_empty",
        idempotencyKey: `alignment:${contentId}:${result.alignedAt}`,
      },
    );
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
  let aiLineage: { model: string; generationCorrelationId?: string } | null = null;

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
    const candidateList = candidates
      .map((c) => `${c.code}: ${c.description}`)
      .join("\n");

    const completion = await routedCompletion({
      messages: [
        {
          role: "system",
          content: buildPrompt("moe.alignment.system"),
        },
        {
          role: "user",
          content: buildPrompt("moe.alignment.user", {
            lessonText: lessonText.slice(0, 1500),
            candidateList,
          }),
        },
      ],
      maxTokens: 300,
      aiUsage: {
        route: "moe.alignment",
        feature: "curriculum",
        requestType: "curriculum_alignment",
        promptKey: "moe.alignment.system",
      },
    });
    aiLineage = {
      model: completion.model,
      generationCorrelationId: completion.generationCorrelationId,
    };

    const raw = completion.content ?? "[]";
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
  const prompt = aiLineage ? getPrompt("moe.alignment.system") : null;
  await updateCurriculumContent(
    { id: contentId },
    { moeAlignments: result as any },
    {
      revisionKind: "ALIGNMENT_CHANGE",
      originKind: aiLineage ? "AI_GENERATED" : "DETERMINISTIC_GENERATED",
      generatorName: "moeAlignmentEngine",
      generatorVersion: "1.0.0",
      ...(aiLineage && prompt
        ? {
            aiProvider: aiLineage.model.startsWith("llama") ? "groq" : "openai",
            aiModel: aiLineage.model,
            generatedAt: new Date(result.alignedAt),
            generationCorrelationId: aiLineage.generationCorrelationId,
            primaryPromptKey: prompt.key,
            primaryPromptVersion: prompt.version,
            primaryPromptHash: prompt.hash,
          }
        : {}),
      requestedCompleteness: "VERIFIED",
      auditAction: "curriculum.revision.alignment_changed",
      idempotencyKey: `alignment:${contentId}:${result.alignedAt}`,
    },
  );

  return result;
}

export async function alignAllContent(
  opts: { force?: boolean } = {}
): Promise<{ success: number; failed: number }> {
  // Real production status values only: "accepted" matches zero rows in prod
  const where: any = { status: { in: ["APPROVED", "published", "approved"] } };
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
      logger.info("[MOE-Align] content aligned", {
        index: i + 1,
        total: contents.length,
        contentId: contents[i].id,
      });
    } catch (err: any) {
      failed++;
      logger.error("[MOE-Align] content alignment failed", {
        index: i + 1,
        total: contents.length,
        contentId: contents[i].id,
        errorMessage: err?.message,
      });
    }

    // Rate limit: 200ms between calls
    if (i < contents.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { success, failed };
}
