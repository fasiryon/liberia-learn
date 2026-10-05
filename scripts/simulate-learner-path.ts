/**
 * Deterministic learner-path simulator (SYNTHETIC DATA ONLY).
 *
 *   npx tsx scripts/simulate-learner-path.ts            # all scenarios
 *   npx tsx scripts/simulate-learner-path.ts prior-history
 *
 * Pure and offline: no database, no network, no writes. Prints each stage of
 * SLM -> confidence -> mastery/retention/misconception -> DecisionModel ->
 * Learning Orchestrator -> next action -> intervention signals.
 */
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import {
  formatSimulationTrace, simulateLearnerPath, SYNTHETIC_LABEL, type SimulatedStep, type SimulationScenario,
} from "@/lib/learning-calibration/learnerPathSimulator";

const [A, B, C] = GRADE4_MATH_ONTOLOGY_RELEASE.concepts.map((concept) => concept.id);
const START = "2026-09-01T08:00:00.000Z";

const make = (name: string, steps: readonly SimulatedStep[], extra: Partial<SimulationScenario> = {}): SimulationScenario =>
  ({ name, label: SYNTHETIC_LABEL, enrollmentGrade: 4, startAt: START, steps, ...extra });

const scenarios: readonly SimulationScenario[] = [
  make("brand-new", [
    { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "d0" },
    { day: 2, kind: "HOMEWORK", conceptId: A, correct: true },
    { day: 3, kind: "TUTOR_PRACTICE", conceptId: B, correct: true },
    { day: 5, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "d5" },
    { day: 6, kind: "TEACHER_EVIDENCE", conceptId: A, correct: true },
    { day: 8, kind: "RELEASED_ITEM", conceptId: B, correct: true, occasion: "d8" },
    { day: 10, kind: "QUIZ", conceptId: B, correct: true },
    { day: 12, kind: "LAB", conceptId: C, correct: true },
  ], { checkpoints: [0, 5, 8, 12] }),
  make("prior-history", [A, B, C].flatMap((conceptId): SimulatedStep[] => [
    { day: -40, kind: "PRIOR_HISTORY", conceptId, correct: true, occasion: `prior-1-${conceptId}` },
    { day: -20, kind: "PRIOR_HISTORY", conceptId, correct: true, occasion: `prior-2-${conceptId}` },
    { day: 1, kind: "RELEASED_ITEM", conceptId, correct: true },
  ]), { checkpoints: [1] }),
  make("prerequisite-gap-and-misconception", [
    { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: false, selectedAnswerIndex: 3, occasion: "o1" },
    { day: 1, kind: "RELEASED_ITEM", conceptId: A, correct: false, selectedAnswerIndex: 3, occasion: "o2" },
    { day: 2, kind: "MISCONCEPTION_REVIEW", conceptId: A, signalId: "g4-fractions-numerator-denominator-reversal", decision: "CONFIRMED" },
  ], { checkpoints: [1, 2] }),
  make("retention-decline", [
    { day: 0, kind: "RELEASED_ITEM", conceptId: A, correct: true, occasion: "o1" },
    { day: 40, kind: "RELEASED_ITEM", conceptId: A, correct: false, occasion: "probe", retentionProbe: true },
  ], { checkpoints: [30, 40] }),
];

async function main() {
  const filter = process.argv[2];
  const selected = filter ? scenarios.filter((scenario) => scenario.name === filter) : scenarios;
  if (!selected.length) throw new Error(`Unknown scenario "${filter}". Known: ${scenarios.map((s) => s.name).join(", ")}`);
  for (const scenario of selected) {
    console.log(formatSimulationTrace(await simulateLearnerPath(scenario)));
    console.log("");
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
