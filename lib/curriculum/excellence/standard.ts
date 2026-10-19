/**
 * LiberiaLearn Curriculum Excellence Standard V1.
 *
 * A LiberiaLearn-owned academic standard layered on top of, never instead of, the national
 * curriculum. Three cumulative layers:
 *
 *   NATIONAL_FOUNDATION   explicit, evidenced mapping to Liberian MOE objectives and, where an
 *                         examination applies, the WAEC baseline. The floor, never the ceiling.
 *   LIBERIALEARN_MASTERY  what LiberiaLearn requires before it calls an objective mastered:
 *                         independent, reasoned, misconception-aware, retained evidence.
 *   GLOBAL_EXCELLENCE     reasoning, transfer and extension at a level comparable to strong
 *                         international frameworks, with independently comparable measurement.
 *
 * A layer is attained only when every blocking criterion of that layer and of every lower layer is
 * MET with evidence. NOT_EVALUATED never counts as MET.
 *
 * Rubric attainment is design evidence, not learning evidence. Under the Learning outcome standard
 * (docs/agents/CORE_AGENT_RULES.md) a lesson succeeds only when students independently demonstrate
 * that they learned, retained and can apply what it taught; that is measured by the pilot plan
 * (outcomeClaims.ts), never by this rubric.
 *
 * Nothing here approves, publishes, releases, scores or writes learner state.
 */
import type { RubricDimension } from "@/lib/curriculum/review/rubric";

export const CURRICULUM_EXCELLENCE_STANDARD_VERSION = "liberialearn-curriculum-excellence/1.0.0" as const;
export const CURRICULUM_EXCELLENCE_RUBRIC_VERSION = "liberialearn-curriculum-excellence-rubric/1.0.0" as const;

export const EXCELLENCE_LAYERS = ["NATIONAL_FOUNDATION", "LIBERIALEARN_MASTERY", "GLOBAL_EXCELLENCE"] as const;
export type ExcellenceLayer = (typeof EXCELLENCE_LAYERS)[number];

export const EXCELLENCE_DIMENSIONS = [
  "ALIGNMENT", "ACCURACY", "INSTRUCTIONAL_PROGRESSION", "CONCEPTUAL_MASTERY", "REASONING",
  "ASSESSMENT", "ACCESSIBILITY", "RELEVANCE", "ADVANCED_EXTENSION",
] as const;
export type ExcellenceDimension = (typeof EXCELLENCE_DIMENSIONS)[number];

export const CRITERION_RATINGS = ["MET", "PARTIALLY_MET", "NOT_MET", "NOT_APPLICABLE", "NOT_EVALUATED"] as const;
export type CriterionRating = (typeof CRITERION_RATINGS)[number];

/** Who can rate a criterion. HUMAN_REQUIRED criteria can never be rated MET by an AI reviewer. */
export type CriterionCheck = "DETERMINISTIC" | "AI_JUDGMENT_ADVISORY" | "HUMAN_REQUIRED";

export type ExcellenceCriterion = Readonly<{
  id: string;
  layer: ExcellenceLayer;
  dimension: ExcellenceDimension;
  statement: string;
  /** What must exist, at the exact revision, for the criterion to be MET. */
  evidenceRequired: string;
  check: CriterionCheck;
  blocking: boolean;
  /** The existing P2-B review dimension this refines, so ratings stay comparable with legacy review. */
  p2bDimension: RubricDimension | null;
  basis: readonly string[];
}>;

const c = (criterion: ExcellenceCriterion) => Object.freeze({ ...criterion, basis: Object.freeze([...criterion.basis]) });

