import { describe, expect, it } from "vitest";
import { assessDepth } from "@/lib/curriculum/benchmarking/depth";
import { buildCurriculumGapReport } from "@/lib/curriculum/benchmarking/gapEngine";
import { evaluateRights } from "@/lib/curriculum/benchmarking/rightsPolicy";
import {
  assertAuthoritativeAlignmentEvidence,
  validateAiWaecAlignment,
  type AlignmentEvidence,
} from "@/lib/curriculum/benchmarking/aiWaecAlignment";
import type { CoverageMapping, GapCompetency, GapObjective, GapTarget } from "@/lib/curriculum/benchmarking/types";

/**
 * Real-data validation for the Mathematics pilot (Grade 9 / Grade 12), grounded in
 * documents actually retrieved this session from moe.gov.lr and waecliberia.org.lr.
 * See docs/research/WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md for full
 * source evidence, quotes, and the terminology/LNAT reconciliation this fixture
 * reflects. No objective, competency, or evidence string here is invented; every
 * wording below is taken from the retrieved MOE PDF text or the live WAEC Liberia
 * pages via curl/browser retrieval, not from model memory.
 *
 * Evidence-semantics correction (2026-08-17): only a general WAEC statement that
 * its syllabus is "distilled from" the MOE curriculum, and a subject/exam entry
 * showing Mathematics is examined at this grade, were recovered -- no topic-by-
 * topic WAEC Mathematics syllabus was found. That is SUBJECT_LEVEL evidence, not
 * TOPIC_LEVEL evidence for this exact competency, so this fixture no longer
 * claims DIRECT/MEETS_BASELINE from it. See the "evidence-specificity guard"
 * describe block below for the enforced rule and its positive/negative cases.
 */

const moeG9TwoSetProblems: AlignmentEvidence = {
  id: "moe-math7-9-p37-twoset",
  authorityType: "LIBERIA_MOE",
  canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip",
  sourceVersionId: "moe-grade7-9-curriculum-2020-07",
  locator: "Math 7-9.pdf, Semester One, Grade 9, Period I, Topic: TWO-SET PROBLEMS, page 37",
  excerpt:
    "Learners are able to apply the concepts of sets to solve simple two-set problems using Venn diagram, find the complement of a set and represent it on the Venn diagram. Draw and use Venn diagrams to solve simple two-set problems. Find and write the number of subsets in a set with up to 5 elements.",
  verificationStatus: "VERIFIED",
  evidenceSpecificity: "TOPIC_LEVEL",
};

const waecLjhsceMathDistillation: AlignmentEvidence = {
  id: "waec-lshsce-private-distillation",
  authorityType: "WAEC_LIBERIA",
  canonicalUrl: "https://waecliberia.org.lr/lshsceprivate/",
  sourceVersionId: "waec-liberia-lshsceprivate-2026-08-17",
  locator: "waecliberia.org.lr/lshsceprivate/, body paragraph 1",
  excerpt:
    "This document contains the Regulations for the Liberia Senior High School Certificate Examinations (LSHSCE) for Private Candidates. The examination will test the extent to which candidates have covered materials contained in the National Curriculum of the Ministry of Education for senior high schools. The detailed syllabuses for the Examination are distillation of the Ministry's Curriculum.",
  verificationStatus: "VERIFIED",
  // General distillation statement: applies to every subject and every
  // competency uniformly, so it cannot be TOPIC_LEVEL for this one.
  evidenceSpecificity: "SUBJECT_LEVEL",
};

const waecLjhsceSubjectList: AlignmentEvidence = {
  id: "waec-ljhsce-subject-list",
  authorityType: "WAEC_LIBERIA",
  canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
  sourceVersionId: "waec-liberia-ljhsce-2026-08-17",
  locator: "waecliberia.org.lr/ljhsce/, BACKGROUND section subject table",
  excerpt:
    "The May Liberia Junior High School Certificate Examination (LJHSCE) is administered to school candidates in the 9th grade. The Four Basic Subjects offered for this examination are Mathematics 210, General Science 220, Language Arts 230, Social Studies 240. All candidates for the examination are to enter for all four subjects offered on the examination.",
  verificationStatus: "VERIFIED",
  // Confirms Mathematics is an examined LJHSCE subject, not that "two-set
  // problems" specifically is assessed at any particular depth.
  evidenceSpecificity: "SUBJECT_LEVEL",
};

