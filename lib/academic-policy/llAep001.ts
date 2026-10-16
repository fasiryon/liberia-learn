/**
 * LiberiaLearn Academic Excellence Policy V1 — LL-AEP-001 v1.0.0 (versioned policy baseline).
 *
 * Authority hierarchy:
 *   1. LiberiaLearn Academic Excellence Standard — primary academic authority (curriculum,
 *      competencies, rigor, grading, mastery, promotion).
 *   2. International academic benchmarks — advanced reasoning, mathematics, literacy, scientific
 *      inquiry and research.
 *   3. MOE / WAEC compatibility — required national coverage, examination preparation and
 *      recognition obligations. A floor that must be covered, never the ceiling.
 *
 * Status: a proposed LiberiaLearn institutional product baseline. It is not a Ministry of
 * Education or WAEC authorization, and nothing in this module activates a policy. Schools adopt
 * a policy version explicitly (an authorized approval), and production activation, record
 * migration, official grade changes and promotion writes each need separate release
 * authorization.
 *
 * This file is pure data and is kept byte-identical in the assessment (PR #193) and academic
 * records (PR #194) branches. A digest test in each branch fails if the copies drift.
 * Values the LL-AEP-001 text did not fix are listed in LL_AEP_001_ENGINEERING_ASSUMPTIONS and
 * need academic sign-off.
 */

export const LL_AEP_001 = Object.freeze({
  policyFamily: "LL-AEP-001",
  version: "1.0.0",
  title: "LiberiaLearn Academic Excellence Policy V1",
  status: "PROPOSED_INSTITUTIONAL_BASELINE",
  activation: "NOT_ACTIVATED",
  authorityOrder: Object.freeze([
    "LIBERIALEARN_ACADEMIC_EXCELLENCE_STANDARD",
    "INTERNATIONAL_ACADEMIC_BENCHMARKS",
    "MOE_WAEC_COMPATIBILITY",
  ] as const),
  externalRecognition: "MOE and WAEC requirements are mandatory coverage and examination-preparation inputs, recorded separately; this policy claims no government authorization.",
} as const);

export const LL_AEP_001_REF = "LL-AEP-001@1.0.0" as const;

// ─── Grading ────────────────────────────────────────────────────────────────────────────────────

export type LlGradeBand = Readonly<{ minPercent: number; label: string; meaning: string }>;

/** Ordered high → low. A score belongs to the first band whose minimum it reaches. */
export const LL_GRADE_BANDS: readonly LlGradeBand[] = Object.freeze([
  { minPercent: 95, label: "A+", meaning: "Exceptional" },
  { minPercent: 90, label: "A", meaning: "Excellent" },
  { minPercent: 85, label: "B+", meaning: "Very strong" },
  { minPercent: 80, label: "B", meaning: "Proficient" },
  { minPercent: 75, label: "C+", meaning: "Approaching proficiency" },
  { minPercent: 70, label: "C", meaning: "Developing" },
  { minPercent: 60, label: "D", meaning: "Significant gaps" },
  { minPercent: 0, label: "F", meaning: "Insufficient evidence of achievement" },
]);

/** Passing, proficiency and mastery are separate thresholds. Mastery thresholds are below. */
export const LL_SUBJECT_THRESHOLDS = Object.freeze({
  /** Minimum subject grade that counts as a pass. */
  passingPercent: 70,
  /** LiberiaLearn's target for strong academic proficiency; not merely permission to progress. */
  proficiencyTargetPercent: 80,
});

export type LlWeightGroup = Readonly<{ groupId: string; label: string; weightPercent: number }>;

/** Grades 4–12 standard weighting (LL-AEP-001 §1). */
export const LL_WEIGHTS_GRADES_4_12: readonly LlWeightGroup[] = Object.freeze([
  { groupId: "INDEPENDENT_CLASSWORK", label: "Independent classwork", weightPercent: 20 },
  { groupId: "HOMEWORK_PRACTICE", label: "Homework and practice", weightPercent: 15 },
  { groupId: "QUIZZES_FORMATIVE", label: "Quizzes and formative checks", weightPercent: 20 },
  { groupId: "PROJECTS_WRITING_PRACTICAL", label: "Projects, writing and practical work", weightPercent: 20 },
  { groupId: "TESTS_EXAMINATIONS", label: "Tests and examinations", weightPercent: 25 },
]);

