import type { SessionUser } from "@/lib/auth";
import type { RetrievalMode } from "@/lib/ai/rag/retrievalService";

export type AssistantRole = "TEACHER" | "ADMIN" | "STUDENT" | "GUARDIAN";

export type AssistantRoleConfig = {
  role: AssistantRole;
  label: string;
  allowedModes: RetrievalMode[];
  defaultMode: RetrievalMode;
  placeholder: string;
  emptyStateTitle: string;
  emptyStateBody: string;
};

const ROLE_CONFIG: Record<AssistantRole, AssistantRoleConfig> = {
  TEACHER: {
    role: "TEACHER",
    label: "Teacher Assistant",
    allowedModes: ["classroom", "policy", "mixed"],
    defaultMode: "classroom",
    placeholder: "Ask about lessons, standards, policy, or planning",
    emptyStateTitle: "Ask a grounded teaching question",
    emptyStateBody: "Use classroom mode for lesson help, policy mode for governance questions, or mixed mode when both matter.",
  },
  ADMIN: {
    role: "ADMIN",
    label: "Admin Assistant",
    allowedModes: ["classroom", "policy", "mixed"],
    defaultMode: "mixed",
    placeholder: "Ask about curriculum, school policy, or compliance guidance",
    emptyStateTitle: "Ask a grounded school question",
    emptyStateBody: "Use policy mode for governance questions and classroom mode for curriculum support.",
  },
  STUDENT: {
    role: "STUDENT",
    label: "Learning Assistant",
    allowedModes: ["classroom"],
    defaultMode: "classroom",
    placeholder: "Ask for help understanding a lesson or concept",
    emptyStateTitle: "Ask for help with your learning",
    emptyStateBody: "This assistant is grounded in approved lesson content and will keep answers focused on classroom help.",
  },
  GUARDIAN: {
    role: "GUARDIAN",
    label: "Family Assistant",
    allowedModes: ["classroom"],
    defaultMode: "classroom",
    placeholder: "Ask how to support learning at home",
    emptyStateTitle: "Ask how to support classroom learning",
    emptyStateBody: "This assistant stays focused on safe classroom-help questions and does not expose internal school or policy content.",
  },
};

export function getAssistantRoleConfig(
  role: SessionUser["role"]
): AssistantRoleConfig | null {
  if (role === "TEACHER" || role === "ADMIN" || role === "STUDENT" || role === "GUARDIAN") {
    return ROLE_CONFIG[role];
  }

  return null;
}

export function resolveAllowedMode(
  role: SessionUser["role"],
  requestedMode?: RetrievalMode | null
): RetrievalMode | null {
  const config = getAssistantRoleConfig(role);
  if (!config) {
    return null;
  }

  if (requestedMode && config.allowedModes.includes(requestedMode)) {
    return requestedMode;
  }

  return config.defaultMode;
}
