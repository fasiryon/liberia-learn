import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Seeds 14 real, cited MOE curriculum objectives beyond Math (Language Arts,
 * General Science, Social Studies at Grade 6/9; English, Economics,
 * Geography, History, Literature-in-English, Biology, Chemistry, Physics at
 * Grade 12), each paired with one honest SUBJECT_LEVEL WAEC baseline
 * competency under the framework rows created by
 * scripts/p2c-staging-exam-framework-seed.ts. Also seeds one extra
 * SUBJECT_LEVEL Mathematics competency under LSHSCE.REGULAR (case B: no
 * topic-level WAEC evidence exists for calculus, but subject-level Math
 * applicability does).
 *
 * Every quoted objective wording is verbatim from the real MOE archives,
 * re-verified this session (ZIP hashes match the existing evidence
 * manifest, i.e. no source drift) -- see the "Subject expansion pilot PDFs"
 * table in docs/research/P2C_EVIDENCE_MANIFEST.md for the full citation
 * list this script encodes.
 *
 * No topic-level WAEC competency evidence exists for any of these 14
 * subjects (the same public-evidence limitation as Math), so this script
 * deliberately does NOT create any CurriculumBaselineAlignment rows --
 * those are produced by scripts/p2c-live-ai-sme-proof.ts via real live AI
 * calls against the real evidence seeded here, so the alignment relationship
 * (SUPPORTING/PARTIAL/UNKNOWN, never DIRECT) is genuinely assessed, not
 * hand-authored.
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

type CognitiveDemand =
  | "RECALL" | "COMPREHENSION" | "PROCEDURAL_FLUENCY" | "APPLICATION" | "ANALYSIS"
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
    const moeG16 = await tx.curriculumAuthoritySource.findFirstOrThrow({ where: { canonicalUrl: { contains: "GRADE-1-6.zip" } } });
    const moeG79 = await tx.curriculumAuthoritySource.findFirstOrThrow({ where: { canonicalUrl: { contains: "GRADE-7-9.zip" } } });
    const moeG1012 = await tx.curriculumAuthoritySource.findFirstOrThrow({ where: { canonicalUrl: { contains: "Grade-10-12.zip" } } });
    const moeVersionByArchive: Record<ObjectiveSpec["moeArchive"], string> = {
      G16: moeG16.currentVersionId!,
      G79: moeG79.currentVersionId!,
      G1012: moeG1012.currentVersionId!,
    };

    const frameworks = await tx.assessmentBaselineFramework.findMany({
      where: { code: { in: ["WAEC.LIBERIA.LPSCE", "WAEC.LIBERIA.LJHSCE", "WAEC.LIBERIA.LSHSCE.REGULAR"] } },
      include: { subjects: true },
    });
    if (frameworks.length !== 3) throw new Error("Expected the 3 non-private frameworks to already exist -- run p2c-staging-exam-framework-seed.ts first");
    const frameworkByCode = new Map(frameworks.map((framework) => [framework.code, framework]));

    const createdObjectives: string[] = [];
    const createdCompetencies: string[] = [];

    for (const spec of OBJECTIVES) {
      const framework = frameworkByCode.get(spec.frameworkCode);
      if (!framework) throw new Error(`Missing framework ${spec.frameworkCode}`);
      const subject = framework.subjects.find((item) => item.code === spec.waecSubjectCode);
      if (!subject) throw new Error(`Missing subject ${spec.waecSubjectCode} under ${spec.frameworkCode}`);

      const objective = await tx.moeCurriculumObjective.create({
        data: {
          sourceVersionId: moeVersionByArchive[spec.moeArchive],
          code: spec.code,
          grade: spec.grade,
          subject: spec.subject,
          domain: spec.domain,
          topic: spec.topic,
          authoritativeWording: spec.authoritativeWording,
          evidenceLocator: `${spec.moePdf} sha256 ${spec.moePdfSha256}, page ${spec.moePage}`,
          extractionMethod: "MANUAL",
          confidence: 0.95,
          verificationStatus: "VERIFIED",
          criticality: "STANDARD",
        },
      });
      createdObjectives.push(objective.code);

      const competency = await tx.assessmentBaselineCompetency.create({
        data: {
          baselineSubjectId: subject.id,
          sourceVersionId: framework.sourceVersionId,
          code: spec.competencyCode,
          domain: spec.domain,
          expectation: spec.competencyExpectation,
          assessmentDepth: spec.assessmentDepth,
          cognitiveDimensions: spec.cognitiveDimensions,
          evidenceSpecificity: "SUBJECT_LEVEL",
          criticality: "STANDARD",
          evidenceLocator: `${framework.exam} subject table (code ${subject.officialSubjectCode}) + distillation statement`,
          confidence: 0.55,
          verificationStatus: "PARTIAL",
        },
      });
      createdCompetencies.push(competency.code);
    }

    // Extra SUBJECT_LEVEL Mathematics competency under LSHSCE for the G12
    // calculus case: no topic-level WAEC evidence exists for calculus, but
    // subject-level Math applicability (301) does.
    const lshsce = frameworkByCode.get("WAEC.LIBERIA.LSHSCE.REGULAR")!;
    const lshsceMath = lshsce.subjects.find((item) => item.code === "MATH")!;
    const mathSubjectLevel = await tx.assessmentBaselineCompetency.create({
      data: {
        baselineSubjectId: lshsceMath.id,
        sourceVersionId: lshsce.sourceVersionId,
        code: "WAEC.LIBERIA.LSHSCE.MATH.SUBJECT_LEVEL",
        domain: "MATHEMATICS_GENERAL",
        expectation: "Mathematics is a compulsory LSHSCE Core subject (301); WAEC states its detailed syllabus is a distillation of the MOE senior-high National Curriculum. No topic-by-topic WAEC Mathematics syllabus was recovered, and no WAEC baseline competency for calculus/differentiation-and-integration specifically was found -- subject-level applicability only.",
        assessmentDepth: "APPLICATION",
        cognitiveDimensions: ["APPLICATION", "PROBLEM_MODELING"],
        evidenceSpecificity: "SUBJECT_LEVEL",
        criticality: "STANDARD",
        evidenceLocator: "LSHSCE(Regular) subject table (code 301) + distillation statement",
        confidence: 0.5,
        verificationStatus: "PARTIAL",
      },
    });
    createdCompetencies.push(mathSubjectLevel.code);

    return { createdObjectives, createdCompetencies };
  }, { timeout: 30_000 });

  console.log(`Created ${result.createdObjectives.length} MOE objectives:`, result.createdObjectives);
  console.log(`Created ${result.createdCompetencies.length} baseline competencies:`, result.createdCompetencies);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