/**
 * Grades 1–3: mastery demonstrations, guided activities, foundational literacy/numeracy and teacher
 * observation; no traditional high-stakes examinations. The split is an engineering assumption.
 */
export const LL_WEIGHTS_GRADES_1_3: readonly LlWeightGroup[] = Object.freeze([
  { groupId: "MASTERY_DEMONSTRATIONS", label: "Mastery demonstrations", weightPercent: 40 },
  { groupId: "GUIDED_ACTIVITIES", label: "Guided activities", weightPercent: 20 },
  { groupId: "FOUNDATIONAL_LITERACY_NUMERACY", label: "Foundational literacy and numeracy", weightPercent: 25 },
  { groupId: "TEACHER_OBSERVATIONS", label: "Teacher observations", weightPercent: 15 },
]);

/** No single assessment may carry more than this share of a period grade (no single-exam dependency). */
export const LL_MAX_SINGLE_ASSESSMENT_SHARE_PERCENT = 30;

// ─── Mastery ────────────────────────────────────────────────────────────────────────────────────

export const LL_MASTERY_STATES = Object.freeze(["NOT_YET_EVIDENCED", "EMERGING", "DEVELOPING", "SECURE", "ADVANCED"] as const);
export type LlMasteryState = (typeof LL_MASTERY_STATES)[number];

/**
 * Secure requires accurate independent performance; Advanced additionally requires successful
 * transfer to unfamiliar or more complex problems. Only verified, independent evidence counts.
 */
export const LL_MASTERY_REQUIREMENTS = Object.freeze({
  DEVELOPING: Object.freeze({ minIndependentItems: 2, minIndependentAccuracyPercent: 60 }),
  SECURE: Object.freeze({ minIndependentItems: 3, minIndependentOccasions: 2, minIndependentAccuracyPercent: 80 }),
  ADVANCED: Object.freeze({ requiresSecure: true, minVerifiedTransferItems: 1, minTransferAccuracyPercent: 80 }),
});

// ─── Assessment design ──────────────────────────────────────────────────────────────────────────

export const LL_DEMAND_TIERS = Object.freeze(["FOUNDATIONAL", "APPLICATION", "ANALYSIS", "TRANSFER_CREATION"] as const);
export type LlDemandTier = (typeof LL_DEMAND_TIERS)[number];

export type LlDifficultyBlueprint = Readonly<{
  blueprintId: string;
  grades: readonly number[];
  /** Target share of summative marks per tier (sums to 100). A design target, never a quota. */
  targetPercent: Readonly<Record<LlDemandTier, number>>;
  tolerancePercent: number;
}>;

export const LL_DIFFICULTY_BLUEPRINTS: readonly LlDifficultyBlueprint[] = Object.freeze([
  {
    blueprintId: "ll-summative-g4-12",
    grades: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    targetPercent: { FOUNDATIONAL: 20, APPLICATION: 35, ANALYSIS: 30, TRANSFER_CREATION: 15 },
    tolerancePercent: 5,
  },
  {
    // Early literacy and foundational arithmetic need a different distribution (assumption).
    blueprintId: "ll-summative-g1-3",
    grades: [1, 2, 3],
    targetPercent: { FOUNDATIONAL: 45, APPLICATION: 35, ANALYSIS: 15, TRANSFER_CREATION: 5 },
    tolerancePercent: 10,
  },
]);

/** Delayed retention checks: the initial LiberiaLearn default for suitable taught competencies. */
export const LL_RETENTION_DEFAULT = Object.freeze({
  intervalsDays: Object.freeze([7, 21]),
  minimumDelayDays: 7,
  exceptionsRequireDocumentedReason: true,
  note: "Versioned institutional default, adjustable on evidence; not a universal scientific claim about ideal timing.",
});

