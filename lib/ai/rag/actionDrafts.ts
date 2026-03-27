import { z } from "zod";
import type { SessionUser } from "@/lib/auth";

export const AssistantActionRequestSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  subject: z.string().trim().min(1).max(100).nullable().optional(),
  gradeLevel: z.string().trim().min(1).max(32).nullable().optional(),
  contextMode: z
    .enum(["governance", "lesson", "homework", "learning", "support", "mixed"])
    .optional(),
});

type AssistantActionRequest = z.infer<typeof AssistantActionRequestSchema>;

function describeScope(input: AssistantActionRequest): string {
  const scope: string[] = [];
  if (input.subject) {
    scope.push(input.subject);
  }
  if (input.gradeLevel) {
    scope.push(`Grade ${input.gradeLevel}`);
  }
  return scope.length > 0 ? ` for ${scope.join(" | ")}` : "";
}

export function buildAssignmentDraft(input: AssistantActionRequest) {
  return {
    summary: `Draft assignment${describeScope(input)} based on the grounded question.`,
    title: `Assignment follow-up${input.subject ? `: ${input.subject}` : ""}`,
    draftText: `Objective: Reinforce ${input.question.toLowerCase()}.\nTask: Ask students to apply the concept in one short written response and one worked example.\nCheck for understanding: Require one self-explanation sentence before submission.`,
  };
}

export function buildLessonFixDraft(input: AssistantActionRequest) {
  return {
    summary: `Lesson improvement draft${describeScope(input)}.`,
    draftText: `Focus area: ${input.question}\nRevision 1: Clarify the learning objective in student-friendly language.\nRevision 2: Add one worked example before independent practice.\nRevision 3: End with a quick check for understanding.`,
  };
}

export function buildInterventionDraft(input: AssistantActionRequest) {
  return {
    summary: `Intervention suggestion draft${describeScope(input)}.`,
    draftText: `Concern: ${input.question}\nSuggested action: Review recent lesson completion, identify one targeted support gap, and assign a short monitored intervention cycle with a follow-up checkpoint next week.`,
  };
}

export function buildPracticeDraft(input: AssistantActionRequest) {
  return {
    summary: `Practice draft${describeScope(input)}.`,
    draftText: `Practice goal: Strengthen understanding of ${input.question.toLowerCase()}.\n1. Complete one recall question.\n2. Solve one guided example.\n3. Solve one independent question.\n4. Write one sentence explaining the answer.`,
  };
}

export function buildStudyPlanDraft(input: AssistantActionRequest) {
  return {
    headline: `Home study plan${describeScope(input)}`,
    draftText: `Topic: ${input.question}\nDay 1: Review the key idea together for 10 minutes.\nDay 2: Ask the learner to explain one example aloud.\nDay 3: Complete one short practice task and review mistakes calmly.\nDay 4: Revisit the hardest part and celebrate progress.`,
  };
}

export function assertRole(
  user: Pick<SessionUser, "role">,
  allowedRoles: SessionUser["role"][]
) {
  if (!allowedRoles.includes(user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
