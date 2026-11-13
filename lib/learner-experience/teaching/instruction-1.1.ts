/**
 * Interactive Learning V4: instructional phases, version `liberialearn-v4-instruction/1.1.0` (additive).
 *
 * Extends the frozen 1.0.0 standard (./instruction.ts, which stays byte-identical for historical packages) with the
 * COMPUTING and ENGINEERING families from the CoS Computing & Engineering standard
 * (docs/program/COMPUTING_ENGINEERING_STANDARD_V1.md; curriculum/program/stem-v1/source/standards.cjs PATTERNS).
 * Packages declare which standard they were generated under; nothing here re-labels a 1.0.0 package.
 */
import { INDEPENDENT_PHASES, INSTRUCTION_PATTERNS, PHASE_LABEL, SHARED_PHASES, V4_INSTRUCTION_STANDARD, type InstructionPhase } from "./instruction";
import { subjectFamily, type SubjectFamily } from "./registry";

export const V4_INSTRUCTION_STANDARD_1_1 = "liberialearn-v4-instruction/1.1.0" as const;
export const INSTRUCTION_STANDARDS = [V4_INSTRUCTION_STANDARD, V4_INSTRUCTION_STANDARD_1_1] as const;
export type InstructionStandard = (typeof INSTRUCTION_STANDARDS)[number];

export const SUBJECT_FAMILIES_1_1 = ["MATHEMATICS", "SCIENCE", "HUMANITIES", "LANGUAGE", "COMPUTING", "ENGINEERING"] as const;
export type SubjectFamily_1_1 = (typeof SUBJECT_FAMILIES_1_1)[number];

/** Recorded subject codes for the new families (CoS COURSE_FAMILY); every other subject maps as in 1.0.0. */
export function subjectFamily_1_1(subject: string): SubjectFamily_1_1 | null {
  const code = subject.trim().toUpperCase();
  if (code === "COMPUTER_SCIENCE" || code === "COMPUTING") return "COMPUTING";
  if (code === "ENGINEERING_FOUNDATIONS" || code === "ENGINEERING") return "ENGINEERING";
  return subjectFamily(subject) as SubjectFamily | null;
}

/** CoS PATTERNS: Computing keeps the guided/independent split; Engineering covers DEFINE-DESIGN-BUILD-TEST-IMPROVE. */
export const INSTRUCTION_PATTERNS_1_1 = Object.freeze({
  ...INSTRUCTION_PATTERNS,
  COMPUTING: ["PREDICT", "DECOMPOSE", "DEMONSTRATE", "BUILD_WITH_SUPPORT", "BUILD_INDEPENDENTLY", "TEST", "DEBUG", "APPLY"],
  ENGINEERING: ["DEFINE", "RESEARCH_CONSTRAINTS", "DESIGN", "BUILD_OR_MODEL", "TEST", "REFINE", "COMMUNICATE"],
} as const);

export type InstructionPhase_1_1 = InstructionPhase | (typeof INSTRUCTION_PATTERNS_1_1)["COMPUTING" | "ENGINEERING"][number];
export const INSTRUCTION_PHASES_1_1: readonly InstructionPhase_1_1[] = Object.freeze([...new Set([...Object.values(INSTRUCTION_PATTERNS_1_1).flat(), ...SHARED_PHASES])] as InstructionPhase_1_1[]);

export const PHASE_LABEL_1_1: Record<InstructionPhase_1_1, string> = {
  ...PHASE_LABEL,
  DECOMPOSE: "Break it down", BUILD_WITH_SUPPORT: "Build with help", BUILD_INDEPENDENTLY: "Build it alone", TEST: "Test it", DEBUG: "Find and fix the bug",
  DEFINE: "Define the problem", RESEARCH_CONSTRAINTS: "Check the limits", DESIGN: "Design", BUILD_OR_MODEL: "Build or model", REFINE: "Improve it", COMMUNICATE: "Explain your design",
};

/** 1.0.0 independent phases plus BUILD_INDEPENDENTLY, TEST and REFINE: no worked steps and no hints in them (CoS standard). */
export const INDEPENDENT_PHASES_1_1: ReadonlySet<InstructionPhase_1_1> = new Set<InstructionPhase_1_1>([...INDEPENDENT_PHASES, "BUILD_INDEPENDENTLY", "TEST", "REFINE"]);

/** Phases a package may use under a given standard. A 1.0.0 package never gains the new families. */
export function patternsFor(standard: InstructionStandard) {
  if (standard === V4_INSTRUCTION_STANDARD) return INSTRUCTION_PATTERNS;
  if (standard === V4_INSTRUCTION_STANDARD_1_1) return INSTRUCTION_PATTERNS_1_1;
  throw Error(`instruction_standard_unknown:${standard}`);
}
