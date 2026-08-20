import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Seeds the real, evidence-honest P2-C Math pilot into staging only.
 * Every wording, URL, and hash below comes from
 * docs/research/WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md and
 * docs/research/P2C_EVIDENCE_MANIFEST.md -- nothing here is invented.
 * Uses P2A_STAGING_DATABASE_URL. Refuses to run against production.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {

  // --- CurriculumAuthoritySource + Version (5 real sources) ---
  const moeG16 = await tx.curriculumAuthoritySource.create({
    data: {
      authorityType: "LIBERIA_MOE",
      authorityName: "Liberia Ministry of Education",
      jurisdiction: "LIBERIA",
      title: "National Curriculum, Grades 1-6",
      sourceType: "ZIP_ARCHIVE",
      canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip",
      publisher: "Ministry of Education, Republic of Liberia",
      retrievedAt: now,
      subject: "MATH",
      gradeMin: 1,
      gradeMax: 6,
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      notes: "CURRENTLY_VERIFIED_OFFICIAL_EDITION, not CURRENT_LATEST_EDITION. HTTP Last-Modified 2026-07-29; PDF content dated 2020-07. See P2C_EVIDENCE_MANIFEST.md.",
    },
  });
  const moeG16Version = await tx.curriculumAuthoritySourceVersion.create({
    data: {
      sourceId: moeG16.id,
      versionLabel: "2020-07-content-2026-07-29-served",
      retrievedAt: now,
      contentHash: "82b95c17bf5bdbcdf8614c0c1b2c09f0a103c05fe50b5cb8bedf3cb3d9e429a0",
      evidenceLocator: "GRADE-1-6.zip (whole archive); Math 1-6.pdf sha256 ae569b18b38b48cb936f164a79de053005f214500331364be3399c1c185fa74e, page 22",
      extractionMethod: "MANUAL",
      verificationStatus: "VERIFIED",
    },
  });
  await tx.curriculumAuthoritySource.update({ where: { id: moeG16.id }, data: { currentVersionId: moeG16Version.id } });

  const moeG79 = await tx.curriculumAuthoritySource.create({
    data: {
      authorityType: "LIBERIA_MOE",
      authorityName: "Liberia Ministry of Education",
      jurisdiction: "LIBERIA",
      title: "National Curriculum, Grades 7-9",
      sourceType: "ZIP_ARCHIVE",
      canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip",
      publisher: "Ministry of Education, Republic of Liberia",
      retrievedAt: now,
      subject: "MATH",
      gradeMin: 7,
      gradeMax: 9,
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      notes: "CURRENTLY_VERIFIED_OFFICIAL_EDITION, not CURRENT_LATEST_EDITION. See P2C_EVIDENCE_MANIFEST.md.",
    },
  });
  const moeG79Version = await tx.curriculumAuthoritySourceVersion.create({
    data: {
      sourceId: moeG79.id,
      versionLabel: "2020-07-content-2026-07-29-served",
      retrievedAt: now,
      contentHash: "fffb3aed17eeae7cd2fdd1fabc69ea1c7e1587e04d91b6ea01752b1cd185f425",
      evidenceLocator: "GRADE-7-9.zip (whole archive); Math 7-9.pdf sha256 b8f076e1448671bc4f0e7af91ca69795db273f10d6fa0aba6cfc4e9065d28224, page 37 (Grade 9, Topic: TWO-SET PROBLEMS)",
      extractionMethod: "MANUAL",
      verificationStatus: "VERIFIED",
    },
  });
  await tx.curriculumAuthoritySource.update({ where: { id: moeG79.id }, data: { currentVersionId: moeG79Version.id } });

  const moeG1012 = await tx.curriculumAuthoritySource.create({
    data: {
      authorityType: "LIBERIA_MOE",
      authorityName: "Liberia Ministry of Education",
      jurisdiction: "LIBERIA",
      title: "National Curriculum, Grades 10-12",
      sourceType: "ZIP_ARCHIVE",
      canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/Grade-10-12.zip",
      publisher: "Ministry of Education, Republic of Liberia",
      retrievedAt: now,
      subject: "MATH",
      gradeMin: 10,
      gradeMax: 12,
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      notes: "CURRENTLY_VERIFIED_OFFICIAL_EDITION, not CURRENT_LATEST_EDITION. See P2C_EVIDENCE_MANIFEST.md.",
    },
  });
  const moeG1012Version = await tx.curriculumAuthoritySourceVersion.create({
    data: {
      sourceId: moeG1012.id,
      versionLabel: "2020-07-content-2026-07-29-served",
      retrievedAt: now,
      contentHash: "3b3fed2df4a9a1c3d6576cba8ad9f16cc1e0c19a64dcf358f09429f0767ee8ed",
      evidenceLocator: "Grade-10-12.zip (whole archive); Maths 10-12.pdf sha256 987f937d3c354bcfb036cdac971c0f04a7b40c391b119a827a9d072191250237, pages 67-68 (Grade 12, Topic: DIFFERENTIATION AND INTEGRATION)",
      extractionMethod: "MANUAL",
      verificationStatus: "VERIFIED",
    },
  });
  await tx.curriculumAuthoritySource.update({ where: { id: moeG1012.id }, data: { currentVersionId: moeG1012Version.id } });

  const waecLjhsce = await tx.curriculumAuthoritySource.create({
    data: {
      authorityType: "WAEC_LIBERIA",
      authorityName: "West African Examinations Council, Liberia National Office",
      jurisdiction: "LIBERIA",
      title: "The Liberia Junior High Certificate Examination (LJHSCE)",
      sourceType: "WEB_PAGE",
      canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
      publisher: "WAEC Liberia",
      retrievedAt: now,
      subject: "MATH",
      gradeMin: 9,
      gradeMax: 9,
      exam: "LJHSCE",
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      notes: "Subject/exam-applicability evidence only (SUBJECT_LEVEL). Confirms Mathematics 210 is one of 4 compulsory LJHSCE subjects. Does not itself specify topic-level competencies.",
    },
  });
  const waecLjhsceVersion = await tx.curriculumAuthoritySourceVersion.create({
    data: {
      sourceId: waecLjhsce.id,
      versionLabel: "captured-2026-08-17",
      retrievedAt: now,
      contentHash: "fabd89d5b1051637fdb759ad4db7198dc682f150b69a0d69a8e0456453b6d323",
      evidenceLocator: "waecliberia.org.lr/ljhsce/, BACKGROUND section subject table (captured-render hash, live HTML page, see P2C_EVIDENCE_MANIFEST.md)",
      extractionMethod: "MANUAL",
      verificationStatus: "VERIFIED",
    },
  });
  await tx.curriculumAuthoritySource.update({ where: { id: waecLjhsce.id }, data: { currentVersionId: waecLjhsceVersion.id } });

  const waecLshscePrivate = await tx.curriculumAuthoritySource.create({
    data: {
      authorityType: "WAEC_LIBERIA",
      authorityName: "West African Examinations Council, Liberia National Office",
      jurisdiction: "LIBERIA",
      title: "The Liberia Senior High School Certificate Examination - Private (LSHSCE - Private)",
      sourceType: "REGULATION",
      canonicalUrl: "https://waecliberia.org.lr/lshsceprivate/",
      publisher: "WAEC Liberia",
      retrievedAt: now,
      subject: "MATH",
      gradeMin: 12,
      gradeMax: 12,
      exam: "LSHSCE",
      rightsStatus: "RIGHTS_UNKNOWN",
      permittedActions: ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"],
      notes: "General distillation statement (SUBJECT_LEVEL): 'detailed syllabuses...are distillation of the Ministry's Curriculum'. Not a topic-level WAEC syllabus document.",
    },
  });
  const waecLshscePrivateVersion = await tx.curriculumAuthoritySourceVersion.create({
    data: {
      sourceId: waecLshscePrivate.id,
      versionLabel: "captured-2026-08-17",
      retrievedAt: now,
      contentHash: "8002907b9d237897bc1bad82b339096faf289e11bbd4aa613e14cc045266bc57",
      evidenceLocator: "waecliberia.org.lr/lshsceprivate/, body paragraph 1 (captured-render hash, see P2C_EVIDENCE_MANIFEST.md)",
      extractionMethod: "MANUAL",
      verificationStatus: "VERIFIED",
    },
  });
  await tx.curriculumAuthoritySource.update({ where: { id: waecLshscePrivate.id }, data: { currentVersionId: waecLshscePrivateVersion.id } });

  // --- AssessmentBaselineFramework / Subject / Competency ---
  const framework = await tx.assessmentBaselineFramework.create({
    data: {
      code: "WAEC.LIBERIA.LSHSCE",
      authority: "WAEC_LIBERIA",
      jurisdiction: "LIBERIA",
      exam: "LSHSCE",
      level: "SENIOR_SECONDARY_AND_JUNIOR_SECONDARY",
      kind: "BASELINE",
      title: "WAEC Liberia LJHSCE/LSHSCE examination framework (current live label: LSHSCE; regionally also called WASSCE -- see CONFLICTING_TERMINOLOGY note in the research doc)",
      sourceVersionId: waecLjhsceVersion.id,
      verificationStatus: "VERIFIED",
      externalAuthorityStatus: "NOT_CLAIMED",
    },
  });

  const subject = await tx.assessmentBaselineSubject.create({
    data: {
      frameworkId: framework.id,
      code: "MATH",
      name: "Mathematics",
      gradeMin: 9,
      gradeMax: 12,
      required: true,
      subjectGroup: "CORE",
      officialSubjectCode: "210 (LJHSCE) / 301 (LSHSCE)",
      componentSummary: { cass: "40% (LJHSCE) / 30% (LSHSCE)", tass: "60% (LJHSCE) / 70% (LSHSCE)" },
      gradingSummary: { ljhsce: "60% minimum passing mark per subject", lshsce: "stanine 1-9, 1=Excellent...9=Fail, credit=4-6" },
    },
  });

  const competency = await tx.assessmentBaselineCompetency.create({
    data: {
      baselineSubjectId: subject.id,
      sourceVersionId: waecLshscePrivateVersion.id,
      code: "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL",
      domain: "SETS",
      expectation: "Mathematics is a compulsory WAEC Liberia subject at LJHSCE (210) and LSHSCE (301); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes a dedicated Sets / Two-Set Problems unit at Grade 9. No topic-by-topic WAEC Mathematics syllabus was recovered to confirm the exact expected depth for this specific competency.",
      assessmentDepth: "APPLICATION",
      cognitiveDimensions: ["APPLICATION", "PROBLEM_MODELING"],
      evidenceSpecificity: "SUBJECT_LEVEL",
      criticality: "STANDARD",
      evidenceLocator: "waecliberia.org.lr/lshsceprivate/ (distillation statement) + waecliberia.org.lr/ljhsce/ (subject table)",
      confidence: 0.55,
      verificationStatus: "PARTIAL",
    },
  });

  // --- MoeCurriculumObjective (3: G9 real pilot, G12 real pilot, G3 not-applicable case) ---
  const moeG9 = await tx.moeCurriculumObjective.create({
    data: {
      sourceVersionId: moeG79Version.id,
      code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS",
      grade: 9,
      subject: "MATH",
      domain: "SETS",
      topic: "TWO-SET PROBLEMS",
      authoritativeWording:
        "Learners are able to apply the concepts of sets to solve simple two-set problems using Venn diagram, find the complement of a set and represent it on the Venn diagram. Draw and use Venn diagrams to solve simple two-set problems. Find and write the number of subsets in a set with up to 5 elements. Find the rule of the number of subsets in a set.",
      evidenceLocator: "Math 7-9.pdf, Semester One, Grade 9, Period I, Topic: TWO-SET PROBLEMS, page 37",
      extractionMethod: "MANUAL",
      confidence: 0.95,
      verificationStatus: "VERIFIED",
      criticality: "STANDARD",
    },
  });

  const moeG12 = await tx.moeCurriculumObjective.create({
    data: {
      sourceVersionId: moeG1012Version.id,
      code: "MOE.G12.MATH.DIFFERENTIATION_AND_INTEGRATION",
      grade: 12,
      subject: "MATH",
      domain: "CALCULUS",
      topic: "DIFFERENTIATION AND INTEGRATION",
      authoritativeWording:
        "Learners are able to apply concepts to find the limits of simple polynomial and trigonometric functions, find the derivatives of simple algebraic and trigonometric functions. They are able to find the area under a curve and the indefinite integrals of simple polynomial and trigonometric functions. Objectives include defining/discussing the difference quotient, limits, differentiation (first principle and rules), and integration (definite area/summation concept, indefinite integrals).",
      evidenceLocator: "Maths 10-12.pdf, Semester Two, Grade 12, Topic: DIFFERENTIATION AND INTEGRATION, pages 67-68",
      extractionMethod: "MANUAL",
      confidence: 0.95,
      verificationStatus: "VERIFIED",
      criticality: "STANDARD",
    },
  });

  const moeG3 = await tx.moeCurriculumObjective.create({
    data: {
      sourceVersionId: moeG16Version.id,
      code: "MOE.G3.MATH.REVIEW_OF_OPERATIONS",
      grade: 3,
      subject: "MATH",
      domain: "ARITHMETIC",
      topic: "REVIEW OF OPERATIONS",
      authoritativeWording:
        "Add one and two digit numerals. Subtract one and two digit numerals. Subtract two digit numerals using regrouping. Add two digit numerals. Multiply one and two digit numerals. Identify symbols such as >, <, or =. Name parts of a whole.",
      evidenceLocator: "Math 1-6.pdf, Semester One, Grade 3, Period I, Unit I, Topic: REVIEW OF OPERATIONS, page 22",
      extractionMethod: "MANUAL",
      confidence: 0.95,
      verificationStatus: "VERIFIED",
      criticality: "STANDARD",
    },
  });

  // --- CurriculumBaselineAlignment (G9 <-> WAEC competency, corrected SUPPORTING/PARTIAL/UNKNOWN semantics) ---
  // No alignment is created for G12 (no WAEC baseline competency exists for calculus -- see
  // the "above-baseline candidate" hedge in the research doc, not modeled as a baseline alignment)
  // or G3 (NOT_APPLICABLE: LPSCE, WAEC's earliest exam, targets Grade 6).
  const alignment = await tx.curriculumBaselineAlignment.create({
    data: {
      moeObjectiveId: moeG9.id,
      baselineCompetencyId: competency.id,
      relationshipType: "SUPPORTING",
      coverage: "PARTIAL",
      depthRelation: "UNKNOWN",
      confidence: 0.55,
      rationale:
        "The MOE Grade 9 objective requires learners to draw and use Venn diagrams to solve simple two-set problems and find the complement of a set. WAEC Liberia's own LSHSCE-Private page states its detailed syllabuses are a distillation of the Ministry's Curriculum, and Mathematics (210) is one of the four compulsory LJHSCE subjects at this grade. That is only subject-level evidence: no topic-by-topic WAEC Mathematics syllabus was found, so the exact expected depth for this competency at LJHSCE is unknown, not confirmed as met. Per the evidence-specificity guard in lib/curriculum/benchmarking/aiWaecAlignment.ts, a DIRECT relationship or definite depth relation would require TOPIC_LEVEL WAEC evidence, which does not exist yet.",
      evidenceRefs: [
        { id: moeG79Version.id, kind: "MOE_SOURCE_VERSION", locator: "Math 7-9.pdf page 37" },
        { id: waecLshscePrivateVersion.id, kind: "WAEC_SOURCE_VERSION", specificity: "SUBJECT_LEVEL", locator: "lshsceprivate/ distillation statement" },
        { id: waecLjhsceVersion.id, kind: "WAEC_SOURCE_VERSION", specificity: "SUBJECT_LEVEL", locator: "ljhsce/ subject table" },
      ],
      actor: "platform-seed:p2c-real-data-pilot",
      reviewMethod: "MANUAL_EVIDENCE_REVIEW",
      taxonomyVersion: "LIBERIALEARN_COGNITIVE_DEMAND_V1",
      status: "PLATFORM_REVIEWED",
      authorityClaim: "NOT_CLAIMED",
    },
  });

  // --- CurriculumLearningTarget (mastery for G9 sets; extension for G12 calculus) ---
  // No curriculumRevisionId on either: a direct query against staging's live
  // CurriculumContent this session found zero Grade 9 or Grade 12 MATH rows,
  // so no LiberiaLearn lesson exists yet to link. That absence is itself the
  // real gap this pilot demonstrates -- see the gap-check script.
  const masteryTarget = await tx.curriculumLearningTarget.create({
    data: {
      code: "LL.G9.MATH.SETS.TWO_SET_PROBLEMS.MASTERY",
      grade: 9,
      subject: "MATH",
      domain: "SETS",
      targetLevel: "MASTERY",
      statement:
        "A LiberiaLearn Grade 9 learner at mastery can draw and interpret Venn diagrams for two-set problems, determine set complements, and derive the number-of-subsets rule for sets up to 5 elements, matching MOE's Grade 9 Two-Set-Problems objective.",
      minimumDepth: "APPLICATION",
      cognitiveDimensions: ["APPLICATION", "PROBLEM_MODELING"],
      moeObjectiveId: moeG9.id,
      baselineCompetencyId: competency.id,
      evidenceRefs: [{ id: moeG79Version.id, locator: "Math 7-9.pdf page 37" }],
      platformVersion: "P2C_MATH_PILOT_V1",
      verificationStatus: "VERIFIED",
    },
  });

  const extensionTarget = await tx.curriculumLearningTarget.create({
    data: {
      code: "LL.G12.MATH.DIFFERENTIATION_AND_INTEGRATION.EXTENSION",
      grade: 12,
      subject: "MATH",
      domain: "CALCULUS",
      targetLevel: "EXTENSION",
      statement:
        "A LiberiaLearn Grade 12 extension learner can define the difference quotient, apply first-principles differentiation and differentiation rules to simple algebraic and trigonometric functions, and evaluate indefinite integrals of simple polynomial and trigonometric functions, matching MOE's Grade 12 Differentiation-and-Integration unit -- content with no independently WAEC-examined subject vehicle (WAEC Liberia's LSHSCE subject list has no Further Mathematics subject).",
      minimumDepth: "ANALYSIS",
      cognitiveDimensions: ["ANALYSIS", "PROBLEM_MODELING"],
      moeObjectiveId: moeG12.id,
      baselineCompetencyId: null,
      evidenceRefs: [{ id: moeG1012Version.id, locator: "Maths 10-12.pdf pages 67-68" }],
      platformVersion: "P2C_MATH_PILOT_V1",
      verificationStatus: "VERIFIED",
    },
  });

  return {
    sources: [moeG16.id, moeG79.id, moeG1012.id, waecLjhsce.id, waecLshscePrivate.id],
    framework: framework.id,
    subject: subject.id,
    competency: competency.id,
    moeObjectives: { g9: moeG9.id, g12: moeG12.id, g3: moeG3.id },
    alignment: alignment.id,
    learningTargets: { mastery: masteryTarget.id, extension: extensionTarget.id },
  };
  }, { timeout: 30000 });

  console.log("Seeded P2-C real-data Math pilot to staging:");
  console.log(result);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