// Hypothetical only, used solely to prove the evidence-specificity guard's
// positive branch below. No such WAEC Liberia topic-by-topic Mathematics
// syllabus page was found or retrieved this session -- see the research doc's
// "what remains genuinely unverified" section. Do not reuse this fixture as
// if it were real evidence.
const hypotheticalTopicLevelWaecSyllabus: AlignmentEvidence = {
  id: "hypothetical-waec-topic-level-syllabus-not-real",
  authorityType: "WAEC_LIBERIA",
  canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
  sourceVersionId: "waec-liberia-ljhsce-2026-08-17",
  locator: "HYPOTHETICAL -- not a real retrieved document, test fixture only",
  excerpt: "HYPOTHETICAL topic-level syllabus text for the guard's positive-case test only.",
  verificationStatus: "VERIFIED",
  evidenceSpecificity: "TOPIC_LEVEL",
};

describe("P2-C real-data Math pilot: MOE Grade 9 Two-Set Problems <-> WAEC LJHSCE Mathematics(210)", () => {
  it("accepts real evidence from moe.gov.lr and waecliberia.org.lr as authoritative", () => {
    expect(() =>
      assertAuthoritativeAlignmentEvidence([moeG9TwoSetProblems, waecLjhsceMathDistillation, waecLjhsceSubjectList]),
    ).not.toThrow();
  });

  it("validates a real, evidence-grounded AI alignment assessment as INFERRED (SUPPORTING/UNKNOWN), not overclaimed as DIRECT/MEETS_BASELINE", () => {
    const assessment = validateAiWaecAlignment({
      raw: {
        relationshipType: "SUPPORTING",
        coverage: "PARTIAL",
        depthRelation: "UNKNOWN",
        cognitiveDimensions: ["APPLICATION", "PROBLEM_MODELING"],
        rationale:
          "The MOE Grade 9 objective requires learners to draw and use Venn diagrams to solve simple two-set problems and find the complement of a set. WAEC Liberia's own LSHSCE-Private page states its detailed syllabuses are a distillation of the Ministry's Curriculum, and Mathematics (210) is one of the four compulsory LJHSCE subjects at this grade. That is only subject-level evidence: no topic-by-topic WAEC Mathematics syllabus was found, so the exact expected depth for this competency at LJHSCE is unknown, not confirmed as met.",
        objectiveEvidenceTerms: ["venn", "diagrams", "sets", "problems"],
        baselineEvidenceTerms: ["mathematics", "distillation", "curriculum", "candidates"],
        evidenceRefs: [moeG9TwoSetProblems.id, waecLjhsceMathDistillation.id, waecLjhsceSubjectList.id],
        confidence: 0.55,
        overfitToExamMechanics: false,
        prerequisiteGaps: [],
        authorityLabel: "AI_ASSESSED_ALIGNMENT",
        externalApprovalClaimed: false,
      },
      moeObjectiveWording: moeG9TwoSetProblems.excerpt,
      baselineExpectation: `${waecLjhsceMathDistillation.excerpt} ${waecLjhsceSubjectList.excerpt}`,
      evidence: [moeG9TwoSetProblems, waecLjhsceMathDistillation, waecLjhsceSubjectList],
    });
    expect(assessment).toMatchObject({
      relationshipType: "SUPPORTING",
      coverage: "PARTIAL",
      depthRelation: "UNKNOWN",
      authorityLabel: "AI_ASSESSED_ALIGNMENT",
      externalApprovalClaimed: false,
    });
  });

  it("rejects the same evidence if the AI output tried to claim WAEC approval", () => {
    expect(() =>
      validateAiWaecAlignment({
        raw: {
          relationshipType: "SUPPORTING",
          coverage: "PARTIAL",
          depthRelation: "UNKNOWN",
          cognitiveDimensions: ["APPLICATION"],
          rationale: "This mapping is WAEC-approved and confirms official endorsement of the LiberiaLearn Grade 9 Math lesson.",
          objectiveEvidenceTerms: ["venn", "diagrams", "sets"],
          baselineEvidenceTerms: ["mathematics", "distillation"],
          evidenceRefs: [moeG9TwoSetProblems.id, waecLjhsceMathDistillation.id],
          confidence: 0.9,
          overfitToExamMechanics: false,
          prerequisiteGaps: [],
          authorityLabel: "AI_ASSESSED_ALIGNMENT",
          externalApprovalClaimed: false,
        },
        moeObjectiveWording: moeG9TwoSetProblems.excerpt,
        baselineExpectation: waecLjhsceMathDistillation.excerpt,
        evidence: [moeG9TwoSetProblems, waecLjhsceMathDistillation],
      }),
    ).toThrow("AI_EXTERNAL_AUTHORITY_CLAIM_PROHIBITED");
  });
});

