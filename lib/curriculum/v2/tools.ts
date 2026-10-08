/**
 * Curriculum V2 tool permissions over the canonical toolkit registry (Codex P2-8, P2-9).
 *
 * Curriculum declares requested and prohibited tools by registry id. Whether a learner can
 * actually use one is decided at runtime by intersecting: the registry entry, the learner's
 * grade/subject context, server feature flags, the scene's assessment policy and any granted
 * accommodation. No tool is built or duplicated here.
 */
import { getToolsForContext, TOOL_REGISTRY_DEFINITIONS, type GradeBand, type LessonType, type Subject, type ToolContext } from "@/lib/toolkit/toolRegistry";

export function canonicalToolIds(): string[] {
  return TOOL_REGISTRY_DEFINITIONS.map((tool) => tool.id);
}

export function isCanonicalToolId(id: string): boolean {
  return TOOL_REGISTRY_DEFINITIONS.some((tool) => tool.id === id);
}

export function toolGradeBand(grade: number): GradeBand {
  if (grade <= 3) return "1-3";
  if (grade <= 6) return "4-6";
  if (grade <= 9) return "7-9";
  return "10-12";
}

export function toolSubject(subject: string): Subject | null {
  const value = subject.toLowerCase();
  if (value === "math" || value === "mathematics") return "math";
  if (value === "science") return "science";
  if (value === "english" || value === "literacy" || value === "language_arts") return "english";
  if (value === "engineering") return "engineering";
  if (value === "computer_science" || value === "cs") return "cs";
  return null;
}

/** Whether the registry offers this tool for the grade/subject/lesson type at all (flags aside). */
export function toolFitsContext(toolId: string, input: { grade: number; subject: string; lessonType: LessonType }): boolean {
  const tool = TOOL_REGISTRY_DEFINITIONS.find((candidate) => candidate.id === toolId);
  const subject = toolSubject(input.subject);
  if (!tool || !subject) return false;
  const gradeBand = toolGradeBand(input.grade);
  return tool.contexts.some((context) => (!context.gradeBand || context.gradeBand === gradeBand) && (!context.subject || context.subject === subject) && (!context.lessonType || context.lessonType === input.lessonType));
}

export type ToolAvailability = Readonly<{ toolId: string; available: boolean; reasons: readonly string[] }>;

/**
 * Runtime availability for one learner and scene. An accommodation can add a tool the grade
 * context does not offer, but never overrides a tool prohibited by an assessment policy.
 */
export function resolveToolAvailability(input: {
  toolId: string;
  grade: number;
  subject: string;
  lessonType: LessonType;
  enabledCategories: readonly string[];
  prohibited: readonly string[];
  accommodations?: readonly string[];
}): ToolAvailability {
  const reasons: string[] = [];
  if (!isCanonicalToolId(input.toolId)) return { toolId: input.toolId, available: false, reasons: ["TOOL_UNKNOWN"] };
  if (input.prohibited.includes(input.toolId)) reasons.push("PROHIBITED_BY_POLICY");
  const subject = toolSubject(input.subject);
  const context: ToolContext | null = subject ? { subject, gradeBand: toolGradeBand(input.grade), lessonType: input.lessonType } : null;
  const flagged = context ? getToolsForContext(context, [...input.enabledCategories]).some((tool) => tool.id === input.toolId) : false;
  const fits = toolFitsContext(input.toolId, input);
  const accommodated = (input.accommodations ?? []).includes(input.toolId);
  if (!fits && !accommodated) reasons.push("NOT_OFFERED_FOR_GRADE_OR_SUBJECT");
  if (fits && !flagged) reasons.push("SWITCHED_OFF_BY_SERVER_FLAGS");
  return { toolId: input.toolId, available: reasons.length === 0, reasons };
}