export const EXCELLENCE_RUBRIC_V1: readonly ExcellenceCriterion[] = Object.freeze([
  // ── National Foundation ──────────────────────────────────────────────────
  c({ id: "NF-ALN-1", layer: "NATIONAL_FOUNDATION", dimension: "ALIGNMENT", blocking: true, check: "HUMAN_REQUIRED", p2bDimension: "standards_alignment",
    statement: "Every lesson objective is bound to a structured MOE objective, or is recorded as a named LiberiaLearn scope extension that a curriculum owner has decided.",
    evidenceRequired: "Objective → MOE objective id with source page, or an extension record with the owner's decision.", basis: ["MOE_CURRICULUM_AUTHORITY"] }),
  c({ id: "NF-ALN-2", layer: "NATIONAL_FOUNDATION", dimension: "ALIGNMENT", blocking: true, check: "AI_JUDGMENT_ADVISORY", p2bDimension: "standards_alignment",
    statement: "Where an examination applies (LJHSCE, WASSCE) the lesson is mapped to the WAEC baseline competency it prepares for, with the evidence specificity stated and no WAEC approval claimed.",
    evidenceRequired: "Baseline competency id, evidence specificity (TOPIC/SUBJECT/FRAMEWORK level), and a NOT_CLAIMED external-authority status.", basis: ["WAEC_BASELINE_FLOOR_NOT_CEILING"] }),
  c({ id: "NF-ALN-3", layer: "NATIONAL_FOUNDATION", dimension: "ALIGNMENT", blocking: true, check: "HUMAN_REQUIRED", p2bDimension: "age_appropriateness",
    statement: "Content above the MOE grade scope is labelled as extension and is never required for the grade's mastery decision.",
    evidenceRequired: "Grade-scope decision for every above-scope element.", basis: ["MOE_CURRICULUM_AUTHORITY"] }),
  c({ id: "NF-ACC-1", layer: "NATIONAL_FOUNDATION", dimension: "ACCURACY", blocking: true, check: "DETERMINISTIC", p2bDimension: "factual_correctness",
    statement: "Every keyed item has exactly one defensible correct response, verified mechanically where the domain allows.",
    evidenceRequired: "Item verification records (e.g. place-value arithmetic) or a documented reason verification is not mechanical.", basis: ["ITEM_WRITING_GUIDELINES"] }),
  c({ id: "NF-ACC-2", layer: "NATIONAL_FOUNDATION", dimension: "ACCURACY", blocking: true, check: "HUMAN_REQUIRED", p2bDimension: "factual_correctness",
    statement: "Explanations, worked examples and Liberian facts are correct, checked by an identified subject expert.",
    evidenceRequired: "Exact-revision human subject review.", basis: ["P2B_QUALIFIED_REVIEW"] }),
  c({ id: "NF-PRG-1", layer: "NATIONAL_FOUNDATION", dimension: "INSTRUCTIONAL_PROGRESSION", blocking: true, check: "DETERMINISTIC", p2bDimension: "instructional_clarity_quality",
    statement: "Every stated prerequisite is diagnosed before instruction depends on it, with a route for learners who lack it.",
    evidenceRequired: "A diagnostic task per prerequisite, each with a stated fallback route.", basis: ["TEACHING_AT_THE_RIGHT_LEVEL", "STRUCTURED_PEDAGOGY"] }),
  c({ id: "NF-ASM-1", layer: "NATIONAL_FOUNDATION", dimension: "ASSESSMENT", blocking: true, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "Every objective is assessed by at least one item or task at the end of the lesson.",
    evidenceRequired: "Objective → mastery item/task map.", basis: ["CONSTRUCTIVE_ALIGNMENT"] }),
  c({ id: "NF-ACS-1", layer: "NATIONAL_FOUNDATION", dimension: "ACCESSIBILITY", blocking: true, check: "DETERMINISTIC", p2bDimension: "accessibility",
    statement: "Every scene has a text alternative and keyboard path, and every non-renderable interaction has an objective-preserving offline fallback.",
    evidenceRequired: "Curriculum V2 accessibility and deliverability fields.", basis: ["UNIVERSAL_DESIGN_FOR_LEARNING"] }),
  c({ id: "NF-REL-1", layer: "NATIONAL_FOUNDATION", dimension: "RELEVANCE", blocking: false, check: "HUMAN_REQUIRED", p2bDimension: "localization_cultural_accuracy",
    statement: "Liberian contexts are accurate, respectful and not stereotyped; invented data is labelled as invented.",
    evidenceRequired: "Localization review.", basis: ["P2B_QUALIFIED_REVIEW"] }),

  // ── LiberiaLearn Mastery ─────────────────────────────────────────────────
  c({ id: "LM-PRG-1", layer: "LIBERIALEARN_MASTERY", dimension: "INSTRUCTIONAL_PROGRESSION", blocking: true, check: "DETERMINISTIC", p2bDimension: "instructional_clarity_quality",
    statement: "Support fades from modelled to guided to independent: every objective reaches unscaffolded (NONE) practice before mastery evidence is collected.",
    evidenceRequired: "Scene sequence with scaffold levels per objective.", basis: ["WORKED_EXAMPLE_FADING", "GRADUAL_RELEASE"] }),
  c({ id: "LM-CON-1", layer: "LIBERIALEARN_MASTERY", dimension: "CONCEPTUAL_MASTERY", blocking: true, check: "DETERMINISTIC", p2bDimension: "instructional_clarity_quality",
    statement: "Every catalogued misconception is taught against and is diagnosable in assessment through a correctly mapped distractor or response pattern.",
    evidenceRequired: "Misconception → instruction scene and → item distractor/response map, with each mapping consistent with the error it names.", basis: ["DIAGNOSTIC_DISTRACTORS"] }),
  c({ id: "LM-CON-2", layer: "LIBERIALEARN_MASTERY", dimension: "CONCEPTUAL_MASTERY", blocking: false, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "Each objective is evidenced in more than one form (e.g. recognise and produce; explain and apply).",
    evidenceRequired: "At least two evidence kinds per objective in the assessment plan.", basis: ["ADDING_IT_UP_PROFICIENCY_STRANDS"] }),
  c({ id: "LM-RSN-1", layer: "LIBERIALEARN_MASTERY", dimension: "REASONING", blocking: true, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "Where reasoning is central, the learner must produce a justification or explanation without scaffolds; selection of a correct option is not accepted as reasoning evidence.",
    evidenceRequired: "A constructed-response reasoning task at scaffold NONE scored by a rubric.", basis: ["ADDING_IT_UP_PROFICIENCY_STRANDS", "WEBB_DEPTH_OF_KNOWLEDGE"] }),
  c({ id: "LM-ASM-1", layer: "LIBERIALEARN_MASTERY", dimension: "ASSESSMENT", blocking: true, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "The subject assessment blueprint is satisfied (assessmentBlueprint.ts).",
    evidenceRequired: "Blueprint evaluation with no blocking gaps.", basis: ["CONSTRUCTIVE_ALIGNMENT"] }),
  c({ id: "LM-ASM-2", layer: "LIBERIALEARN_MASTERY", dimension: "ASSESSMENT", blocking: true, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "Mastery evidence is independent: collected with hints, worked examples, AI help and answer feedback withheld, and any assistance recorded.",
    evidenceRequired: "Mastery tasks at scaffold NONE with assistance recorded in governed evidence metadata.", basis: ["LEARNING_OUTCOME_STANDARD"] }),
  c({ id: "LM-ASM-3", layer: "LIBERIALEARN_MASTERY", dimension: "ASSESSMENT", blocking: true, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "Retention is planned: each mastery objective has spaced, delayed retrieval at least 7 days after the lesson.",
    evidenceRequired: "Delayed retrieval task(s) bound to the objectives.", basis: ["RETRIEVAL_PRACTICE", "SPACING_EFFECT"] }),
  c({ id: "LM-ACS-1", layer: "LIBERIALEARN_MASTERY", dimension: "ACCESSIBILITY", blocking: false, check: "HUMAN_REQUIRED", p2bDimension: "language_quality",
    statement: "Language load suits the age band, with support for emerging readers that does not lower the mathematical or literary demand.",
    evidenceRequired: "Readability and language-support review.", basis: ["UNIVERSAL_DESIGN_FOR_LEARNING"] }),
  c({ id: "LM-REL-1", layer: "LIBERIALEARN_MASTERY", dimension: "RELEVANCE", blocking: false, check: "AI_JUDGMENT_ADVISORY", p2bDimension: "localization_cultural_accuracy",
    statement: "At least one task applies the objective to an authentic Liberian situation the learner could meet.",
    evidenceRequired: "Application task with its context.", basis: ["STRUCTURED_PEDAGOGY"] }),

  // ── Global Excellence ────────────────────────────────────────────────────
  c({ id: "GE-RSN-1", layer: "GLOBAL_EXCELLENCE", dimension: "REASONING", blocking: true, check: "AI_JUDGMENT_ADVISORY", p2bDimension: "assessment_alignment",
    statement: "Includes a non-routine problem or argument at the reasoning level of strong international frameworks (e.g. TIMSS reasoning domain, PISA proficiency levels).",
    evidenceRequired: "Task with stated framework comparison and cognitive-demand rating.", basis: ["TIMSS_COGNITIVE_DOMAINS", "WEBB_DEPTH_OF_KNOWLEDGE"] }),
  c({ id: "GE-TRN-1", layer: "GLOBAL_EXCELLENCE", dimension: "CONCEPTUAL_MASTERY", blocking: true, check: "DETERMINISTIC", p2bDimension: "assessment_alignment",
    statement: "Transfer is assessed in a context, representation or genre the lesson did not rehearse.",
    evidenceRequired: "Transfer task marked NEW context, at scaffold NONE.", basis: ["TRANSFER_TAXONOMY"] }),
  c({ id: "GE-EXT-1", layer: "GLOBAL_EXCELLENCE", dimension: "ADVANCED_EXTENSION", blocking: true, check: "DETERMINISTIC", p2bDimension: null,
    statement: "An optional extension path goes beyond grade scope for ready learners without gating anyone's progress.",
    evidenceRequired: "Extension task marked optional and non-gating.", basis: ["TEACHING_AT_THE_RIGHT_LEVEL"] }),
  c({ id: "GE-ASM-1", layer: "GLOBAL_EXCELLENCE", dimension: "ASSESSMENT", blocking: true, check: "HUMAN_REQUIRED", p2bDimension: "assessment_alignment",
    statement: "Performance is independently comparable: some outcome measures are scored blind or by an external, independently developed instrument.",
    evidenceRequired: "Pilot measurement plan anchor instrument and blind-scoring protocol.", basis: ["LEARNING_OUTCOME_STANDARD"] }),
  c({ id: "GE-ACC-1", layer: "GLOBAL_EXCELLENCE", dimension: "ACCURACY", blocking: true, check: "HUMAN_REQUIRED", p2bDimension: "factual_correctness",
    statement: "A second, independent subject expert has checked the reasoning and extension tasks.",
    evidenceRequired: "Second exact-revision human review.", basis: ["P2B_QUALIFIED_REVIEW"] }),
]);