describe("P2-C evidence-specificity guard: generic 'WAEC derives from MOE curriculum' evidence cannot create topic-level DIRECT alignment", () => {
  const subjectLevelOnlyEvidence = [moeG9TwoSetProblems, waecLjhsceMathDistillation, waecLjhsceSubjectList];

  it("rejects a DIRECT relationshipType claim when only SUBJECT_LEVEL WAEC evidence is supplied", () => {
    expect(() =>
      validateAiWaecAlignment({
        raw: {
          relationshipType: "DIRECT",
          coverage: "PARTIAL",
          depthRelation: "UNKNOWN",
          cognitiveDimensions: ["APPLICATION"],
          rationale:
            "WAEC's syllabus is distilled from the Ministry's Curriculum and Mathematics is examined at LJHSCE, so this MOE objective must be directly assessed at this exact depth by WAEC.",
          objectiveEvidenceTerms: ["venn", "diagrams", "sets"],
          baselineEvidenceTerms: ["mathematics", "distillation"],
          evidenceRefs: [moeG9TwoSetProblems.id, waecLjhsceMathDistillation.id],
          confidence: 0.8,
          overfitToExamMechanics: false,
          prerequisiteGaps: [],
          authorityLabel: "AI_ASSESSED_ALIGNMENT",
          externalApprovalClaimed: false,
        },
        moeObjectiveWording: moeG9TwoSetProblems.excerpt,
        baselineExpectation: `${waecLjhsceMathDistillation.excerpt} ${waecLjhsceSubjectList.excerpt}`,
        evidence: subjectLevelOnlyEvidence,
      }),
    ).toThrow("TOPIC_LEVEL_CLAIM_WITHOUT_TOPIC_LEVEL_EVIDENCE:relationshipType");
  });

  it("rejects a definite depthRelation claim (MEETS_BASELINE) when only SUBJECT_LEVEL WAEC evidence is supplied, even with a non-DIRECT relationship", () => {
    expect(() =>
      validateAiWaecAlignment({
        raw: {
          relationshipType: "SUPPORTING",
          coverage: "FULL",
          depthRelation: "MEETS_BASELINE",
          cognitiveDimensions: ["APPLICATION"],
          rationale:
            "WAEC's syllabus is distilled from the Ministry's Curriculum, so this competency's depth must already meet the WAEC baseline.",
          objectiveEvidenceTerms: ["venn", "diagrams", "sets"],
          baselineEvidenceTerms: ["mathematics", "distillation"],
          evidenceRefs: [moeG9TwoSetProblems.id, waecLjhsceMathDistillation.id],
          confidence: 0.8,
          overfitToExamMechanics: false,
          prerequisiteGaps: [],
          authorityLabel: "AI_ASSESSED_ALIGNMENT",
          externalApprovalClaimed: false,
        },
        moeObjectiveWording: moeG9TwoSetProblems.excerpt,
        baselineExpectation: `${waecLjhsceMathDistillation.excerpt} ${waecLjhsceSubjectList.excerpt}`,
        evidence: subjectLevelOnlyEvidence,
      }),
    ).toThrow("TOPIC_LEVEL_CLAIM_WITHOUT_TOPIC_LEVEL_EVIDENCE:depthRelation");
  });

  it("allows a DIRECT/MEETS_BASELINE claim once genuine TOPIC_LEVEL WAEC evidence is present (positive case, hypothetical fixture only)", () => {
    const assessment = validateAiWaecAlignment({
      raw: {
        relationshipType: "DIRECT",
        coverage: "FULL",
        depthRelation: "MEETS_BASELINE",
        cognitiveDimensions: ["APPLICATION"],
        rationale:
          "A topic-level WAEC syllabus entry (hypothetical fixture) directly specifies this exact two-set-problems competency at Grade 9, matching the MOE objective's depth.",
        objectiveEvidenceTerms: ["venn", "diagrams", "sets"],
        baselineEvidenceTerms: ["hypothetical", "syllabus"],
        evidenceRefs: [moeG9TwoSetProblems.id, hypotheticalTopicLevelWaecSyllabus.id],
        confidence: 0.85,
        overfitToExamMechanics: false,
        prerequisiteGaps: [],
        authorityLabel: "AI_ASSESSED_ALIGNMENT",
        externalApprovalClaimed: false,
      },
      moeObjectiveWording: moeG9TwoSetProblems.excerpt,
      baselineExpectation: hypotheticalTopicLevelWaecSyllabus.excerpt,
      evidence: [moeG9TwoSetProblems, hypotheticalTopicLevelWaecSyllabus],
    });
    expect(assessment.relationshipType).toBe("DIRECT");
    expect(assessment.depthRelation).toBe("MEETS_BASELINE");
  });
});

