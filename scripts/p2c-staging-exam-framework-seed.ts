import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Seeds the four current, live-verified Liberia WAEC exam frameworks
 * (LPSCE / LJHSCE / LSHSCE-Regular / LSHSCE-Private) into staging with
 * their real subject codes, CASS/TASS split, grading scale, entry rules,
 * and certificate rules, all live-verified this session directly against
 * waecliberia.org.lr (a real browser session, not memory or the prior
 * research doc alone). See docs/research/WAEC_LIBERIA_BASELINE_AND_CURRICULUM_ALIGNMENT.md
 * for the full source record.
 *
 * Deliberately does NOT touch or delete the pre-existing merged
 * "WAEC.LIBERIA.LSHSCE" framework/subject/competency/alignment rows created
 * by the Math pilot (scripts/p2c-staging-real-data-seed.ts) -- those are
 * preserved as-is. This script adds properly-separated, per-exam framework
 * rows under distinct codes; downstream subject-expansion work should use
 * these new rows, not the old merged pilot row.
 *
 * WASSCE is recorded only in regionalReferenceLabels on the new
 * LSHSCE-Regular framework, not as an examAlias and not as a separate
 * AssessmentBaselineFramework or CurriculumAuthoritySource row -- no live,
 * current, WASSCE-specific Liberia source was found this session to cite
 * (the old wassce.html page 404s), and fabricating a source citation would
 * violate the evidence-honesty requirement this whole program is built on.
 * examAliases is reserved for a genuine same-exam alternate name established
 * by first-party Liberia evidence, which this is not: WASSCE is a related
 * regional exam brand, not a first-party-confirmed current name for LSHSCE.
 * regionalReferenceLabels mechanically guarantees WASSCE cannot participate
 * in baseline calculations: nothing queries it for competency mapping, and a
 * dedicated regression (__tests__/p2c/wassce-isolation.test.ts) proves it.
 *
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

