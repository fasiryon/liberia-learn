import type { AlignmentMode } from "@/lib/teaching/alignment";
import type { LessonDirectorAction } from "@/lib/teaching/lessonDirector";

export interface TurnInput {
  role: "facilitator" | "student";
  text: string;
  correct?: boolean | null;
}

export interface TurnResult {
  turnIndex: number;
  responseText: string;
  guardrailMode: AlignmentMode;
  deferred: boolean;
  lessonDirectorAction: LessonDirectorAction;
  whisperSent: boolean;
  llmCostUSD: number;
}