describe("P2-C real-data Math pilot: baseline layer is honestly PARTIAL (subject-level evidence only), mastery layer has a genuine authoring gap", () => {
  const moeObjective: GapObjective = {
    id: "moe-g9-math-two-set-problems",
    code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS",
    criticality: "STANDARD",
    verificationStatus: "VERIFIED",
  };
  const waecCompetency: GapCompetency = {
    id: "waec-ljhsce-math-210-sets",
    code: "WAEC.LJHSCE.MATH210.SETS",
    criticality: "STANDARD",
    verificationStatus: "VERIFIED",
    applicable: true,
  };
  // Real finding, not manufactured: a direct Prisma query against the live
  // CurriculumContent table this session found 3 total Grade 9 MATH rows
  // ("Ratios in Market Prices", two quadratic-equations lessons) and none
  // covering sets/Venn diagrams. So the LiberiaLearn mastery target for this
  // exact MOE objective has no authored lesson yet.
  const masteryTarget: GapTarget = {
    id: "ll-g9-math-two-set-problems-mastery",
    code: "LL.G9.MATH.SETS.TWO_SET_PROBLEMS.MASTERY",
    targetLevel: "MASTERY",
  };
  // coverage PARTIAL / depthRelation UNKNOWN, not FULL / MEETS_BASELINE: the
  // only WAEC-side evidence recovered is SUBJECT_LEVEL (the distillation
  // statement and the LJHSCE subject list), so this mapping must not claim a
  // confirmed baseline match -- see the evidence-specificity guard above.
  const baselineAlignmentMapping: CoverageMapping = {
    id: "align-moe-g9-twoset-waec-ljhsce-math210",
    moeObjectiveId: moeObjective.id,
    baselineCompetencyId: waecCompetency.id,
    learningTargetId: null,
    coverage: "PARTIAL",
    depthRelation: "UNKNOWN",
    confidence: 0.55,
    evidenceRefs: [moeG9TwoSetProblems, waecLjhsceMathDistillation, waecLjhsceSubjectList],
    status: "AI_ASSESSED",
  };

  it("does not overclaim COMPLETE_AT_BASELINE when WAEC-side evidence is only subject-level", () => {
    const report = buildCurriculumGapReport({
      moeObjectives: [moeObjective],
      baselineCompetencies: [waecCompetency],
      learningTargets: [],
      mappings: [baselineAlignmentMapping],
    });
    expect(report.waecBaselineCoverageStatus).toBe("PARTIAL");
    expect(report.partiallyCoveredCompetencies).toEqual([waecCompetency.code]);
    expect(report.readinessIndicator).toBe("NOT_READY");
  });

  it("shows a genuine, evidence-based LiberiaLearn mastery-authoring gap for the same competency", () => {
    // No mapping is supplied for masteryTarget.id, because no lesson exists yet.
    const report = buildCurriculumGapReport({
      moeObjectives: [moeObjective],
      baselineCompetencies: [waecCompetency],
      learningTargets: [masteryTarget],
      mappings: [baselineAlignmentMapping],
    });
    expect(report.waecBaselineCoverageStatus).toBe("PARTIAL");
    expect(report.incompleteMasteryTargets).toEqual([masteryTarget.code]);
    expect(report.noGoReasons).toEqual(expect.arrayContaining(["MASTERY_TARGET_INCOMPLETE"]));
    // Two independent, real gaps stack honestly here: the WAEC baseline
    // mapping itself is only PARTIAL (subject-level evidence only), and on
    // top of that, no LiberiaLearn lesson has been authored for this MOE
    // objective yet.
  });
});

