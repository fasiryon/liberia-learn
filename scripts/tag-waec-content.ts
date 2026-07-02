/**
 * scripts/tag-waec-content.ts — PHASE 5A Foundation (D2)
 *
 * Tags Grade 9+ CurriculumContent with WAEC syllabus topic ids
 * (CurriculumContent.waecSyllabusTopics) using lib/waec/syllabus.ts.
 *
 * Strategy:
 *   1. Deterministic keyword match on title + payload text (default, free, fast).
 *   2. Optional LLM fallback (--llm) via routedCompletion() for lessons the
 *      deterministic pass leaves untagged — picks from the subject's topic list only.
 *
 * Idempotent: skips already-tagged lessons unless --requeue. --dry-run reports only.
 *
 * Run (prod):
 *   npx dotenv -e .env.production -- npx tsx scripts/tag-waec-content.ts --limit 500
 *   npx dotenv -e .env.production -- npx tsx scripts/tag-waec-content.ts --llm --requeue --subjects waec_physics
 */
import { prisma } from "@/lib/db";
import {
  contentSubjectToWaec,
  deterministicTopics,
  getWaecSubject,
  isKnownTopic,
  type WaecSubject,
  type WaecSubjectId,
} from "@/lib/waec/syllabus";

const APPROVED = ["accepted", "published", "APPROVED"];

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=")[1];
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) {
    return process.argv[idx + 1];
  }
  return undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/** Collect string leaf values from arbitrary payload JSON, capped, for keyword matching. */
function payloadText(payload: unknown, cap = 6000): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (parts.join(" ").length > cap) return;
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(payload);
  return parts.join(" ").slice(0, cap);
}

async function llmTopics(
  subject: WaecSubject,
  title: string,
  snippet: string,
  contentId: string
): Promise<string[]> {
  const { routedCompletion } = await import("@/lib/ai/routedCompletion");
  const topicList = subject.topics.map((t) => `- ${t.id}: ${t.name}`).join("\n");
  const system =
    "You classify a secondary-school lesson against a fixed WAEC syllabus topic list. " +
    "Return ONLY a JSON object {\"topics\": [\"<topic id>\", ...]} using ids from the list. " +
    "Pick 1-2 best-fitting topics. If none fit, return an empty array.";
  const user = `WAEC subject: ${subject.name}\nAllowed topic ids:\n${topicList}\n\nLesson title: ${title}\nLesson excerpt: ${snippet.slice(0, 1200)}`;
  const res = await routedCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    responseFormat: "json",
    maxTokens: 120,
    aiUsage: {
      route: "scripts/tag-waec-content",
      feature: "curriculum",
      requestType: "waec_topic_classification",
      contentId,
      subject: subject.id,
    },
  });
  try {
    const parsed = JSON.parse(res.content);
    const topics: unknown = parsed?.topics ?? parsed;
    if (Array.isArray(topics)) {
      return topics.filter((t): t is string => typeof t === "string" && isKnownTopic(t));
    }
  } catch {
    /* ignore malformed */
  }
  return [];
}

async function main() {
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;
  const dryRun = hasFlag("dry-run");
  const useLlm = hasFlag("llm");
  const requeue = hasFlag("requeue");
  const subjectFilter = arg("subjects")?.split(",").map((s) => s.trim()) ?? null;

  const rows = await prisma.curriculumContent.findMany({
    where: { status: { in: APPROVED }, grade: { gte: 9 } },
    select: { id: true, contentId: true, subject: true, grade: true, title: true, payload: true, waecSyllabusTopics: true },
    orderBy: { grade: "asc" },
  });

  // Only content whose subject maps to a WAEC subject
  const candidates = rows
    .map((r) => ({ row: r, waec: contentSubjectToWaec(r.subject) }))
    .filter((x): x is { row: (typeof rows)[number]; waec: WaecSubject } => !!x.waec)
    .filter((x) => !subjectFilter || subjectFilter.includes(x.waec.id) || subjectFilter.includes(x.row.subject.toUpperCase()));

  const work = (requeue ? candidates : candidates.filter((c) => c.row.waecSyllabusTopics.length === 0));
  const sliced = limit ? work.slice(0, limit) : work;

  console.log(
    `G9+ WAEC-subject lessons: ${candidates.length} | to process (${requeue ? "requeue" : "untagged"}${limit ? `, limit ${limit}` : ""}): ${sliced.length} | LLM: ${useLlm} | dryRun: ${dryRun}`
  );

  const perContentSubject: Record<string, { tagged: number; untagged: number }> = {};
  const topicDist: Record<string, number> = {};
  let updated = 0;
  let llmUsed = 0;

  for (const { row, waec } of sliced) {
    const csKey = row.subject.toUpperCase();
    perContentSubject[csKey] ??= { tagged: 0, untagged: 0 };

    const text = payloadText(row.payload);
    let topics = deterministicTopics({ contentSubject: row.subject, title: row.title, text });

    if (topics.length === 0 && useLlm) {
      topics = await llmTopics(waec, row.title ?? row.contentId, text, row.contentId);
      if (topics.length > 0) llmUsed++;
    }

    topics = Array.from(new Set(topics));

    if (topics.length > 0) perContentSubject[csKey].tagged++;
    else perContentSubject[csKey].untagged++;
    for (const t of topics) topicDist[t] = (topicDist[t] ?? 0) + 1;

    const changed = JSON.stringify([...topics].sort()) !== JSON.stringify([...row.waecSyllabusTopics].sort());
    if (topics.length > 0 && changed && !dryRun) {
      await prisma.curriculumContent.update({
        where: { id: row.id },
        data: { waecSyllabusTopics: topics },
      });
      updated++;
    }
  }

  console.log("\n=== RESULT ===");
  console.log(`Updated rows: ${updated} | LLM classifications used: ${llmUsed}`);
  console.log("\nPer content subject (tagged / untagged):");
  for (const [k, v] of Object.entries(perContentSubject).sort()) {
    console.log(`  ${k.padEnd(14)} tagged=${v.tagged}  untagged=${v.untagged}`);
  }
  console.log("\nTopic distribution:");
  for (const [k, v] of Object.entries(topicDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(34)} ${v}`);
  }

  // Coverage-by-WAEC-subject summary (for the <20 lessons gate)
  const bySubject: Record<string, number> = {};
  const allTagged = await prisma.curriculumContent.findMany({
    where: { status: { in: APPROVED }, grade: { gte: 9 }, NOT: { waecSyllabusTopics: { isEmpty: true } } },
    select: { subject: true },
  });
  for (const r of allTagged) {
    const w = contentSubjectToWaec(r.subject);
    if (w) bySubject[w.id] = (bySubject[w.id] ?? 0) + 1;
  }
  console.log("\nTagged lessons per WAEC subject (cumulative in DB):");
  for (const id of ["waec_math", "waec_english", "waec_physics", "waec_chemistry", "waec_biology", "waec_literature", "waec_geography"] as WaecSubjectId[]) {
    const n = bySubject[id] ?? 0;
    const flag = n < 20 ? "  ⚠ <20" : "";
    console.log(`  ${(getWaecSubject(id)?.name ?? id).padEnd(30)} ${n}${flag}`);
  }
}

main()
  .catch((e) => {
    console.error("TAGGING ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
