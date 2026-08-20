import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C production seed. Follows docs/ops/P2C_PRODUCTION_SEED_MANIFEST.md
 * categories B-F exactly, combining the three staging seed scripts
 * (p2c-staging-exam-framework-seed.ts, p2c-staging-real-data-seed.ts,
 * p2c-staging-subject-expansion-seed.ts) into one production-targeted
 * transaction, with two deliberate corrections documented below and in
 * the cutover record -- this is not a byte-for-byte replay of staging's
 * three-script history, because that history includes the one framework
 * production must never receive.
 *
 * CORRECTION 1 (Action 2, already known): the 5th, superseded merged-pilot
 * framework row (`code: WAEC.LIBERIA.LSHSCE`, no suffix) is never created
 * here. Only the 4 properly-separated frameworks are seeded.
 *
 * CORRECTION 2 (found while building this script, not previously stated
 * in the manifest): staging's Math G9 pilot competency/alignment/mastery
 * target are FK-anchored to that excluded merged framework's own MATH
 * subject. Since AssessmentBaselineSubject has a (frameworkId, code)
 * unique constraint, and both LJHSCE and LSHSCE.REGULAR already have their
 * own "MATH" subject row, there is no way to create an 18th, separately
 * coded MATH subject without either re-introducing the excluded framework
 * (forbidden by Action 2) or violating that constraint. This script
 * instead attaches the pilot's SETS competency to LJHSCE's own existing
 * MATH subject (code 210) -- which is actually a *more* accurate anchor
 * than the original merged row, since the pilot's underlying MOE objective
 * (G9 Two-Set-Problems) is itself Grade-9/LJHSCE-level evidence, not a
 * genuine LJHSCE+LSHSCE composite. Net effect: production has 17
 * AssessmentBaselineSubject rows, not the 18 the manifest stated -- the
 * manifest's 18 assumed a subject row could be created under the excluded
 * framework, which Action 2 forecloses. 16 competencies / 17 objectives /
 * 1 alignment / 2 learning targets / 7 sources / 7 versions / 4 frameworks
 * all still match the manifest exactly.
 *
 * examAliases/regionalReferenceLabels on LSHSCE.REGULAR use the CORRECTED
 * values (examAliases: [], regionalReferenceLabels: ["WASSCE"]) per the
 * manifest's "Hard finding" -- not a copy of staging's stale persisted row.
 *
 * Uses DATABASE_URL. Refuses to run against staging.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertProduction(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");
  if (process.env.P2C_SEED_ALLOW_DISPOSABLE === "true") {
    const parsed = new URL(url);
    const databaseName = parsed.pathname.replace(/^\//, "");
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !databaseName.startsWith("liberialearn_")) {
      throw new Error("Disposable seed override requires a loopback liberialearn_* database");
    }
    return;
  }
  if (!url.includes(`postgres.${PRODUCTION_REF}`)) throw new Error("DATABASE_URL is not the approved production project");
  if (url.includes(STAGING_REF)) throw new Error("REFUSING: URL touches the staging project ref");
}
assertProduction();

const prisma = new PrismaClient();

const RETRIEVED_AT = new Date("2026-08-17T00:00:00.000Z");
const PERMITTED_ACTIONS = ["CITATION", "METADATA", "INTERNAL_ANALYSIS", "AI_ANALYSIS"] as const;

type CognitiveDemand =
  | "NOT_ESTABLISHED" | "RECALL" | "COMPREHENSION" | "PROCEDURAL_FLUENCY" | "APPLICATION" | "ANALYSIS"
  | "REASONING" | "EVALUATION" | "CREATION" | "TRANSFER" | "PROBLEM_MODELING";

type ObjectiveSpec = {
  code: string;
  grade: number;
  subject: string;
  domain: string;
  topic: string;
  authoritativeWording: string;
  moeArchive: "G16" | "G79" | "G1012";
  moePdf: string;
  moePage: string;
  moePdfSha256: string;
  frameworkCode: "WAEC.LIBERIA.LPSCE" | "WAEC.LIBERIA.LJHSCE" | "WAEC.LIBERIA.LSHSCE.REGULAR";
  waecSubjectCode: string;
  competencyCode: string;
  competencyExpectation: string;
  assessmentDepth: CognitiveDemand;
  cognitiveDimensions: CognitiveDemand[];
};