describe("P2-C real-data Math pilot: above-baseline candidate (Grade 12 Differentiation and Integration)", () => {
  it("classifies MOE Grade 12 calculus content as above the WAEC-examinable core math subject universe, with hedged confidence", () => {
    const assessment = assessDepth({
      baselineCategory: "PROCEDURAL_FLUENCY",
      observedCategory: "ANALYSIS",
      rationale:
        "MOE's Grade 12 Mathematics curriculum (Maths 10-12.pdf, pages 67-68) includes a full Differentiation and Integration unit: difference quotient, limits, derivatives by first principle, and indefinite integrals of polynomial and trigonometric functions. WAEC Liberia's own LSHSCE(Regular) page enumerates the complete current subject universe (Core: English, Mathematics; General: Economics, Geography, History, Literature; Science: Biology, Chemistry, Physics) and lists no separate Further Mathematics or calculus-focused subject, so no WAEC-Liberia-administered paper independently examines this content. This does not prove the single compulsory Mathematics(301) paper never touches introductory calculus, since no topic-by-topic WAEC Mathematics syllabus was found this session -- treated as a hedged above-baseline candidate, not a proven one.",
      evidenceRefs: [
        "moe.gov.lr Grade-10-12.zip: Maths 10-12.pdf pages 67-68 (Differentiation and Integration)",
        "waecliberia.org.lr/lshsceregular/ (complete Core/General/Science subject enumeration, no Further Mathematics)",
      ],
      reviewMethod: "PLATFORM_REVIEW_REAL_DATA_PILOT",
      confidence: 0.55,
    });
    expect(assessment).toMatchObject({
      relation: "ABOVE_BASELINE",
      precisionNotice: "ORDINAL_JUDGMENT_NOT_SCIENTIFIC_MEASUREMENT",
    });
    // Confidence is deliberately moderate (not high), matching the research
    // doc's explicit hedge: this is corroborated, not first-party-proven for
    // the compulsory paper's exact content boundary.
    expect(assessment.confidence).toBeLessThan(0.7);
  });
});

describe("P2-C real-data Math pilot: non-applicable mapping (Grade 3, pre-dates WAEC's earliest exam)", () => {
  it("classifies a real Grade 3 MOE objective as NOT_APPLICABLE since LPSCE (WAEC's earliest exam) targets Grade 6", () => {
    const grade3Objective: GapObjective = {
      id: "moe-g3-math-review-of-operations",
      code: "MOE.G3.MATH.REVIEW_OF_OPERATIONS",
      criticality: "STANDARD",
      verificationStatus: "VERIFIED",
    };
    // Real MOE Grade 3 objective, Math 1-6.pdf, page 22: "Add one and two
    // digit numerals", "Subtract two digit numerals using regrouping".
    // waecliberia.org.lr/examination/ confirms LPSCE (WAEC's earliest
    // administered exam) targets 6th grade, so no WAEC baseline competency
    // is applicable to a Grade 3 objective yet.
    const report = buildCurriculumGapReport({
      moeObjectives: [grade3Objective],
      baselineCompetencies: [],
      learningTargets: [],
      mappings: [],
    });
    expect(report.waecBaselineCoverageStatus).toBe("NOT_APPLICABLE");
    expect(report.readinessIndicator).toBe("NOT_APPLICABLE");
  });
});

describe("P2-C real-data Math pilot: rights governance on the real MOE curriculum archives", () => {
  it("does not grant learner-display or reproduction rights for the MOE curriculum PDFs by default", () => {
    // moe.gov.lr/curriculum-download/ and the three ZIP archives carry no
    // license or rights statement found this session, so they default to
    // RIGHTS_UNKNOWN, which must not be treated as permission to distribute.
    const internalAnalysis = evaluateRights({
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      action: "INTERNAL_ANALYSIS",
    });
    expect(internalAnalysis.allowed).toBe(true);

    const learnerDisplay = evaluateRights({
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      action: "LEARNER_DISPLAY",
    });
    expect(learnerDisplay).toEqual({ allowed: false, reason: "ACTION_NOT_GRANTED" });
  });
});