/** Short research references behind `basis`. Recorded so reviewers can check the reasoning, not as authority. */
export const EXCELLENCE_BASIS_REFERENCES: Readonly<Record<string, string>> = Object.freeze({
  MOE_CURRICULUM_AUTHORITY: "Liberia Ministry of Education national curriculum is the curriculum authority.",
  WAEC_BASELINE_FLOOR_NOT_CEILING: "WAEC examinations (LJHSCE, WASSCE) are a minimum external baseline, never a ceiling or an endorsement.",
  P2B_QUALIFIED_REVIEW: "LiberiaLearn P2-B qualified human review policy (lib/curriculum/review/policy.ts).",
  ITEM_WRITING_GUIDELINES: "Haladyna, Downing & Rodriguez (2002), A review of multiple-choice item-writing guidelines.",
  DIAGNOSTIC_DISTRACTORS: "Sadler (1998), Psychometric models of student conceptions; distractors built from documented misconceptions.",
  TEACHING_AT_THE_RIGHT_LEVEL: "Banerjee et al. (2017) and GEEAP (2023) Smart Buys: targeting instruction to learning level.",
  STRUCTURED_PEDAGOGY: "Piper et al. (2018) Tusome; GEEAP (2023): structured pedagogy in low- and middle-income systems.",
  CONSTRUCTIVE_ALIGNMENT: "Biggs (1996): objectives, activities and assessment aligned.",
  UNIVERSAL_DESIGN_FOR_LEARNING: "CAST Universal Design for Learning Guidelines.",
  WORKED_EXAMPLE_FADING: "Sweller & Cooper (1985); Renkl & Atkinson (2003): worked examples with faded guidance.",
  GRADUAL_RELEASE: "Pearson & Gallagher (1983): gradual release of responsibility.",
  ADDING_IT_UP_PROFICIENCY_STRANDS: "National Research Council (2001), Adding It Up: five strands including adaptive reasoning.",
  WEBB_DEPTH_OF_KNOWLEDGE: "Webb (1997/2002): depth-of-knowledge levels for alignment.",
  LEARNING_OUTCOME_STANDARD: "LiberiaLearn Learning outcome standard: success is independent demonstration of learning, retention and application.",
  RETRIEVAL_PRACTICE: "Roediger & Karpicke (2006): test-enhanced learning.",
  SPACING_EFFECT: "Cepeda et al. (2006): distributed practice meta-analysis.",
  TIMSS_COGNITIVE_DOMAINS: "IEA TIMSS assessment frameworks: knowing, applying, reasoning.",
  TRANSFER_TAXONOMY: "Barnett & Ceci (2002): a taxonomy for far transfer.",
  WRITING_INSTRUCTION: "Graham & Perin (2007), Writing Next; Graham & Harris: self-regulated strategy development.",
  FORMATIVE_ASSESSMENT: "Black & Wiliam (1998), Assessment and classroom learning.",
});

