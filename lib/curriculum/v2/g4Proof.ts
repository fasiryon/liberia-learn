/**
 * Grade 4 Math Curriculum V2 vertical proof: a small, deliberately diverse sample (place value,
 * fractions, measurement, solid figures with a lab candidate, data/graphs). The candidates are
 * AUTHORED_FIXTURE files in the generator's output format (no live model call); each runs through
 * the same strict parser, pinned authoring context, validator, assembler and review package as a
 * generated lesson. Every result is a DRAFT that requires exact-revision human review.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { assembleCurriculumLessonV2, type AssemblyOutcome } from "./assemble";
import { buildAuthoringContext, loadStructuredSource } from "./authoringContext";
import { parseCandidateLessonV2 } from "./parse";

export const G4_PROOF_SAMPLE = Object.freeze([
  { file: "place-value.json", strand: "Number / place value", objectiveId: "moe-math-g4-s1-p1-numeration-addition-and-subtraction-obj1" },
  { file: "equivalent-fractions.json", strand: "Fractions", objectiveId: "moe-math-g4-s1-p3-number-theory-and-fraction-obj5" },
  { file: "area-perimeter.json", strand: "Measurement", objectiveId: "moe-math-g4-s2-p5-measurement-obj9" },
  { file: "solid-figures.json", strand: "Geometry / physical solids", objectiveId: "moe-math-g4-s2-p6-geometry-and-statistics-obj5" },
  { file: "bar-graphs.json", strand: "Data / graph interpretation", objectiveId: "moe-math-g4-s2-p6-geometry-and-statistics-obj6" },
] as const);

export const G4_PROOF_CANDIDATE_DIR = "curriculum/v2/g4-math/candidates";
/** Fixed so the committed review package is reproducible. */
export const G4_PROOF_GENERATED_AT = "2026-10-08T00:00:00.000Z";

export function g4ProofContext(objectiveId: string) {
  return buildAuthoringContext({ objectiveIds: [objectiveId], grade: 4, subject: "MATH", source: loadStructuredSource(), cell: GRADE4_MATH_TEMPLATE_CELL, release: GRADE4_MATH_ONTOLOGY_RELEASE });
}

export function runG4Proof(file: string, objectiveId: string): AssemblyOutcome {
  const raw = readFileSync(path.join(process.cwd(), G4_PROOF_CANDIDATE_DIR, file), "utf8");
  return assembleCurriculumLessonV2({
    candidate: parseCandidateLessonV2(raw),
    context: g4ProofContext(objectiveId),
    generation: { origin: "AUTHORED_FIXTURE", promptKey: null, promptVersion: null, promptHash: null, model: null, generatedAt: G4_PROOF_GENERATED_AT },
  });
}

export function artifactHash(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}
