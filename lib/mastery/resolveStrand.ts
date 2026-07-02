/**
 * lib/mastery/resolveStrand.ts — PHASE 5A Foundation (D3)
 *
 * Resolves a *guaranteed-valid* (subject, strandKey) StrandCatalog target for a lesson
 * before a mastery write, so updateMasteryProfile's FK to StrandCatalog never mismatches.
 *
 * This is the "ensure the strand catalog match before writes are attempted" half of the
 * fix for the silent .catch(() => null) mastery-write swallow bug. The caller pairs it with
 * surfaced telemetry when a lesson genuinely has no resolvable strand.
 *
 * Resolution order:
 *   1. WAEC syllabus-topic strands (most exam-relevant) — validated against StrandCatalog.
 *   2. Legacy standard/MOE alignment code used directly as a strandKey — validated.
 *   3. Fallback: any active strand for the (coerced subject, grade band); else any active
 *      strand for the subject.
 * Returns null only when the subject has no active strands at all.
 */
import type { GradeBand, Subject } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { masteryStrandCandidates } from "@/lib/waec/syllabus";

export type ResolvedStrand = { subject: Subject; strandKey: string; gradeBand: GradeBand };

type PrismaLike = typeof defaultPrisma;

/**
 * Free-form CurriculumContent.subject → mastery `Subject` enum bucket. Superset of the
 * alignment-engine map: routes WAEC science subfields (Physics/Chemistry/Biology) to
 * SCIENCE and the humanities (History/Geography/Economics/Social Studies) to CIVICS so
 * their completions land on a real strand instead of silently defaulting to LITERACY.
 */
const SUBJECT_COERCE: Record<string, Subject> = {
  MATH: "MATH", MATHEMATICS: "MATH", MATHS: "MATH", GENERAL_MATHEMATICS: "MATH",
  SCIENCE: "SCIENCE", PHYSICS: "SCIENCE", CHEMISTRY: "SCIENCE", BIOLOGY: "SCIENCE",
  LITERACY: "LITERACY", ENGLISH: "LITERACY", ENGLISH_LANGUAGE: "LITERACY", READING: "LITERACY",
  LITERATURE: "LITERACY", LITERATURE_IN_ENGLISH: "LITERACY",
  CIVICS: "CIVICS", SOCIAL_STUDIES: "CIVICS", HISTORY: "CIVICS", GEOGRAPHY: "CIVICS", ECONOMICS: "CIVICS",
  COMPUTER_SCIENCE: "COMPUTER_SCIENCE", COMPUTING: "COMPUTER_SCIENCE", ICT: "COMPUTER_SCIENCE",
  ENGINEERING: "ENGINEERING", ENGINEERING_FOUNDATIONS: "ENGINEERING",
  ARTS: "ARTS", PE: "PE", CAREER: "CAREER",
};

export function coerceMasterySubject(subject: string): Subject {
  return SUBJECT_COERCE[subject.trim().toUpperCase()] ?? "LITERACY";
}

async function strandExists(client: PrismaLike, subject: Subject, strandKey: string): Promise<boolean> {
  const found = await client.strandCatalog.findUnique({
    where: { StrandCatalog_subject_strandKey_key: { subject, strandKey } },
    select: { subject: true },
  });
  return !!found;
}

export async function resolveMasteryStrandForLesson(
  input: {
    contentSubject: string;
    grade: number;
    title?: string | null;
    text?: string | null;
    waecTopics?: string[] | null;
    moeAlignmentCode?: string | null;
    standardCode?: string | null;
  },
  client: PrismaLike = defaultPrisma
): Promise<ResolvedStrand | null> {
  const gradeBand = gradeToBand(input.grade);

  // 1. WAEC topic-derived strands — WAEC prep band only (Grade 9+). Lower grades fall
  //    through to a grade-appropriate strand so they don't land on advanced WAEC strands
  //    (and stay out of the WAEC readiness set by design). Validate each candidate.
  if (input.grade >= 9) {
    const candidates = masteryStrandCandidates({
      contentSubject: input.contentSubject,
      title: input.title,
      text: input.text,
      waecTopics: input.waecTopics,
    });
    for (const c of candidates) {
      if (await strandExists(client, c.subject, c.strandKey)) {
        return { subject: c.subject, strandKey: c.strandKey, gradeBand };
      }
    }
  }

  // 2. Legacy standard / MOE alignment code used directly as a strandKey (validate).
  const enumSubject = coerceMasterySubject(input.contentSubject);
  for (const code of [input.standardCode, input.moeAlignmentCode]) {
    if (code) {
      const key = code.toString().toLowerCase();
      if (await strandExists(client, enumSubject, key)) {
        return { subject: enumSubject, strandKey: key, gradeBand };
      }
    }
  }

  // 3. Fallback: any active strand for (subject, gradeBand); else any active strand for subject.
  const byBand = await client.strandCatalog.findFirst({
    where: { subject: enumSubject, gradeBand, isActive: true },
    orderBy: { strandKey: "asc" },
    select: { strandKey: true },
  });
  if (byBand) return { subject: enumSubject, strandKey: byBand.strandKey, gradeBand };

  const anyStrand = await client.strandCatalog.findFirst({
    where: { subject: enumSubject, isActive: true },
    orderBy: { strandKey: "asc" },
    select: { strandKey: true },
  });
  if (anyStrand) return { subject: enumSubject, strandKey: anyStrand.strandKey, gradeBand };

  return null;
}