const RETRIEVED_AT = new Date("2026-08-17T00:00:00.000Z");
const PERMITTED_ACTIONS = ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"] as const;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // --- Reuse the two WAEC page sources already seeded by the Math pilot ---
    const ljhscePage = await tx.curriculumAuthoritySource.findFirstOrThrow({
      where: { canonicalUrl: "https://waecliberia.org.lr/ljhsce/" },
    });
    const lshscePrivatePage = await tx.curriculumAuthoritySource.findFirstOrThrow({
      where: { canonicalUrl: "https://waecliberia.org.lr/lshsceprivate/" },
    });
    if (!ljhscePage.currentVersionId || !lshscePrivatePage.currentVersionId) {
      throw new Error("Reused WAEC source rows are missing currentVersionId");
    }

    // --- New sources: LPSCE and LSHSCE-Regular pages, live-verified this session ---
    const lpscePage = await tx.curriculumAuthoritySource.create({
      data: {
        authorityType: "WAEC_LIBERIA",
        authorityName: "West African Examinations Council, Liberia",
        jurisdiction: "LIBERIA",
        title: "The Liberia Primary School Certificate Examination (LPSCE)",
        sourceType: "WEB_PAGE",
        canonicalUrl: "https://waecliberia.org.lr/examination/",
        publisher: "WAEC Liberia",
        retrievedAt: RETRIEVED_AT,
        subject: null,
        gradeMin: 6,
        gradeMax: 6,
        exam: "LPSCE",
        rightsStatus: "RIGHTS_UNKNOWN",
        permittedActions: [...PERMITTED_ACTIONS],
        notes: "Live browser session this pass, https://waecliberia.org.lr/examination/. Real page, re-check before relying on it again (WAEC could edit this WordPress page without a version marker).",
      },
    });
    const lpsceVersion = await tx.curriculumAuthoritySourceVersion.create({
      data: {
        sourceId: lpscePage.id,
        versionLabel: "2026-08-17-live-capture",
        retrievedAt: RETRIEVED_AT,
        contentHash: "68ec91bd02922d5c32ef64fcb8d66d190101825043b061a247a85b6411cd5b4e",
        evidenceLocator: "https://waecliberia.org.lr/examination/ -- captured <main> text render, this session",
        extractionMethod: "MANUAL",
        verificationStatus: "VERIFIED",
      },
    });
    await tx.curriculumAuthoritySource.update({ where: { id: lpscePage.id }, data: { currentVersionId: lpsceVersion.id } });

    const lshsceRegularPage = await tx.curriculumAuthoritySource.create({
      data: {
        authorityType: "WAEC_LIBERIA",
        authorityName: "West African Examinations Council, Liberia",
        jurisdiction: "LIBERIA",
        title: "The Liberia Senior High School Certificate Examination (LSHSCE) -- Regular",
        sourceType: "WEB_PAGE",
        canonicalUrl: "https://waecliberia.org.lr/lshsceregular/",
        publisher: "WAEC Liberia",
        retrievedAt: RETRIEVED_AT,
        subject: null,
        gradeMin: 12,
        gradeMax: 12,
        exam: "LSHSCE",
        rightsStatus: "RIGHTS_UNKNOWN",
        permittedActions: [...PERMITTED_ACTIONS],
        notes: "Live browser session this pass, https://waecliberia.org.lr/lshsceregular/. Describes 2 core subjects and stanine 1-9 grading, differing from generic regional WASSCE reference material (4 core subjects, A1-F9) -- this is WAEC Liberia's own first-party, current structure and is treated as canonical for LiberiaLearn.",
      },
    });
    const lshsceRegularVersion = await tx.curriculumAuthoritySourceVersion.create({
      data: {
        sourceId: lshsceRegularPage.id,
        versionLabel: "2026-08-17-live-capture",
        retrievedAt: RETRIEVED_AT,
        contentHash: "006b02da5b17084d092f1183e5811f2f004053456500e2c37b2fbbceb8299e28",
        evidenceLocator: "https://waecliberia.org.lr/lshsceregular/ -- captured <main> text render, this session",
        extractionMethod: "MANUAL",
        verificationStatus: "VERIFIED",
      },
    });
    await tx.curriculumAuthoritySource.update({ where: { id: lshsceRegularPage.id }, data: { currentVersionId: lshsceRegularVersion.id } });

    // --- Four properly-separated frameworks ---
    const lpsce = await tx.assessmentBaselineFramework.create({
      data: {
        code: "WAEC.LIBERIA.LPSCE",
        authority: "WAEC_LIBERIA",
        jurisdiction: "LIBERIA",
        exam: "LPSCE",
        level: "PRIMARY",
        kind: "BASELINE",
        title: "Liberia Primary School Certificate Examination (LPSCE), Grade 6",
        examAliases: [],
        sourceVersionId: lpsceVersion.id,
        verificationStatus: "VERIFIED",
        externalAuthorityStatus: "NOT_CLAIMED",
      },
    });
    const ljhsce = await tx.assessmentBaselineFramework.create({
      data: {
        code: "WAEC.LIBERIA.LJHSCE",
        authority: "WAEC_LIBERIA",
        jurisdiction: "LIBERIA",
        exam: "LJHSCE",
        level: "JUNIOR_SECONDARY",
        kind: "BASELINE",
        title: "Liberia Junior High School Certificate Examination (LJHSCE), Grade 9",
        examAliases: [],
        sourceVersionId: ljhscePage.currentVersionId,
        verificationStatus: "VERIFIED",
        externalAuthorityStatus: "NOT_CLAIMED",
      },
    });
    const lshsceRegular = await tx.assessmentBaselineFramework.create({
      data: {
        code: "WAEC.LIBERIA.LSHSCE.REGULAR",
        authority: "WAEC_LIBERIA",
        jurisdiction: "LIBERIA",
        exam: "LSHSCE",
        level: "SENIOR_SECONDARY",
        kind: "BASELINE",
        title: "Liberia Senior High School Certificate Examination (LSHSCE), Grade 12, Regular/School Candidates -- the current verified Liberia Grade-12 baseline",
        examAliases: [],
        // Regional/historical reference only -- WASSCE is documented as a
        // related regional exam brand, never as a current first-party
        // synonym for LSHSCE. See the module comment above.
        regionalReferenceLabels: ["WASSCE"],
        sourceVersionId: lshsceRegularVersion.id,
        verificationStatus: "VERIFIED",
        externalAuthorityStatus: "NOT_CLAIMED",
      },
    });
    const lshscePrivate = await tx.assessmentBaselineFramework.create({
      data: {
        code: "WAEC.LIBERIA.LSHSCE.PRIVATE",
        authority: "WAEC_LIBERIA",
        jurisdiction: "LIBERIA",
        exam: "LSHSCE_PRIVATE",
        level: "SENIOR_SECONDARY_PRIVATE_CANDIDATE",
        kind: "BASELINE",
        title: "Liberia Senior High School Certificate Examination, Private Candidates (LSHSCE-Private). Tests coverage of the MOE national senior-high curriculum; WAEC's own detailed syllabuses are a distillation of the Ministry curriculum, guidelines not ends in themselves.",
        examAliases: [],
        sourceVersionId: lshscePrivatePage.currentVersionId,
        verificationStatus: "VERIFIED",
        externalAuthorityStatus: "NOT_CLAIMED",
      },
    });

    // --- Subjects: LPSCE (4, all compulsory) ---
    const lpsceGrading = { minimumPassPercent: 60, certificateRule: "pass at least 3 of 4 subjects", scale: "percentage" };
    const lpsceComponents = { cassPercent: 40, tassPercent: 60 };
    const lpsceSubjects = [
      { code: "MATH", name: "Mathematics", officialSubjectCode: "310" },
      { code: "GENERAL_SCIENCE", name: "General Science", officialSubjectCode: "320" },
      { code: "LANGUAGE_ARTS", name: "Language Arts", officialSubjectCode: "330" },
      { code: "SOCIAL_STUDIES", name: "Social Studies", officialSubjectCode: "340" },
    ];
    for (const subject of lpsceSubjects) {
      await tx.assessmentBaselineSubject.create({
        data: {
          frameworkId: lpsce.id,
          code: subject.code,
          name: subject.name,
          gradeMin: 6,
          gradeMax: 6,
          required: true,
          subjectGroup: "COMPULSORY",
          officialSubjectCode: subject.officialSubjectCode,
          componentSummary: lpsceComponents,
          gradingSummary: lpsceGrading,
        },
      });
    }

    // --- Subjects: LJHSCE (4, all compulsory) ---
    const ljhsceGrading = { minimumPassPercent: 60, certificateRule: "pass at least 3 of 4 subjects", scale: "percentage" };
    const ljhsceComponents = { cassPercent: 40, tassPercent: 60 };
    const ljhsceSubjects = [
      { code: "MATH", name: "Mathematics", officialSubjectCode: "210" },
      { code: "GENERAL_SCIENCE", name: "General Science", officialSubjectCode: "220" },
      { code: "LANGUAGE_ARTS", name: "Language Arts", officialSubjectCode: "230" },
      { code: "SOCIAL_STUDIES", name: "Social Studies", officialSubjectCode: "240" },
    ];
    for (const subject of ljhsceSubjects) {
      await tx.assessmentBaselineSubject.create({
        data: {
          frameworkId: ljhsce.id,
          code: subject.code,
          name: subject.name,
          gradeMin: 9,
          gradeMax: 9,
          required: true,
          subjectGroup: "COMPULSORY",
          officialSubjectCode: subject.officialSubjectCode,
          componentSummary: ljhsceComponents,
          gradingSummary: ljhsceGrading,
        },
      });
    }

    // --- Subjects: LSHSCE Regular (9, Core/General/Science) ---
    const lshsceComponents = { cassPercent: 30, tassPercent: 70 };
    const lshsceGrading = {
      scale: "stanine 1-9",
      bands: { "1": "Excellent", "2": "Very Good", "3": "Good", "4-6": "Credit", "7-8": "Pass", "9": "Fail" },
      entryMinSubjects: 8,
      entryMaxSubjects: 9,
      certificateRule: "pass at least 6 subjects including both Core subjects, at least one General subject, and at least one Science subject",
      divisions: [
        { name: "I", maxAggregateBest6: 24, mathEnglishRule: "credit" },
        { name: "II", aggregateBest6Range: [25, 36], mathEnglishRule: "credit" },
        { name: "III", aggregateBest6Range: [37, 48], mathEnglishRule: "grade 7 or 8" },
      ],
    };
    const lshsceSubjects = [
      { code: "ENGLISH", name: "English Language", officialSubjectCode: "101", subjectGroup: "CORE", required: true },
      { code: "MATH", name: "Mathematics", officialSubjectCode: "301", subjectGroup: "CORE", required: true },
      { code: "ECONOMICS", name: "Economics", officialSubjectCode: "201", subjectGroup: "GENERAL", required: false },
      { code: "GEOGRAPHY", name: "Geography", officialSubjectCode: "202", subjectGroup: "GENERAL", required: false },
      { code: "HISTORY", name: "History", officialSubjectCode: "203", subjectGroup: "GENERAL", required: false },
      { code: "LITERATURE", name: "Literature-in-English", officialSubjectCode: "204", subjectGroup: "GENERAL", required: false },
      { code: "BIOLOGY", name: "Biology", officialSubjectCode: "401", subjectGroup: "SCIENCE", required: false },
      { code: "CHEMISTRY", name: "Chemistry", officialSubjectCode: "402", subjectGroup: "SCIENCE", required: false },
      { code: "PHYSICS", name: "Physics", officialSubjectCode: "403", subjectGroup: "SCIENCE", required: false },
    ];
    for (const subject of lshsceSubjects) {
      await tx.assessmentBaselineSubject.create({
        data: {
          frameworkId: lshsceRegular.id,
          code: subject.code,
          name: subject.name,
          gradeMin: 12,
          gradeMax: 12,
          required: subject.required,
          subjectGroup: subject.subjectGroup,
          officialSubjectCode: subject.officialSubjectCode,
          componentSummary: lshsceComponents,
          gradingSummary: lshsceGrading,
        },
      });
    }
    // LSHSCE-Private: no distinct subject-level rows. The live page describes
    // only the "same national curriculum, guideline not endpoint" principle,
    // with no distinct subject codes or grading split of its own -- creating
    // subject rows here would manufacture detail not actually on the source.

    return {
      frameworks: [lpsce.code, ljhsce.code, lshsceRegular.code, lshscePrivate.code],
      subjectCounts: { lpsce: lpsceSubjects.length, ljhsce: ljhsceSubjects.length, lshsceRegular: lshsceSubjects.length, lshscePrivate: 0 },
    };
  }, { timeout: 30_000 });

  console.log("Seeded frameworks:", result.frameworks);
  console.log("Subject counts:", result.subjectCounts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
