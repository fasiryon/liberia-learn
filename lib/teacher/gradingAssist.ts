import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { routedCompletion } from "@/lib/ai/routedCompletion";

export type GradingAssistance = {
  suggestedScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  confidence: "high" | "medium" | "low";
  warning?: string;
};

export async function getGradingAssistance(input: {
  teacherId: string;
  submissionId: string;
  studentAnswer: string;
  lessonObjectives: string[];
  rubric?: string;
}): Promise<GradingAssistance> {
  const promptMeta = getPromptMetadata("teacher.gradingAssist.v1");
  const system = buildPrompt("teacher.gradingAssist.v1");
  const user = [
    `Submission ID: ${input.submissionId}`,
    `Lesson objectives: ${input.lessonObjectives.join("; ") || "No objectives provided."}`,
    `Rubric: ${input.rubric?.trim() || "Use a fair 0-100 classroom grading scale."}`,
    "Student answer:",
    input.studentAnswer.slice(0, 3000),
    "",
    "Return only valid JSON with suggestedScore, feedback, strengths, improvements, confidence, and optional warning.",
  ].join("\n");

  try {
    const result = await routedCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 700,
      forceSmartTier: true,
      aiUsage: {
        route: "/api/teacher/grading-assist",
        feature: "grading",
        userId: input.teacherId,
        requestType: "teacher_grading_assist",
        promptKey: promptMeta.key,
        promptVersion: promptMeta.version,
        promptHash: promptMeta.hash,
      },
    });
    return parseResult(result.content) ?? fallback("AI returned an incomplete suggestion.");
  } catch {
    return fallback("AI grading assistance is unavailable. Review the answer manually.");
  }
}

function parseResult(raw: string): GradingAssistance | null {
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    if (!parsed || typeof parsed !== "object") return null;
    const score = typeof parsed.suggestedScore === "number" ? parsed.suggestedScore : NaN;
    const feedback = typeof parsed.feedback === "string" ? parsed.feedback.trim() : "";
    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium";
    if (!Number.isFinite(score) || !feedback) return null;
    return {
      suggestedScore: Math.max(0, Math.min(100, Math.round(score))),
      feedback,
      strengths: toStringArray(parsed.strengths),
      improvements: toStringArray(parsed.improvements),
      confidence,
      warning: typeof parsed.warning === "string" ? parsed.warning.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function fallback(warning: string): GradingAssistance {
  return {
    suggestedScore: 0,
    feedback: "Review the response against the lesson objectives, note evidence of understanding, and give one clear next step.",
    strengths: [],
    improvements: ["Use the lesson objectives to identify the most important correction."],
    confidence: "low",
    warning,
  };
}
