/** Compatibility adapter: lesson help and global assistant share one grounded answer stack. */
import { answerGroundedQuestion, type GroundedAnswerResult } from "@/lib/ai/rag/groundedAnswerService";
import type { TutorContextPackage } from "./tutorContext";

export type TutorRequestType = "explain" | "practice" | "step_by_step" | "reinforce" | "explain_differently";
export type GuidanceLevel = "light" | "moderate" | "intensive";
export type StudentTutorInput = { context: TutorContextPackage; studentQuestion: string; focusQuestion?: string };
export type StudentTutorResult = Omit<GroundedAnswerResult, "explanation"> & {
  explanation: string;
  practicePrompt?: string;
  guidanceLevel: GuidanceLevel;
  confidenceScore: number;
  estimatedCostUSD: number;
};
export function isValidRequestType(value: unknown): value is TutorRequestType {
  return typeof value === "string" && ["explain", "practice", "step_by_step", "reinforce", "explain_differently"].includes(value);
}
export async function getStudentTutorResponse(input: StudentTutorInput, usage?: { route: string; userId?: string | null }): Promise<StudentTutorResult> {
  const result = await answerGroundedQuestion({
    question: input.studentQuestion, focusQuestion: input.focusQuestion, schoolId: input.context.schoolId, role: "STUDENT", mode: "classroom",
    subject: input.context.subject, grade: input.context.grade, tutorContext: input.context,
    context: { role: "STUDENT", mode: "lesson", subject: input.context.subject, gradeLevel: String(input.context.grade) },
    usageContext: usage,
  });
  return { ...result, explanation: result.answer,
    ...(input.context.action === "practice" && !result.hadFallback ? { practicePrompt: result.answer } : {}),
    guidanceLevel: "light", confidenceScore: result.groundingScore, estimatedCostUSD: result.estimatedCost };
}