export type CriterionRatingRecord = Readonly<{
  criterionId: string;
  rating: CriterionRating;
  ratedBy: "DETERMINISTIC" | "AI" | "HUMAN";
  evidenceRefs: readonly string[];
}>;

export type LayerAttainment = Readonly<{
  layer: ExcellenceLayer;
  attained: boolean;
  unmetBlocking: readonly string[];
  /** Always false: design attainment never stands in for learning evidence. */
  isLearningEvidence: false;
}>;

export class ExcellenceStandardError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "ExcellenceStandardError";
  }
}

export function criterionById(id: string): ExcellenceCriterion {
  const criterion = EXCELLENCE_RUBRIC_V1.find((item) => item.id === id);
  if (!criterion) throw new ExcellenceStandardError(`UNKNOWN_CRITERION:${id}`);
  return criterion;
}

/**
 * Cumulative layer attainment. A HUMAN_REQUIRED criterion rated MET by anyone but a human, or a
 * MET rating without evidence, is refused rather than silently counted.
 */
export function evaluateLayerAttainment(ratings: readonly CriterionRatingRecord[]): readonly LayerAttainment[] {
  const byId = new Map<string, CriterionRatingRecord>();
  for (const record of ratings) {
    const criterion = criterionById(record.criterionId);
    if (record.rating === "MET" && record.evidenceRefs.length === 0) throw new ExcellenceStandardError(`MET_WITHOUT_EVIDENCE:${record.criterionId}`);
    if (record.rating === "MET" && criterion.check === "HUMAN_REQUIRED" && record.ratedBy !== "HUMAN") {
      throw new ExcellenceStandardError(`HUMAN_RATING_REQUIRED:${record.criterionId}`);
    }
    if (record.rating === "MET" && criterion.check === "DETERMINISTIC" && record.ratedBy === "AI") {
      throw new ExcellenceStandardError(`DETERMINISTIC_CHECK_REQUIRED:${record.criterionId}`);
    }
    byId.set(record.criterionId, record);
  }
  let lowerAttained = true;
  return EXCELLENCE_LAYERS.map((layer) => {
    const unmetBlocking = EXCELLENCE_RUBRIC_V1
      .filter((criterion) => criterion.layer === layer && criterion.blocking)
      .filter((criterion) => {
        const rating = byId.get(criterion.id)?.rating ?? "NOT_EVALUATED";
        return rating !== "MET" && rating !== "NOT_APPLICABLE";
      })
      .map((criterion) => criterion.id);
    const attained = lowerAttained && unmetBlocking.length === 0;
    lowerAttained = attained;
    return Object.freeze({ layer, attained, unmetBlocking: Object.freeze(unmetBlocking), isLearningEvidence: false as const });
  });
}