const OBJECTIVES: ObjectiveSpec[] = [
  {
    code: "MOE.G6.LANGUAGE_ARTS.SENTENCES_PRONOUNS_PARAGRAPHS",
    grade: 6, subject: "LANGUAGE_ARTS", domain: "GRAMMAR_AND_COMPOSITION",
    topic: "Kinds and Types of Sentences with Related Punctuations / Kinds of Pronouns / Paragraph Writing",
    authoritativeWording: "1. Identify kinds and types of sentences and apply related punctuations 2. Apply a variety of pronouns in speech and writing 3. Develop paragraphs employing proper mechanics.",
    moeArchive: "G16", moePdf: "English 1-6.pdf", moePage: "115-116",
    moePdfSha256: "6065629aa04a1bd630ed0398fafe0fa4a7c295ce0a5376839535193887abc404",
    frameworkCode: "WAEC.LIBERIA.LPSCE", waecSubjectCode: "LANGUAGE_ARTS",
    competencyCode: "WAEC.LIBERIA.LPSCE.LANGUAGE_ARTS.SUBJECT_LEVEL",
    competencyExpectation: "Language Arts is a compulsory LPSCE subject (330); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated grammar, punctuation, and composition units at Grade 6. No topic-by-topic WAEC Language Arts syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "APPLICATION"],
  },
  {
    code: "MOE.G6.SOCIAL_STUDIES.FOUNDING_OF_LIBERIA",
    grade: 6, subject: "SOCIAL_STUDIES", domain: "LIBERIAN_HISTORY",
    topic: "The Founding of the Liberian State",
    authoritativeWording: "1. Explain who founded the Liberian State 2. List the names of founding members of the American Colonization Society 3. Tell when the Liberian state was officially founded 4. Identify the various periods of Liberian History.",
    moeArchive: "G16", moePdf: "Social Studies Grade 1-6.pdf", moePage: "66",
    moePdfSha256: "5e6330de23f882058415b713cdf9bf28053214cd3e8ea54edb8191e13617a53d",
    frameworkCode: "WAEC.LIBERIA.LPSCE", waecSubjectCode: "SOCIAL_STUDIES",
    competencyCode: "WAEC.LIBERIA.LPSCE.SOCIAL_STUDIES.SUBJECT_LEVEL",
    competencyExpectation: "Social Studies is a compulsory LPSCE subject (340); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated Liberian History units at Grade 6. No topic-by-topic WAEC Social Studies syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "ANALYSIS"],
  },
  {
    code: "MOE.G6.GENERAL_SCIENCE.PLANT_ANIMAL_CLASSIFICATION",
    grade: 6, subject: "GENERAL_SCIENCE", domain: "LIFE_SCIENCE",
    topic: "Classification of Plants and Animals",
    authoritativeWording: "1. Classify plants according to specialized structures 2. Explain how over population affect the survival of plants 3. Name vertebrates and invertebrates groups 4. Identify plants adaptation for survival.",
    moeArchive: "G16", moePdf: "General Science1-6.pdf", moePage: "64",
    moePdfSha256: "a3cb6c6c8cdb767cc07638359a0b225656042c1264580edad707fc69b68413ff",
    frameworkCode: "WAEC.LIBERIA.LPSCE", waecSubjectCode: "GENERAL_SCIENCE",
    competencyCode: "WAEC.LIBERIA.LPSCE.GENERAL_SCIENCE.SUBJECT_LEVEL",
    competencyExpectation: "General Science is a compulsory LPSCE subject (320); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated life-science classification units at Grade 6. No topic-by-topic WAEC General Science syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "APPLICATION"],
  },
  {
    code: "MOE.G9.LANGUAGE_ARTS.COMPOSITION_LITERATURE_COMPREHENSION",
    grade: 9, subject: "LANGUAGE_ARTS", domain: "COMPOSITION_AND_LITERATURE",
    topic: "Composition/Literature and Reading Comprehension",
    authoritativeWording: "1. Write sentences/paragraphs using punctuation marks correctly 2. Develop composition using vocabulary (antonyms and synonyms) 3. Read a passage, identify and interpret the figures [of speech].",
    moeArchive: "G79", moePdf: "English 7-9.pdf", moePage: "23",
    moePdfSha256: "8f01d51551438db0e66c8d31c464a20025fb7c66054d4e836a41dc5d6dd02069",
    frameworkCode: "WAEC.LIBERIA.LJHSCE", waecSubjectCode: "LANGUAGE_ARTS",
    competencyCode: "WAEC.LIBERIA.LJHSCE.LANGUAGE_ARTS.SUBJECT_LEVEL",
    competencyExpectation: "Language Arts is a compulsory LJHSCE subject (230); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated composition and reading-comprehension units at Grade 9. No topic-by-topic WAEC Language Arts syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "APPLICATION"],
  },
  {
    code: "MOE.G9.GENERAL_SCIENCE.MAGNETISM_AND_ELECTRICITY",
    grade: 9, subject: "GENERAL_SCIENCE", domain: "PHYSICAL_SCIENCE",
    topic: "Magnetism and Electricity",
    authoritativeWording: "1. Discuss the causes of magnetism and its properties 2. State electrostatic laws; and discuss static electricity and how it is produced 3. Describe the effects of current electricity on both metallic and non-metallic substances.",
    moeArchive: "G79", moePdf: "General Science 7-9.pdf", moePage: "52",
    moePdfSha256: "79e237c6ecd428f156a617dba074adbf67cba643c3082f81fa4a47ad49440234",
    frameworkCode: "WAEC.LIBERIA.LJHSCE", waecSubjectCode: "GENERAL_SCIENCE",
    competencyCode: "WAEC.LIBERIA.LJHSCE.GENERAL_SCIENCE.SUBJECT_LEVEL",
    competencyExpectation: "General Science is a compulsory LJHSCE subject (220); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated magnetism/electricity units at Grade 9. No topic-by-topic WAEC General Science syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "APPLICATION"],
  },
  {
    code: "MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS",
    grade: 9, subject: "SOCIAL_STUDIES", domain: "REGIONAL_GEOGRAPHY",
    topic: "Regional Geography of West Africa -- Agriculture and Mineral Resources",
    authoritativeWording: "1. Locate the major areas of West Africa noted for production in Agriculture, Mining, Forestry, Fishing, and Industries 2. Evaluate the geographical factors that favor agriculture in West Africa 3. Identify the major mineral resources of West Africa.",
    moeArchive: "G79", moePdf: "Social Studies 7-9.pdf", moePage: "29",
    moePdfSha256: "89b1f263f6cd238d4e1c9b31897f85a2ca7cdcece5c78f21ed72f1b8262849bb",
    frameworkCode: "WAEC.LIBERIA.LJHSCE", waecSubjectCode: "SOCIAL_STUDIES",
    competencyCode: "WAEC.LIBERIA.LJHSCE.SOCIAL_STUDIES.SUBJECT_LEVEL",
    competencyExpectation: "Social Studies is a compulsory LJHSCE subject (240); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated regional-geography units at Grade 9. No topic-by-topic WAEC Social Studies syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "ANALYSIS"],
  },
  {
    code: "MOE.G12.ENGLISH.PRONOUN_CASES_VERB_USAGE",
    grade: 12, subject: "ENGLISH", domain: "GRAMMAR",
    topic: "The Three Cases of Pronouns and Verb Usage",
    authoritativeWording: "Construct speeches effectively using the perfect tenses [of verbs], covering the three Pronoun cases: Nominative, Objective and Possessive.",
    moeArchive: "G1012", moePdf: "ENGLISH GRAMMAR 10-12.pdf", moePage: "26",
    moePdfSha256: "20989a1aef7d4f4eebe6001fea3649b1c44257e3d5ea8393406cb97b60cfd883",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "ENGLISH",
    competencyCode: "WAEC.LIBERIA.LSHSCE.ENGLISH.SUBJECT_LEVEL",
    competencyExpectation: "English Language is a compulsory LSHSCE Core subject (101); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated grammar units at Grade 12. No topic-by-topic WAEC English Language syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "APPLICATION", cognitiveDimensions: ["APPLICATION", "PROCEDURAL_FLUENCY"],
  },
  {
    code: "MOE.G12.ECONOMICS.DEVELOPMENT_AND_PLANNING",
    grade: 12, subject: "ECONOMICS", domain: "LIBERIAN_ECONOMY",
    topic: "Economic Development and Planning (the Liberian Economy)",
    authoritativeWording: "1. Explain the concept of Economic Development and Planning 2. Distinguish between Economic growth and Economic Development 3. Explain the features of underdeveloped, developing and developed economy 4. Analyze the concept of Liberian Traditional Economy.",
    moeArchive: "G1012", moePdf: "Economics 10-12.pdf", moePage: "24",
    moePdfSha256: "ee44f53d7cc17d5c98701e6dd8e689222c21427c3d8c212d520a273c62e2a377",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "ECONOMICS",
    competencyCode: "WAEC.LIBERIA.LSHSCE.ECONOMICS.SUBJECT_LEVEL",
    competencyExpectation: "Economics is a General-group LSHSCE subject (201); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated Liberian economic-development units at Grade 12. No topic-by-topic WAEC Economics syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "ANALYSIS", cognitiveDimensions: ["ANALYSIS", "APPLICATION"],
  },
  {
    code: "MOE.G12.GEOGRAPHY.MAP_READING",
    grade: 12, subject: "GEOGRAPHY", domain: "PRACTICAL_GEOGRAPHY",
    topic: "Practical Geography -- Map Reading, Kinds of Maps and Their Uses",
    authoritativeWording: "1. Explain map information 2. Distinguish between [map types].",
    moeArchive: "G1012", moePdf: "GEOGRAPHY 10-12.pdf", moePage: "48",
    moePdfSha256: "50f3f5276668732254f5ba7f1b8165352bf00afb8fe2bce7b120ece60664d6db",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "GEOGRAPHY",
    competencyCode: "WAEC.LIBERIA.LSHSCE.GEOGRAPHY.SUBJECT_LEVEL",
    competencyExpectation: "Geography is a General-group LSHSCE subject (202); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated practical map-reading units at Grade 12. No topic-by-topic WAEC Geography syllabus was recovered to confirm the exact expected depth for this specific competency. This PDF's own materials list cites WASSCE Q&A papers as a student study aid -- corroborating, not dispositive, evidence that WASSCE-branded material circulates as regional reference material in Liberia's own curriculum documents.",
    assessmentDepth: "APPLICATION", cognitiveDimensions: ["APPLICATION", "COMPREHENSION"],
  },
  {
    code: "MOE.G12.HISTORY.FIRST_LIBERIAN_CIVIL_WAR",
    grade: 12, subject: "HISTORY", domain: "LIBERIAN_HISTORY",
    topic: "Liberian History -- The First Liberian Civil War (1989-1997)",
    authoritativeWording: "discuss factors leading to Liberian Civil War, its [causes and impact].",
    moeArchive: "G1012", moePdf: "History 10-12.pdf", moePage: "25",
    moePdfSha256: "dc315e831ff3f496fef2f8edc24dd4623a2383eaf74dbdfb1e806bfaef661f30",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "HISTORY",
    competencyCode: "WAEC.LIBERIA.LSHSCE.HISTORY.SUBJECT_LEVEL",
    competencyExpectation: "History is a General-group LSHSCE subject (203); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated Liberian-history units at Grade 12. No topic-by-topic WAEC History syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "ANALYSIS", cognitiveDimensions: ["ANALYSIS", "EVALUATION"],
  },
  {
    code: "MOE.G12.LITERATURE.AFRICAN_POEMS_FIGURATIVE_LANGUAGE",
    grade: 12, subject: "LITERATURE", domain: "AFRICAN_POETRY",
    topic: "Review African Poems and Figurative Expressions",
    authoritativeWording: "Analyze a poem based on theme, form, tone, mood, literary [devices].",
    moeArchive: "G1012", moePdf: "LITERATURE    10-12.pdf", moePage: "19",
    moePdfSha256: "e0da458734c07a3710417f5fb7f791e70f72e4b0f341ed1ba8b8530909185abc",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "LITERATURE",
    competencyCode: "WAEC.LIBERIA.LSHSCE.LITERATURE.SUBJECT_LEVEL",
    competencyExpectation: "Literature-in-English is a General-group LSHSCE subject (204); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated African-poetry analysis units at Grade 12. No topic-by-topic WAEC Literature syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "ANALYSIS", cognitiveDimensions: ["ANALYSIS", "EVALUATION"],
  },
  {
    code: "MOE.G12.BIOLOGY.AVES_AND_MAMMALS",
    grade: 12, subject: "BIOLOGY", domain: "CHORDATA",
    topic: "Chordata -- Aves (Birds) and Mammals",
    authoritativeWording: "1. Discuss the general characteristics of birds and mammals 2. Relate the adaptations of birds to flight.",
    moeArchive: "G1012", moePdf: "biology  10-12.pdf", moePage: "34",
    moePdfSha256: "985ca5659a086b3c6bd273f818a923a952378e4bacb702e6064cc961e257c931",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "BIOLOGY",
    competencyCode: "WAEC.LIBERIA.LSHSCE.BIOLOGY.SUBJECT_LEVEL",
    competencyExpectation: "Biology is a Science-group LSHSCE subject (401); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated Chordata units at Grade 12. No topic-by-topic WAEC Biology syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "ANALYSIS"],
  },
  {
    code: "MOE.G12.CHEMISTRY.INDUSTRY_AND_ENVIRONMENT",
    grade: 12, subject: "CHEMISTRY", domain: "APPLIED_CHEMISTRY",
    topic: "Chemistry, Industry and the Environment",
    authoritativeWording: "1. Discuss the historical development of industry [in Liberia] 2. Explain the general characteristics as well as the classification of the chemical industry.",
    moeArchive: "G1012", moePdf: "Chemistry 10-12.pdf", moePage: "47",
    moePdfSha256: "cc6caae32d23051470ca4c4d4fb53878ad770ee2859ad86a2921f8bc48a6d4af",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "CHEMISTRY",
    competencyCode: "WAEC.LIBERIA.LSHSCE.CHEMISTRY.SUBJECT_LEVEL",
    competencyExpectation: "Chemistry is a Science-group LSHSCE subject (402); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated applied-chemistry/industry units at Grade 12. No topic-by-topic WAEC Chemistry syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "COMPREHENSION", cognitiveDimensions: ["COMPREHENSION", "APPLICATION"],
  },
  {
    code: "MOE.G12.PHYSICS.REFRACTION_AND_DISPERSION",
    grade: 12, subject: "PHYSICS", domain: "OPTICS",
    topic: "Refraction and Dispersion of Light",
    authoritativeWording: "1. Analyze and justify the laws of refraction 2. Calculate the refractive index of various [materials].",
    moeArchive: "G1012", moePdf: "Physics 10-12.pdf", moePage: "26",
    moePdfSha256: "d555ec8e1024dfd7124fb75c820f1fea65f66a651b57c74982e66301154b6329",
    frameworkCode: "WAEC.LIBERIA.LSHSCE.REGULAR", waecSubjectCode: "PHYSICS",
    competencyCode: "WAEC.LIBERIA.LSHSCE.PHYSICS.SUBJECT_LEVEL",
    competencyExpectation: "Physics is a Science-group LSHSCE subject (403); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes dedicated optics units at Grade 12. No topic-by-topic WAEC Physics syllabus was recovered to confirm the exact expected depth for this specific competency.",
    assessmentDepth: "APPLICATION", cognitiveDimensions: ["APPLICATION", "PROBLEM_MODELING"],
  },
];

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();

    // --- Category C: 5 sources from the Math pilot ---
    const moeG16 = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "LIBERIA_MOE", jurisdiction: "LIBERIA", canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip" } },
      update: {},
      create: {
        authorityType: "LIBERIA_MOE", authorityName: "Liberia Ministry of Education", jurisdiction: "LIBERIA",
        title: "National Curriculum, Grades 1-6", sourceType: "ZIP_ARCHIVE",
        canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip",
        publisher: "Ministry of Education, Republic of Liberia", retrievedAt: now, subject: "MATH", gradeMin: 1, gradeMax: 6,
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "CURRENTLY_VERIFIED_OFFICIAL_EDITION, not CURRENT_LATEST_EDITION. HTTP Last-Modified 2026-07-29; PDF content dated 2020-07. See P2C_EVIDENCE_MANIFEST.md.",
      },
    });
    const moeG16Version = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: moeG16.id, versionLabel: "2020-07-content-2026-07-29-served" } },
      update: {},
      create: {
        sourceId: moeG16.id, versionLabel: "2020-07-content-2026-07-29-served", retrievedAt: now,
        contentHash: "82b95c17bf5bdbcdf8614c0c1b2c09f0a103c05fe50b5cb8bedf3cb3d9e429a0",
        evidenceLocator: "GRADE-1-6.zip (whole archive); Math 1-6.pdf sha256 ae569b18b38b48cb936f164a79de053005f214500331364be3399c1c185fa74e, page 22",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (moeG16.currentVersionId !== moeG16Version.id) await tx.curriculumAuthoritySource.update({ where: { id: moeG16.id }, data: { currentVersionId: moeG16Version.id } });

    const moeG79 = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "LIBERIA_MOE", jurisdiction: "LIBERIA", canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip" } },
      update: {},
      create: {
        authorityType: "LIBERIA_MOE", authorityName: "Liberia Ministry of Education", jurisdiction: "LIBERIA",
        title: "National Curriculum, Grades 7-9", sourceType: "ZIP_ARCHIVE",
        canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip",
        publisher: "Ministry of Education, Republic of Liberia", retrievedAt: now, subject: "MATH", gradeMin: 7, gradeMax: 9,
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "CURRENTLY_VERIFIED_OFFICIAL_EDITION, not CURRENT_LATEST_EDITION. See P2C_EVIDENCE_MANIFEST.md.",
      },
    });
    const moeG79Version = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: moeG79.id, versionLabel: "2020-07-content-2026-07-29-served" } },
      update: {},
      create: {
        sourceId: moeG79.id, versionLabel: "2020-07-content-2026-07-29-served", retrievedAt: now,
        contentHash: "fffb3aed17eeae7cd2fdd1fabc69ea1c7e1587e04d91b6ea01752b1cd185f425",
        evidenceLocator: "GRADE-7-9.zip (whole archive); Math 7-9.pdf sha256 b8f076e1448671bc4f0e7af91ca69795db273f10d6fa0aba6cfc4e9065d28224, page 37 (Grade 9, Topic: TWO-SET PROBLEMS)",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (moeG79.currentVersionId !== moeG79Version.id) await tx.curriculumAuthoritySource.update({ where: { id: moeG79.id }, data: { currentVersionId: moeG79Version.id } });

    const moeG1012 = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "LIBERIA_MOE", jurisdiction: "LIBERIA", canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/Grade-10-12.zip" } },
      update: {},
      create: {
        authorityType: "LIBERIA_MOE", authorityName: "Liberia Ministry of Education", jurisdiction: "LIBERIA",
        title: "National Curriculum, Grades 10-12", sourceType: "ZIP_ARCHIVE",
        canonicalUrl: "http://www.moe.gov.lr/wp-content/uploads/2019/09/Grade-10-12.zip",
        publisher: "Ministry of Education, Republic of Liberia", retrievedAt: now, subject: "MATH", gradeMin: 10, gradeMax: 12,
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "CURRENTLY_VERIFIED_OFFICIAL_EDITION, not CURRENT_LATEST_EDITION. See P2C_EVIDENCE_MANIFEST.md.",
      },
    });
    const moeG1012Version = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: moeG1012.id, versionLabel: "2020-07-content-2026-07-29-served" } },
      update: {},
      create: {
        sourceId: moeG1012.id, versionLabel: "2020-07-content-2026-07-29-served", retrievedAt: now,
        contentHash: "3b3fed2df4a9a1c3d6576cba8ad9f16cc1e0c19a64dcf358f09429f0767ee8ed",
        evidenceLocator: "Grade-10-12.zip (whole archive); Maths 10-12.pdf sha256 987f937d3c354bcfb036cdac971c0f04a7b40c391b119a827a9d072191250237, pages 67-68 (Grade 12, Topic: DIFFERENTIATION AND INTEGRATION)",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (moeG1012.currentVersionId !== moeG1012Version.id) await tx.curriculumAuthoritySource.update({ where: { id: moeG1012.id }, data: { currentVersionId: moeG1012Version.id } });

    const waecLjhsce = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "WAEC_LIBERIA", jurisdiction: "LIBERIA", canonicalUrl: "https://waecliberia.org.lr/ljhsce/" } },
      update: {},
      create: {
        authorityType: "WAEC_LIBERIA", authorityName: "West African Examinations Council, Liberia National Office", jurisdiction: "LIBERIA",
        title: "The Liberia Junior High Certificate Examination (LJHSCE)", sourceType: "WEB_PAGE",
        canonicalUrl: "https://waecliberia.org.lr/ljhsce/", publisher: "WAEC Liberia", retrievedAt: now, subject: "MATH", gradeMin: 9, gradeMax: 9, exam: "LJHSCE",
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "Subject/exam-applicability evidence only (SUBJECT_LEVEL). Confirms Mathematics 210 is one of 4 compulsory LJHSCE subjects. Does not itself specify topic-level competencies.",
      },
    });
    const waecLjhsceVersion = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: waecLjhsce.id, versionLabel: "captured-2026-08-17" } },
      update: {},
      create: {
        sourceId: waecLjhsce.id, versionLabel: "captured-2026-08-17", retrievedAt: now,
        contentHash: "fabd89d5b1051637fdb759ad4db7198dc682f150b69a0d69a8e0456453b6d323",
        evidenceLocator: "waecliberia.org.lr/ljhsce/, BACKGROUND section subject table (captured-render hash, live HTML page, see P2C_EVIDENCE_MANIFEST.md)",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (waecLjhsce.currentVersionId !== waecLjhsceVersion.id) await tx.curriculumAuthoritySource.update({ where: { id: waecLjhsce.id }, data: { currentVersionId: waecLjhsceVersion.id } });

    const waecLshscePrivate = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "WAEC_LIBERIA", jurisdiction: "LIBERIA", canonicalUrl: "https://waecliberia.org.lr/lshsceprivate/" } },
      update: {},
      create: {
        authorityType: "WAEC_LIBERIA", authorityName: "West African Examinations Council, Liberia National Office", jurisdiction: "LIBERIA",
        title: "The Liberia Senior High School Certificate Examination - Private (LSHSCE - Private)", sourceType: "REGULATION",
        canonicalUrl: "https://waecliberia.org.lr/lshsceprivate/", publisher: "WAEC Liberia", retrievedAt: now, subject: "MATH", gradeMin: 12, gradeMax: 12, exam: "LSHSCE",
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "General distillation statement (SUBJECT_LEVEL): 'detailed syllabuses...are distillation of the Ministry's Curriculum'. Not a topic-level WAEC syllabus document.",
      },
    });
    const waecLshscePrivateVersion = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: waecLshscePrivate.id, versionLabel: "captured-2026-08-17" } },
      update: {},
      create: {
        sourceId: waecLshscePrivate.id, versionLabel: "captured-2026-08-17", retrievedAt: now,
        contentHash: "8002907b9d237897bc1bad82b339096faf289e11bbd4aa613e14cc045266bc57",
        evidenceLocator: "waecliberia.org.lr/lshsceprivate/, body paragraph 1 (captured-render hash, see P2C_EVIDENCE_MANIFEST.md)",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (waecLshscePrivate.currentVersionId !== waecLshscePrivateVersion.id) await tx.curriculumAuthoritySource.update({ where: { id: waecLshscePrivate.id }, data: { currentVersionId: waecLshscePrivateVersion.id } });

    // --- 2 more sources (category C total: 7) ---
    const lpscePage = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "WAEC_LIBERIA", jurisdiction: "LIBERIA", canonicalUrl: "https://waecliberia.org.lr/examination/" } },
      update: {},
      create: {
        authorityType: "WAEC_LIBERIA", authorityName: "West African Examinations Council, Liberia", jurisdiction: "LIBERIA",
        title: "The Liberia Primary School Certificate Examination (LPSCE)", sourceType: "WEB_PAGE",
        canonicalUrl: "https://waecliberia.org.lr/examination/", publisher: "WAEC Liberia", retrievedAt: RETRIEVED_AT, subject: null, gradeMin: 6, gradeMax: 6, exam: "LPSCE",
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "Live browser session this pass, https://waecliberia.org.lr/examination/. Real page, re-check before relying on it again (WAEC could edit this WordPress page without a version marker).",
      },
    });
    const lpsceVersion = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: lpscePage.id, versionLabel: "2026-08-17-live-capture" } },
      update: {},
      create: {
        sourceId: lpscePage.id, versionLabel: "2026-08-17-live-capture", retrievedAt: RETRIEVED_AT,
        contentHash: "68ec91bd02922d5c32ef64fcb8d66d190101825043b061a247a85b6411cd5b4e",
        evidenceLocator: "https://waecliberia.org.lr/examination/ -- captured <main> text render, this session",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (lpscePage.currentVersionId !== lpsceVersion.id) await tx.curriculumAuthoritySource.update({ where: { id: lpscePage.id }, data: { currentVersionId: lpsceVersion.id } });

    const lshsceRegularPage = await tx.curriculumAuthoritySource.upsert({
      where: { authorityType_jurisdiction_canonicalUrl: { authorityType: "WAEC_LIBERIA", jurisdiction: "LIBERIA", canonicalUrl: "https://waecliberia.org.lr/lshsceregular/" } },
      update: {},
      create: {
        authorityType: "WAEC_LIBERIA", authorityName: "West African Examinations Council, Liberia", jurisdiction: "LIBERIA",
        title: "The Liberia Senior High School Certificate Examination (LSHSCE) -- Regular", sourceType: "WEB_PAGE",
        canonicalUrl: "https://waecliberia.org.lr/lshsceregular/", publisher: "WAEC Liberia", retrievedAt: RETRIEVED_AT, subject: null, gradeMin: 12, gradeMax: 12, exam: "LSHSCE",
        rightsStatus: "RIGHTS_UNKNOWN", permittedActions: [...PERMITTED_ACTIONS],
        notes: "Live browser session this pass, https://waecliberia.org.lr/lshsceregular/. Describes 2 core subjects and stanine 1-9 grading, differing from generic regional WASSCE reference material (4 core subjects, A1-F9) -- this is WAEC Liberia's own first-party, current structure and is treated as canonical for LiberiaLearn.",
      },
    });
    const lshsceRegularVersion = await tx.curriculumAuthoritySourceVersion.upsert({
      where: { sourceId_versionLabel: { sourceId: lshsceRegularPage.id, versionLabel: "2026-08-17-live-capture" } },
      update: {},
      create: {
        sourceId: lshsceRegularPage.id, versionLabel: "2026-08-17-live-capture", retrievedAt: RETRIEVED_AT,
        contentHash: "006b02da5b17084d092f1183e5811f2f004053456500e2c37b2fbbceb8299e28",
        evidenceLocator: "https://waecliberia.org.lr/lshsceregular/ -- captured <main> text render, this session",
        extractionMethod: "MANUAL", verificationStatus: "VERIFIED",
      },
    });
    if (lshsceRegularPage.currentVersionId !== lshsceRegularVersion.id) await tx.curriculumAuthoritySource.update({ where: { id: lshsceRegularPage.id }, data: { currentVersionId: lshsceRegularVersion.id } });

    // --- Category B: 4 frameworks, corrected examAliases/regionalReferenceLabels ---
    const lpsce = await tx.assessmentBaselineFramework.upsert({
      where: { code: "WAEC.LIBERIA.LPSCE" },
      update: {},
      create: {
        code: "WAEC.LIBERIA.LPSCE", authority: "WAEC_LIBERIA", jurisdiction: "LIBERIA", exam: "LPSCE", level: "PRIMARY", kind: "BASELINE",
        title: "Liberia Primary School Certificate Examination (LPSCE), Grade 6", examAliases: [],
        sourceVersionId: lpsceVersion.id, verificationStatus: "VERIFIED", externalAuthorityStatus: "NOT_CLAIMED",
      },
    });
    const ljhsce = await tx.assessmentBaselineFramework.upsert({
      where: { code: "WAEC.LIBERIA.LJHSCE" },
      update: {},
      create: {
        code: "WAEC.LIBERIA.LJHSCE", authority: "WAEC_LIBERIA", jurisdiction: "LIBERIA", exam: "LJHSCE", level: "JUNIOR_SECONDARY", kind: "BASELINE",
        title: "Liberia Junior High School Certificate Examination (LJHSCE), Grade 9", examAliases: [],
        sourceVersionId: waecLjhsceVersion.id, verificationStatus: "VERIFIED", externalAuthorityStatus: "NOT_CLAIMED",
      },
    });
    const lshsceRegular = await tx.assessmentBaselineFramework.upsert({
      where: { code: "WAEC.LIBERIA.LSHSCE.REGULAR" },
      update: {},
      create: {
        code: "WAEC.LIBERIA.LSHSCE.REGULAR", authority: "WAEC_LIBERIA", jurisdiction: "LIBERIA", exam: "LSHSCE", level: "SENIOR_SECONDARY", kind: "BASELINE",
        title: "Liberia Senior High School Certificate Examination (LSHSCE), Grade 12, Regular/School Candidates -- the current verified Liberia Grade-12 baseline",
        examAliases: [], regionalReferenceLabels: ["WASSCE"],
        sourceVersionId: lshsceRegularVersion.id, verificationStatus: "VERIFIED", externalAuthorityStatus: "NOT_CLAIMED",
      },
    });
    const lshscePrivate = await tx.assessmentBaselineFramework.upsert({
      where: { code: "WAEC.LIBERIA.LSHSCE.PRIVATE" },
      update: {},
      create: {
        code: "WAEC.LIBERIA.LSHSCE.PRIVATE", authority: "WAEC_LIBERIA", jurisdiction: "LIBERIA", exam: "LSHSCE_PRIVATE", level: "SENIOR_SECONDARY_PRIVATE_CANDIDATE", kind: "BASELINE",
        title: "Liberia Senior High School Certificate Examination, Private Candidates (LSHSCE-Private). Tests coverage of the MOE national senior-high curriculum; WAEC's own detailed syllabuses are a distillation of the Ministry curriculum, guidelines not ends in themselves.",
        examAliases: [], sourceVersionId: waecLshscePrivateVersion.id, verificationStatus: "VERIFIED", externalAuthorityStatus: "NOT_CLAIMED",
      },
    });

    // --- 17 subjects: LPSCE (4), LJHSCE (4), LSHSCE.REGULAR (9), LSHSCE.PRIVATE (0) ---
    const lpsceGrading = { minimumPassPercent: 60, certificateRule: "pass at least 3 of 4 subjects", scale: "percentage" };
    const lpsceComponents = { cassPercent: 40, tassPercent: 60 };
    const lpsceSubjectSpecs = [
      { code: "MATH", name: "Mathematics", officialSubjectCode: "310" },
      { code: "GENERAL_SCIENCE", name: "General Science", officialSubjectCode: "320" },
      { code: "LANGUAGE_ARTS", name: "Language Arts", officialSubjectCode: "330" },
      { code: "SOCIAL_STUDIES", name: "Social Studies", officialSubjectCode: "340" },
    ];
    const lpsceSubjects: Record<string, { id: string; officialSubjectCode: string | null }> = {};
    for (const s of lpsceSubjectSpecs) {
      const row = await tx.assessmentBaselineSubject.upsert({
        where: { frameworkId_code: { frameworkId: lpsce.id, code: s.code } },
        update: {},
        create: { frameworkId: lpsce.id, code: s.code, name: s.name, gradeMin: 6, gradeMax: 6, required: true, subjectGroup: "COMPULSORY", officialSubjectCode: s.officialSubjectCode, componentSummary: lpsceComponents, gradingSummary: lpsceGrading },
      });
      lpsceSubjects[s.code] = { id: row.id, officialSubjectCode: row.officialSubjectCode };
    }

    const ljhsceGrading = { minimumPassPercent: 60, certificateRule: "pass at least 3 of 4 subjects", scale: "percentage" };
    const ljhsceComponents = { cassPercent: 40, tassPercent: 60 };
    const ljhsceSubjectSpecs = [
      { code: "MATH", name: "Mathematics", officialSubjectCode: "210" },
      { code: "GENERAL_SCIENCE", name: "General Science", officialSubjectCode: "220" },
      { code: "LANGUAGE_ARTS", name: "Language Arts", officialSubjectCode: "230" },
      { code: "SOCIAL_STUDIES", name: "Social Studies", officialSubjectCode: "240" },
    ];
    const ljhsceSubjects: Record<string, { id: string; officialSubjectCode: string | null }> = {};
    for (const s of ljhsceSubjectSpecs) {
      const row = await tx.assessmentBaselineSubject.upsert({
        where: { frameworkId_code: { frameworkId: ljhsce.id, code: s.code } },
        update: {},
        create: { frameworkId: ljhsce.id, code: s.code, name: s.name, gradeMin: 9, gradeMax: 9, required: true, subjectGroup: "COMPULSORY", officialSubjectCode: s.officialSubjectCode, componentSummary: ljhsceComponents, gradingSummary: ljhsceGrading },
      });
      ljhsceSubjects[s.code] = { id: row.id, officialSubjectCode: row.officialSubjectCode };
    }

    const lshsceComponents = { cassPercent: 30, tassPercent: 70 };
    const lshsceGrading = {
      scale: "stanine 1-9", bands: { "1": "Excellent", "2": "Very Good", "3": "Good", "4-6": "Credit", "7-8": "Pass", "9": "Fail" },
      entryMinSubjects: 8, entryMaxSubjects: 9,
      certificateRule: "pass at least 6 subjects including both Core subjects, at least one General subject, and at least one Science subject",
      divisions: [
        { name: "I", maxAggregateBest6: 24, mathEnglishRule: "credit" },
        { name: "II", aggregateBest6Range: [25, 36], mathEnglishRule: "credit" },
        { name: "III", aggregateBest6Range: [37, 48], mathEnglishRule: "grade 7 or 8" },
      ],
    };
    const lshsceSubjectSpecs = [
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
    const lshsceSubjects: Record<string, { id: string; officialSubjectCode: string | null }> = {};
    for (const s of lshsceSubjectSpecs) {
      const row = await tx.assessmentBaselineSubject.upsert({
        where: { frameworkId_code: { frameworkId: lshsceRegular.id, code: s.code } },
        update: {},
        create: { frameworkId: lshsceRegular.id, code: s.code, name: s.name, gradeMin: 12, gradeMax: 12, required: s.required, subjectGroup: s.subjectGroup, officialSubjectCode: s.officialSubjectCode, componentSummary: lshsceComponents, gradingSummary: lshsceGrading },
      });
      lshsceSubjects[s.code] = { id: row.id, officialSubjectCode: row.officialSubjectCode };
    }

    const subjectsByFramework: Record<string, { subjects: Record<string, { id: string; officialSubjectCode: string | null }>; sourceVersionId: string; exam: string }> = {
      "WAEC.LIBERIA.LPSCE": { subjects: lpsceSubjects, sourceVersionId: lpsce.sourceVersionId, exam: lpsce.exam },
      "WAEC.LIBERIA.LJHSCE": { subjects: ljhsceSubjects, sourceVersionId: ljhsce.sourceVersionId, exam: ljhsce.exam },
      "WAEC.LIBERIA.LSHSCE.REGULAR": { subjects: lshsceSubjects, sourceVersionId: lshsceRegular.sourceVersionId, exam: lshsceRegular.exam },
    };

    // --- Category D/E: 14 objectives + 15 competencies from the subject-expansion set ---
    const moeVersionByArchive = { G16: moeG16Version.id, G79: moeG79Version.id, G1012: moeG1012Version.id };
    const createdObjectives: string[] = [];
    const createdCompetencies: string[] = [];

    for (const spec of OBJECTIVES) {
      const fw = subjectsByFramework[spec.frameworkCode];
      const subject = fw.subjects[spec.waecSubjectCode];
      if (!subject) throw new Error(`Missing subject ${spec.waecSubjectCode} under ${spec.frameworkCode}`);

      const objective = await tx.moeCurriculumObjective.upsert({
        where: { code: spec.code },
        update: {},
        create: {
          sourceVersionId: moeVersionByArchive[spec.moeArchive], code: spec.code, grade: spec.grade, subject: spec.subject, domain: spec.domain, topic: spec.topic,
          authoritativeWording: spec.authoritativeWording, evidenceLocator: `${spec.moePdf} sha256 ${spec.moePdfSha256}, page ${spec.moePage}`,
          extractionMethod: "MANUAL", confidence: 0.95, verificationStatus: "VERIFIED", criticality: "STANDARD",
        },
      });
      createdObjectives.push(objective.code);

      const competency = await tx.assessmentBaselineCompetency.upsert({
        where: { code: spec.competencyCode },
        update: {},
        create: {
          baselineSubjectId: subject.id, sourceVersionId: fw.sourceVersionId, code: spec.competencyCode, domain: spec.domain, expectation: spec.competencyExpectation,
          assessmentDepth: "NOT_ESTABLISHED", cognitiveDimensions: [], evidenceSpecificity: "SUBJECT_LEVEL", criticality: "STANDARD",
          evidenceLocator: `${fw.exam} subject table (code ${subject.officialSubjectCode}) + distillation statement`, confidence: 0.55, verificationStatus: "PARTIAL",
        },
      });
      createdCompetencies.push(competency.code);
    }

    const mathSubjectLevel = await tx.assessmentBaselineCompetency.upsert({
      where: { code: "WAEC.LIBERIA.LSHSCE.MATH.SUBJECT_LEVEL" },
      update: {},
      create: {
        baselineSubjectId: lshsceSubjects.MATH.id, sourceVersionId: lshsceRegular.sourceVersionId, code: "WAEC.LIBERIA.LSHSCE.MATH.SUBJECT_LEVEL", domain: "MATHEMATICS_GENERAL",
        expectation: "Mathematics is a compulsory LSHSCE Core subject (301); WAEC states its detailed syllabus is a distillation of the MOE senior-high National Curriculum. No topic-by-topic WAEC Mathematics syllabus was recovered, and no WAEC baseline competency for calculus/differentiation-and-integration specifically was found -- subject-level applicability only.",
        assessmentDepth: "NOT_ESTABLISHED", cognitiveDimensions: [], evidenceSpecificity: "SUBJECT_LEVEL", criticality: "STANDARD",
        evidenceLocator: "LSHSCE(Regular) subject table (code 301) + distillation statement", confidence: 0.5, verificationStatus: "PARTIAL",
      },
    });
    createdCompetencies.push(mathSubjectLevel.code);

    // --- Category F, part 1/2: 3 MOE objectives from the Math pilot (G9/G12/G3) ---
    const moeG9 = await tx.moeCurriculumObjective.upsert({
      where: { code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS" },
      update: {},
      create: {
        sourceVersionId: moeG79Version.id, code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS", grade: 9, subject: "MATH", domain: "SETS", topic: "TWO-SET PROBLEMS",
        authoritativeWording: "Learners are able to apply the concepts of sets to solve simple two-set problems using Venn diagram, find the complement of a set and represent it on the Venn diagram. Draw and use Venn diagrams to solve simple two-set problems. Find and write the number of subsets in a set with up to 5 elements. Find the rule of the number of subsets in a set.",
        evidenceLocator: "Math 7-9.pdf, Semester One, Grade 9, Period I, Topic: TWO-SET PROBLEMS, page 37", extractionMethod: "MANUAL", confidence: 0.95, verificationStatus: "VERIFIED", criticality: "STANDARD",
      },
    });
    const moeG12 = await tx.moeCurriculumObjective.upsert({
      where: { code: "MOE.G12.MATH.DIFFERENTIATION_AND_INTEGRATION" },
      update: {},
      create: {
        sourceVersionId: moeG1012Version.id, code: "MOE.G12.MATH.DIFFERENTIATION_AND_INTEGRATION", grade: 12, subject: "MATH", domain: "CALCULUS", topic: "DIFFERENTIATION AND INTEGRATION",
        authoritativeWording: "Learners are able to apply concepts to find the limits of simple polynomial and trigonometric functions, find the derivatives of simple algebraic and trigonometric functions. They are able to find the area under a curve and the indefinite integrals of simple polynomial and trigonometric functions. Objectives include defining/discussing the difference quotient, limits, differentiation (first principle and rules), and integration (definite area/summation concept, indefinite integrals).",
        evidenceLocator: "Maths 10-12.pdf, Semester Two, Grade 12, Topic: DIFFERENTIATION AND INTEGRATION, pages 67-68", extractionMethod: "MANUAL", confidence: 0.95, verificationStatus: "VERIFIED", criticality: "STANDARD",
      },
    });
    const moeG3 = await tx.moeCurriculumObjective.upsert({
      where: { code: "MOE.G3.MATH.REVIEW_OF_OPERATIONS" },
      update: {},
      create: {
        sourceVersionId: moeG16Version.id, code: "MOE.G3.MATH.REVIEW_OF_OPERATIONS", grade: 3, subject: "MATH", domain: "ARITHMETIC", topic: "REVIEW OF OPERATIONS",
        authoritativeWording: "Add one and two digit numerals. Subtract one and two digit numerals. Subtract two digit numerals using regrouping. Add two digit numerals. Multiply one and two digit numerals. Identify symbols such as >, <, or =. Name parts of a whole.",
        evidenceLocator: "Math 1-6.pdf, Semester One, Grade 3, Period I, Unit I, Topic: REVIEW OF OPERATIONS, page 22", extractionMethod: "MANUAL", confidence: 0.95, verificationStatus: "VERIFIED", criticality: "STANDARD",
      },
    });
    createdObjectives.push(moeG9.code, moeG12.code, moeG3.code);

    // --- CORRECTION 2: pilot SETS competency anchored to LJHSCE's own MATH
    // subject (code 210), not a new/excluded framework's MATH subject ---
    const pilotCompetency = await tx.assessmentBaselineCompetency.upsert({
      where: { code: "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL" },
      update: {},
      create: {
        baselineSubjectId: ljhsceSubjects.MATH.id, sourceVersionId: waecLshscePrivateVersion.id, code: "WAEC.LIBERIA.MATH.SETS.SUBJECT_LEVEL", domain: "SETS",
        expectation: "Mathematics is a compulsory WAEC Liberia subject at LJHSCE (210) and LSHSCE (301); WAEC states its detailed syllabus is a distillation of the MOE National Curriculum, which includes a dedicated Sets / Two-Set Problems unit at Grade 9. No topic-by-topic WAEC Mathematics syllabus was recovered to confirm the exact expected depth for this specific competency.",
        assessmentDepth: "NOT_ESTABLISHED", cognitiveDimensions: [], evidenceSpecificity: "SUBJECT_LEVEL", criticality: "STANDARD",
        evidenceLocator: "waecliberia.org.lr/lshsceprivate/ (distillation statement) + waecliberia.org.lr/ljhsce/ (subject table)", confidence: 0.55, verificationStatus: "PARTIAL",
      },
    });
    createdCompetencies.push(pilotCompetency.code);

    // --- Category F, part 2/2: 1 alignment + 2 learning targets ---
    const alignment = await tx.curriculumBaselineAlignment.upsert({
      where: { moeObjectiveId_baselineCompetencyId_version: { moeObjectiveId: moeG9.id, baselineCompetencyId: pilotCompetency.id, version: 1 } },
      update: {},
      create: {
        moeObjectiveId: moeG9.id, baselineCompetencyId: pilotCompetency.id, relationshipType: "SUPPORTING", coverage: "PARTIAL", depthRelation: "UNKNOWN", confidence: 0.55,
        rationale: "The MOE Grade 9 objective requires learners to draw and use Venn diagrams to solve simple two-set problems and find the complement of a set. WAEC Liberia's own LSHSCE-Private page states its detailed syllabuses are a distillation of the Ministry's Curriculum, and Mathematics (210) is one of the four compulsory LJHSCE subjects at this grade. That is only subject-level evidence: no topic-by-topic WAEC Mathematics syllabus was found, so the exact expected depth for this competency at LJHSCE is unknown, not confirmed as met. Per the evidence-specificity guard in lib/curriculum/benchmarking/aiWaecAlignment.ts, a DIRECT relationship or definite depth relation would require TOPIC_LEVEL WAEC evidence, which does not exist yet.",
        evidenceRefs: [
          { id: moeG79Version.id, kind: "MOE_SOURCE_VERSION", locator: "Math 7-9.pdf page 37" },
          { id: waecLshscePrivateVersion.id, kind: "WAEC_SOURCE_VERSION", specificity: "SUBJECT_LEVEL", locator: "lshsceprivate/ distillation statement" },
          { id: waecLjhsceVersion.id, kind: "WAEC_SOURCE_VERSION", specificity: "SUBJECT_LEVEL", locator: "ljhsce/ subject table" },
        ],
        actor: "platform-seed:p2c-production-seed", reviewMethod: "MANUAL_EVIDENCE_REVIEW", taxonomyVersion: "LIBERIALEARN_COGNITIVE_DEMAND_V1", status: "PLATFORM_REVIEWED", authorityClaim: "NOT_CLAIMED",
      },
    });

    const masteryTarget = await tx.curriculumLearningTarget.upsert({
      where: { code_version: { code: "LL.G9.MATH.SETS.TWO_SET_PROBLEMS.MASTERY", version: 1 } },
      update: {},
      create: {
        code: "LL.G9.MATH.SETS.TWO_SET_PROBLEMS.MASTERY", grade: 9, subject: "MATH", domain: "SETS", targetLevel: "MASTERY",
        statement: "A LiberiaLearn Grade 9 learner at mastery can draw and interpret Venn diagrams for two-set problems, determine set complements, and derive the number-of-subsets rule for sets up to 5 elements, matching MOE's Grade 9 Two-Set-Problems objective.",
        minimumDepth: "APPLICATION", cognitiveDimensions: ["APPLICATION", "PROBLEM_MODELING"], moeObjectiveId: moeG9.id, baselineCompetencyId: pilotCompetency.id,
        evidenceRefs: [{ id: moeG79Version.id, locator: "Math 7-9.pdf page 37" }], platformVersion: "P2C_MATH_PILOT_V1", verificationStatus: "VERIFIED",
      },
    });
    const extensionTarget = await tx.curriculumLearningTarget.upsert({
      where: { code_version: { code: "LL.G12.MATH.DIFFERENTIATION_AND_INTEGRATION.EXTENSION", version: 1 } },
      update: {},
      create: {
        code: "LL.G12.MATH.DIFFERENTIATION_AND_INTEGRATION.EXTENSION", grade: 12, subject: "MATH", domain: "CALCULUS", targetLevel: "EXTENSION",
        statement: "A LiberiaLearn Grade 12 extension learner can define the difference quotient, apply first-principles differentiation and differentiation rules to simple algebraic and trigonometric functions, and evaluate indefinite integrals of simple polynomial and trigonometric functions, matching MOE's Grade 12 Differentiation-and-Integration unit. Topic-level WAEC applicability is not currently established from the recovered first-party evidence; this target makes no claim that WAEC does or does not assess the topic.",
        minimumDepth: "ANALYSIS", cognitiveDimensions: ["ANALYSIS", "PROBLEM_MODELING"], moeObjectiveId: moeG12.id, baselineCompetencyId: null,
        evidenceRefs: [{ id: moeG1012Version.id, locator: "Maths 10-12.pdf pages 67-68" }], platformVersion: "P2C_MATH_PILOT_V1", verificationStatus: "VERIFIED",
      },
    });

    return {
      sourceCount: 7,
      frameworks: [lpsce.code, ljhsce.code, lshsceRegular.code, lshscePrivate.code],
      subjectCount: 4 + 4 + 9,
      objectiveCount: createdObjectives.length,
      competencyCount: createdCompetencies.length,
      alignment: alignment.id,
      learningTargets: [masteryTarget.code, extensionTarget.code],
    };
  }, { timeout: 60000 });

  console.log("P2-C production seed complete:");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