/** AI Tutor: helps in learning mode; supplies no answers, hints or explanations during independent assessment. */
export const LL_TUTOR_POLICY = Object.freeze({ learningMode: "INSTRUCTIONAL", independentAssessment: "BLOCKED" } as const);

/** High-stakes constructed responses need independent second marking with reconciliation. */
export const LL_SECOND_MARKING = Object.freeze({
  highStakesPurposes: Object.freeze(["SUMMATIVE", "EXAMINATION"] as const),
  /** Marks further apart than this share of the item maximum go to an examiner (assumption). */
  reconciliationTolerancePercent: 10,
});

/** Dimensions authentic-work rubrics (essays, investigations, projects, presentations) must cover. */
export const LL_AUTHENTIC_WORK_DIMENSIONS = Object.freeze(["REASONING", "EVIDENCE", "ACCURACY", "ORIGINALITY", "COMMUNICATION", "REFLECTION"] as const);
export type LlAuthenticWorkDimension = (typeof LL_AUTHENTIC_WORK_DIMENSIONS)[number];

// ─── Calendar, promotion, graduation ────────────────────────────────────────────────────────────

/** Baseline: three academic terms, configurable to the school's approved schedule. */
export const LL_CALENDAR_BASELINE = Object.freeze({ reportingTerms: 3 });

export const LL_PROMOTION = Object.freeze({
  requiredSubjectPassPercent: 70,
  proficiencyTargetPercent: 80,
  /** Ordinary promotion: all required subjects passed and every designated critical competency Secure. */
  criticalCompetencyMinimum: "SECURE" as LlMasteryState,
  attendanceTargetPercent: 90,
  attendanceExceptionsAllowed: true,
  /** Retention is a last resort after structured, documented intervention and review. */
  retentionRequiresDocumentedIntervention: true,
  minimumInterventionSchoolDays: 20,
  conditionalPromotionRequiresSupportPlan: true,
  appealWindowSchoolDays: 15,
  appealRequiresIndependentReview: true,
});

/** Two separately recorded graduation outcomes; neither implies the other. */
export const LL_GRADUATION = Object.freeze({
  liberiaLearnProgramRequirements: Object.freeze(["CREDITS_COMPLETED", "APPROVED_ASSESSMENTS_PASSED", "MAJOR_PROJECT_COMPLETED"] as const),
  nationalSchoolLeaving: "RECORDED_SEPARATELY_WHERE_APPLICABLE",
});

export const LL_INTEGRITY_RULES = Object.freeze([
  "NO_AUTOMATIC_OFFICIAL_AI_GRADING",
  "TEACHER_VERIFICATION_FOR_SUBJECTIVE_WORK",
  "NO_FALSE_ZEROS",
  "NO_SILENT_OFFICIAL_GRADE_CHANGES",
  "REASSESSMENT_ALLOWED_ALL_ATTEMPTS_RETAINED",
  "NO_SINGLE_EXAM_DEPENDENCY",
  "NO_AI_DECIDED_OR_PAID_PROMOTION",
] as const);

/** Values chosen by engineering where LL-AEP-001 gave a direction but no number. Need academic sign-off. */
export const LL_AEP_001_ENGINEERING_ASSUMPTIONS = Object.freeze([
  "Grades 1–3 weights 40/20/25/15",
  "Grades 1–3 difficulty blueprint 45/35/15/5 ±10",
  "Grades 4–12 blueprint tolerance ±5 percentage points",
  "Single assessment cap 30% of a period grade",
  "Mastery: Developing ≥2 items ≥60%; Secure ≥3 items, ≥2 occasions, ≥80%; Advanced ≥1 verified transfer item ≥80%",
  "Second-marking reconciliation tolerance 10% of item maximum",
  "Minimum documented intervention before retention: 20 school days",
  "Conditional promotion limit: at most 1 failed required subject and 2 critical competencies below Secure",
  "Grades 10–12 use the Grades 4–12 weights until a separate version is approved",
]);
