/**
 * scripts/moe-alignment-dry-run.ts
 *
 * Read-only dry run for the MOE alignment backfill. Replicates
 * lib/moe/alignment-engine.ts's real logic (post SUBJECT_MAP fix)
 * against the real backfill candidate set, but never persists anything.
 *
 * Reports:
 *  - rows processed vs rows with a genuine non-empty standard match
 *    (kept as two permanently distinct numbers, per standing convention)
 *  - structural gap: candidates with zero standards for their subject/band
 *  - matchable-text-length distribution, flagging thin/template-stub content
 *  - for the keyword-fails-but-has-candidates bucket, a sampled AI-fallback
 *    pass (real routedCompletion calls, no persist) to project a genuine
 *    total, cross-tabbed against text length so we can tell "bug" from
 *    "genuinely thin content" as the honest driver of empties.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/moe-alignment-dry-run.ts
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

const STATUS_FILTER = ["APPROVED", "published", "approved"];
const THIN_THRESHOLD = 300; // chars; the incident's example was 154
const AI_SAMPLE_PER_SUBJECT = 40;

// --- exact copy of the FIXED alignment-engine.ts logic (read-only use only) ---
const SUBJECT_MAP: Record<string, string> = {
  math: "MATH", mathematics: "MATH", science: "SCIENCE", literacy: "LITERACY",
  english: "LITERACY", reading: "LITERACY", civics: "CIVICS", "social studies": "CIVICS",
  social_studies: "CIVICS", "computer science": "COMPUTER_SCIENCE",
  computer_science: "COMPUTER_SCIENCE", computing: "COMPUTER_SCIENCE", ict: "COMPUTER_SCIENCE",
  engineering: "ENGINEERING", arts: "ARTS", pe: "PE", career: "CAREER",
};
function gradeToBand(grade: number) {
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  if (grade <= 9) return "G7_9";
  return "G10_12";
}
function extractLessonText(payload: any): string {
  const textParts: string[] = [];
  if (payload) {
    for (const key of ["title", "description", "objectives", "content", "summary", "lessonPlan"]) {
      const val = payload[key];
      if (typeof val === "string") textParts.push(val);
      else if (Array.isArray(val)) textParts.push(val.filter((v: any) => typeof v === "string").join(" "));
      else if (typeof val === "object" && val) textParts.push(JSON.stringify(val));
    }
  }
  return textParts.join(" ").toLowerCase();
}
function scoreStandards(lessonText: string, candidates: Array<{ code: string; description: string }>) {
  return candidates.map((c) => {
    const descWords = c.description.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    if (descWords.length === 0) return { ...c, score: 0 };
    const matched = descWords.filter((w) => lessonText.includes(w)).length;
    return { ...c, score: matched / descWords.length };
  });
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function main() {
  const candidates = await prisma.curriculumContent.findMany({
    where: { status: { in: STATUS_FILTER }, moeAlignments: { equals: Prisma.DbNull } },
    select: { id: true, contentId: true, grade: true, subject: true, payload: true },
  });

  console.log(`\nTotal backfill candidates (processed): ${candidates.length}`);

  // Pre-fetch all standards once, group by subject+band
  const allStandards = await prisma.standard.findMany({ select: { code: true, description: true, subject: true, band: true } });
  const standardsByKey = new Map<string, Array<{ code: string; description: string }>>();
  for (const s of allStandards) {
    const key = `${s.subject}::${s.band}`;
    if (!standardsByKey.has(key)) standardsByKey.set(key, []);
    standardsByKey.get(key)!.push({ code: s.code, description: s.description });
  }

  type Bucket = "keyword_match" | "no_standards" | "needs_ai_fallback";
  const results: Array<{ contentId: string; subject: string; textLength: number; bucket: Bucket; topScore: number }> = [];

  for (const c of candidates) {
    const subjectKey = SUBJECT_MAP[c.subject.toLowerCase()];
    const band = gradeToBand(c.grade);
    const standardsKey = subjectKey ? `${subjectKey}::${band}` : null;
    const candStandards = standardsKey ? standardsByKey.get(standardsKey) ?? [] : [];
    const lessonText = extractLessonText(c.payload);
    const textLength = lessonText.length;

    if (candStandards.length === 0) {
      results.push({ contentId: c.contentId, subject: c.subject, textLength, bucket: "no_standards", topScore: 0 });
      continue;
    }

    const scored = scoreStandards(lessonText, candStandards);
    const topScore = Math.max(...scored.map((s) => s.score));
    if (topScore >= 0.15) {
      results.push({ contentId: c.contentId, subject: c.subject, textLength, bucket: "keyword_match", topScore });
    } else {
      results.push({ contentId: c.contentId, subject: c.subject, textLength, bucket: "needs_ai_fallback", topScore });
    }
  }

  const keywordMatches = results.filter((r) => r.bucket === "keyword_match");
  const noStandards = results.filter((r) => r.bucket === "no_standards");
  const needsAi = results.filter((r) => r.bucket === "needs_ai_fallback");

  console.log(`\n=== EXACT, DETERMINISTIC RESULTS (no AI, no persist) ===`);
  console.log(`  Genuine keyword match (score >= 0.15):        ${keywordMatches.length}`);
  console.log(`  No standards exist for subject/band (structural gap): ${noStandards.length}`);
  console.log(`  Has real candidates, keyword found nothing (needs AI): ${needsAi.length}`);

  const noStandardsBySubject = new Map<string, number>();
  for (const r of noStandards) noStandardsBySubject.set(r.subject, (noStandardsBySubject.get(r.subject) ?? 0) + 1);
  console.log(`\n  No-standards-exist breakdown by subject:`);
  for (const [subj, n] of [...noStandardsBySubject.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${subj.padEnd(24)} ${n}`);
  }

  // Text length distribution (whole candidate set)
  const allLengths = results.map((r) => r.textLength).sort((a, b) => a - b);
  const mean = allLengths.reduce((a, b) => a + b, 0) / (allLengths.length || 1);
  console.log(`\n=== MATCHABLE-TEXT-LENGTH DISTRIBUTION (all ${allLengths.length} candidates) ===`);
  console.log(`  min=${allLengths[0]}  p10=${percentile(allLengths, 0.1)}  p25=${percentile(allLengths, 0.25)}  median=${percentile(allLengths, 0.5)}  p75=${percentile(allLengths, 0.75)}  p90=${percentile(allLengths, 0.9)}  max=${allLengths[allLengths.length - 1]}  mean=${mean.toFixed(0)}`);
  const thinCount = allLengths.filter((l) => l < THIN_THRESHOLD).length;
  console.log(`  Below ${THIN_THRESHOLD} chars ("thin/template-stub" threshold): ${thinCount} (${((thinCount / allLengths.length) * 100).toFixed(1)}%)`);

  // Text length specifically within the needs_ai_fallback bucket (the "why empty" question)
  const needsAiLengths = needsAi.map((r) => r.textLength).sort((a, b) => a - b);
  const needsAiThin = needsAiLengths.filter((l) => l < THIN_THRESHOLD).length;
  console.log(`\n  Within "needs AI fallback" bucket (${needsAi.length} rows, has real candidates but keyword found nothing):`);
  console.log(`    min=${needsAiLengths[0] ?? 0}  median=${percentile(needsAiLengths, 0.5)}  p90=${percentile(needsAiLengths, 0.9)}  max=${needsAiLengths[needsAiLengths.length - 1] ?? 0}`);
  console.log(`    Below ${THIN_THRESHOLD} chars: ${needsAiThin} (${needsAi.length > 0 ? ((needsAiThin / needsAi.length) * 100).toFixed(1) : "0"}%)`);

  // Sampled AI fallback (real calls, no persist) to project a genuine total
  console.log(`\n=== SAMPLED AI-FALLBACK PROJECTION (real routedCompletion calls, dry - no persist) ===`);
  const { routedCompletion } = await import("../lib/ai/routedCompletion");
  const { buildPrompt } = await import("../lib/ai/promptRegistry");

  const bySubject = new Map<string, typeof needsAi>();
  for (const r of needsAi) {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, []);
    bySubject.get(r.subject)!.push(r);
  }

  type SampleOutcome = { contentId: string; textLength: number; aiMatched: boolean };
  const sampleResults: SampleOutcome[] = [];

  for (const [subject, rows] of bySubject.entries()) {
    const sampleSize = Math.min(AI_SAMPLE_PER_SUBJECT, rows.length);
    // deterministic spread sample rather than random, for reproducibility
    const step = Math.max(1, Math.floor(rows.length / sampleSize));
    const sample = rows.filter((_, i) => i % step === 0).slice(0, sampleSize);

    console.log(`  Sampling ${sample.length}/${rows.length} for subject=${subject}...`);
    for (const r of sample) {
      const full = candidates.find((c) => c.contentId === r.contentId)!;
      const subjectKey = SUBJECT_MAP[full.subject.toLowerCase()];
      const band = gradeToBand(full.grade);
      const candStandards = standardsByKey.get(`${subjectKey}::${band}`) ?? [];
      const lessonText = extractLessonText(full.payload);
      const candidateList = candStandards.map((c) => `${c.code}: ${c.description}`).join("\n");

      try {
        const completion = await routedCompletion({
          messages: [
            { role: "system", content: buildPrompt("moe.alignment.system") },
            { role: "user", content: buildPrompt("moe.alignment.user", { lessonText: lessonText.slice(0, 1500), candidateList }) },
          ],
          maxTokens: 300,
        });
        const raw = completion.content ?? "[]";
        let matchedCodes: string[] = [];
        try { matchedCodes = JSON.parse(raw); } catch { matchedCodes = []; }
        const genuine = matchedCodes.filter((code) => candStandards.some((c) => c.code === code));
        sampleResults.push({ contentId: r.contentId, textLength: r.textLength, aiMatched: genuine.length > 0 });
      } catch (err: any) {
        console.log(`    [error on ${r.contentId}]: ${err?.message ?? err}`);
        sampleResults.push({ contentId: r.contentId, textLength: r.textLength, aiMatched: false });
      }
      await new Promise((res) => setTimeout(res, 150));
    }
  }

  const aiHits = sampleResults.filter((s) => s.aiMatched);
  const aiHitRate = sampleResults.length > 0 ? aiHits.length / sampleResults.length : 0;
  console.log(`\n  Sample size: ${sampleResults.length} / ${needsAi.length} eligible rows`);
  console.log(`  AI-fallback hit rate in sample: ${aiHits.length}/${sampleResults.length} = ${(aiHitRate * 100).toFixed(1)}%`);

  const aiHitsThin = aiHits.filter((s) => s.textLength < THIN_THRESHOLD).length;
  const aiMissesThin = sampleResults.filter((s) => !s.aiMatched && s.textLength < THIN_THRESHOLD).length;
  const aiMissesNotThin = sampleResults.filter((s) => !s.aiMatched && s.textLength >= THIN_THRESHOLD).length;
  console.log(`  Of AI hits: ${aiHitsThin}/${aiHits.length} were thin-text (<${THIN_THRESHOLD} chars) -- AI can succeed on short text`);
  console.log(`  Of AI misses: ${aiMissesThin} thin-text, ${aiMissesNotThin} NOT thin (had real length, still no genuine match)`);

  const projectedAiMatches = Math.round(aiHitRate * needsAi.length);
  const exactMatches = keywordMatches.length;
  const projectedTotalMatches = exactMatches + projectedAiMatches;

  console.log(`\n=== FINAL PROJECTION ===`);
  console.log(`  Rows processed: ${candidates.length}`);
  console.log(`  Exact genuine matches (keyword, no projection needed): ${exactMatches}`);
  console.log(`  Projected additional genuine matches from AI fallback (rate ${(aiHitRate * 100).toFixed(1)}% applied to ${needsAi.length} eligible rows): ~${projectedAiMatches}`);
  console.log(`  PROJECTED TOTAL genuine matches: ~${projectedTotalMatches} / ${candidates.length} = ${((projectedTotalMatches / candidates.length) * 100).toFixed(2)}%`);
  console.log(`  Structural (no standards for subject, unfixable by this backfill): ${noStandards.length} / ${candidates.length} = ${((noStandards.length / candidates.length) * 100).toFixed(2)}%`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
