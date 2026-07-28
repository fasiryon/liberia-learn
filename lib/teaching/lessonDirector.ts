export type LessonDirectorAction =
  | "continue"
  | "pause"
  | "comprehension_check"
  | "revisit_prerequisite"
  | "regroup"
  | "exit_ticket";

export interface TurnSignal {
  role: "facilitator" | "student";
  correct?: boolean | null;
}

const EXIT_TICKET_TURN_THRESHOLD = 40;
const PAUSE_EVERY_N_TURNS = 10;

/**
 * New for v1: no prior turn-by-turn classroom pacing signal existed anywhere
 * in the codebase (confirmed during investigation). Modeled on
 * lib/adaptive/detectStuck.ts's threshold style (wrongAnswers: 3,
 * repeatAttempts: 3) rather than invented from scratch.
 */
export function decideNextAction(priorTurns: TurnSignal[], turnIndex: number): LessonDirectorAction {
  const recentStudentTurns = priorTurns.filter((t) => t.role === "student").slice(-3);
  const wrongCount = recentStudentTurns.filter((t) => t.correct === false).length;

  if (recentStudentTurns.length === 3 && wrongCount === 3) return "revisit_prerequisite";
  if (wrongCount >= 2) return "comprehension_check";
  if (turnIndex >= EXIT_TICKET_TURN_THRESHOLD) return "exit_ticket";
  if (turnIndex > 0 && turnIndex % PAUSE_EVERY_N_TURNS === 0) return "pause";
  return "continue";
}
