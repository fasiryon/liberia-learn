import { Prisma, type $Enums } from "@prisma/client";
import { prisma } from "@/lib/db";

type Subject = $Enums.Subject;
type GradeBand = $Enums.GradeBand;

const ALL_SUBJECTS: Subject[] = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "ENGLISH",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
];

const BAND_LABEL: Record<GradeBand, string> = {
  G1_3: "Grades 1-3",
  G4_6: "Grades 4-6",
  G7_9: "Grades 7-9",
  G10_12: "Grades 10-12",
};

const BAND_ORDER: GradeBand[] = ["G1_3", "G4_6", "G7_9", "G10_12"];

export type StandardsBrowserAlignedContent = {
  contentId: string;
  title: string;
  grade: number;
};

export type StandardsBrowserStandard = {
  code: string;
  description: string;
  alignedContent: StandardsBrowserAlignedContent[];
};

export type StandardsBrowserBand = {
  band: GradeBand;
  bandLabel: string;
  standards: StandardsBrowserStandard[];
};

export type StandardsBrowserSubject = {
  subject: Subject;
  hasStandards: boolean;
  bands: StandardsBrowserBand[];
};

export type StandardsBrowserResult = {
  subjects: StandardsBrowserSubject[];
  generatedAt: string;
};

type AlignedContentRow = {
  contentId: string;
  title: string | null;
  grade: number;
  moeAlignments: Prisma.JsonValue;
};

function buildContentByCode(rows: AlignedContentRow[]): Map<string, StandardsBrowserAlignedContent[]> {
  const map = new Map<string, StandardsBrowserAlignedContent[]>();
  for (const row of rows) {
    const alignments = row.moeAlignments as { standards?: Array<{ code?: unknown }> } | null;
    const standards = Array.isArray(alignments?.standards) ? alignments!.standards : [];
    for (const entry of standards) {
      const code = typeof entry?.code === "string" ? entry.code : null;
      if (!code) continue;
      const list = map.get(code) ?? [];
      list.push({
        contentId: row.contentId,
        title: row.title?.trim() || "Untitled lesson",
        grade: row.grade,
      });
      map.set(code, list);
    }
  }
  return map;
}

/**
 * Real MOE curriculum-standards browser data, built entirely from the existing
 * Standard model and CurriculumContent.moeAlignments (no new data model, no
 * schema change). Distinct from the WAEC exam-syllabus map in lib/waec/syllabus.ts,
 * which stays untouched. Content is scoped to national/platform lessons plus the
 * requesting teacher's own school-wide-visible lessons, matching the existing
 * visibility semantics used elsewhere for teacher-created content.
 */
export async function buildStandardsBrowser(schoolId: string | null): Promise<StandardsBrowserResult> {
  const [standards, alignedContentRows] = await Promise.all([
    prisma.standard.findMany({
      select: { code: true, description: true, subject: true, band: true },
      orderBy: [{ subject: "asc" }, { band: "asc" }, { code: "asc" }],
    }),
    prisma.curriculumContent.findMany({
      where: {
        status: "APPROVED",
        moeAlignments: { not: Prisma.JsonNull },
        ...(schoolId
          ? { OR: [{ schoolId: null }, { schoolId, visibility: "school_wide" }] }
          : { schoolId: null }),
      },
      select: { contentId: true, title: true, grade: true, moeAlignments: true },
    }),
  ]);

  const contentByCode = buildContentByCode(alignedContentRows);

  const subjects: StandardsBrowserSubject[] = ALL_SUBJECTS.map((subject) => {
    const subjectStandards = standards.filter((s) => s.subject === subject);
    const bands: StandardsBrowserBand[] = BAND_ORDER.map((band) => ({
      band,
      bandLabel: BAND_LABEL[band],
      standards: subjectStandards
        .filter((s) => s.band === band)
        .map((s) => ({
          code: s.code,
          description: s.description,
          alignedContent: contentByCode.get(s.code) ?? [],
        })),
    })).filter((b) => b.standards.length > 0);

    return {
      subject,
      hasStandards: subjectStandards.length > 0,
      bands,
    };
  });

  return {
    subjects,
    generatedAt: new Date().toISOString(),
  };
}
