import type { SessionUser } from "@/lib/auth";
import type { RetrievalContext } from "@/lib/ai/rag/retrievalService";

export type AssistantActionType =
  | "GENERATE_ASSIGNMENT"
  | "FIX_LESSON"
  | "SUGGEST_INTERVENTION"
  | "GENERATE_PRACTICE"
  | "EXPLAIN_DIFFERENTLY"
  | "BUILD_STUDY_PLAN";

export type AssistantAction = {
  type: AssistantActionType;
  label: string;
  payload: {
    question: string;
    subject?: string | null;
    gradeLevel?: string | null;
    contextMode?: RetrievalContext["mode"];
  };
  requiresConfirmation?: boolean;
};

type BuildAssistantActionsInput = {
  role: SessionUser["role"];
  question: string;
  subject?: string | null;
  gradeLevel?: string | null;
  context?: RetrievalContext;
};

function buildPayload(input: BuildAssistantActionsInput): AssistantAction["payload"] {
  return {
    question: input.question,
    subject: input.subject ?? input.context?.subject ?? null,
    gradeLevel: input.gradeLevel ?? input.context?.gradeLevel ?? null,
    contextMode: input.context?.mode,
  };
}

export function buildAssistantActions(
  input: BuildAssistantActionsInput
): AssistantAction[] {
  const payload = buildPayload(input);

  switch (input.role) {
    case "TEACHER":
      return [
        {
          type: "GENERATE_ASSIGNMENT",
          label: "Generate Assignment",
          payload,
        },
        {
          type: "FIX_LESSON",
          label: "Fix Lesson",
          payload,
        },
      ];
    case "STUDENT":
      return [
        {
          type: "GENERATE_PRACTICE",
          label: "Generate Practice",
          payload,
        },
        {
          type: "EXPLAIN_DIFFERENTLY",
          label: "Explain Differently",
          payload,
        },
      ];
    case "ADMIN":
    case "MOE_OFFICIAL":
      return [
        {
          type: "SUGGEST_INTERVENTION",
          label: "Suggest Intervention",
          payload,
          requiresConfirmation: true,
        },
      ];
    case "GUARDIAN":
      return [
        {
          type: "BUILD_STUDY_PLAN",
          label: "Build Study Plan",
          payload,
        },
      ];
    default:
      return [];
  }
}

export function getAssistantActionEndpoint(type: AssistantActionType): string | null {
  switch (type) {
    case "GENERATE_ASSIGNMENT":
      return "/api/teacher/assignment/generate";
    case "FIX_LESSON":
      return "/api/teacher/lesson/improve";
    case "SUGGEST_INTERVENTION":
      return "/api/admin/intervention/suggest";
    case "GENERATE_PRACTICE":
      return "/api/student/practice/generate";
    case "BUILD_STUDY_PLAN":
      return "/api/guardian/study-plan";
    case "EXPLAIN_DIFFERENTLY":
      return null;
  }
}
