/**
 * PHASE 4A — Batch lesson media generation.
 *
 * VISUAL   -> AI hero (+ inline) via Fal.ai Flux schnell, stored in private Blob.
 * PHOTO    -> curated Unsplash/Pexels (cost $0), CDN url + attribution; AI
 *             photorealistic fallback when no match.
 * ABSTRACT -> marked SKIPPED, no media.
 *
 * Budget: hard stop at $28 (of the $30 cap). Idempotent, sequential, telemetered.
 *
 * Usage:
 *   npx dotenv -e .env.production -e .env.local -- npx tsx scripts/generate-lesson-media.ts \
 *       --subjects SCIENCE,BIOLOGY --grades 4,5,6 --limit 50 [--heroes-only] [--dry-run] [--force]
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
function cleanEnv(k: string) {
  if (process.env[k]) process.env[k] = process.env[k]!.replace(/^["']|["']$/g, "");
}
cleanEnv("DATABASE_URL");

import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { categorizeLesson, gradeBand } from "@/lib/media/categorize";
import { curatePhoto } from "@/lib/media/photoCuration";
import { generateLessonIllustration } from "@/lib/media/generateIllustration";
import { planInlineIllustrations } from "@/lib/media/inlinePlan";
import { lessonMediaPath, uploadLessonImage } from "@/lib/media/blobStorage";
import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";
import type { HeroImageMeta, InlineIllustration } from "@/lib/media/types";

const APPROVED = ["published", "APPROVED"];
const HARD_STOP_USD = 28;
const SUBJECT_ABORT_MIN_ATTEMPTS = 10;
const SUBJECT_ABORT_REJECT_RATE = 0.7;
const REJECT_LOG = path.resolve(process.cwd(), "scripts/data/media-rejections.json");

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (p) return p.split("=").slice(1).join("=");
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const subjectsFilter = arg("subjects")?.split(",").map((s) => s.trim().toUpperCase());
const gradesFilter = arg("grades")?.split(",").map((g) => parseInt(g.trim(), 10));
const limit = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;
const dryRun = flag("dry-run");
const force = flag("force");
const heroesOnly = flag("heroes-only");

let spentUSD = 0;
let generated = 0;
let firstPassOk = 0;
let retryOk = 0;
let skippedBudget = 0;
const rejections: any[] = [];
const subjectStats: Record<string, { attempts: number; rejects: number; aborted: boolean }> = {};

function subjStat(s: string) {
  return (subjectStats[s] ??= { attempts: 0, rejects: 0, aborted: false });
}
function bodyOf(payload: any): string {
  return typeof payload?.body === "string" ? payload.body : payload?.body_standard || "";
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function persist(contentId: string, data: any) {
  if (dryRun) return;
  await prisma.curriculumContent.update({ where: { contentId }, data });
}

async function main() {
  console.log("\n=== PHASE 4A LESSON MEDIA BATCH ===");
  console.log({ subjectsFilter, gradesFilter, limit, dryRun, force, heroesOnly });

  const where: any = { status: { in: APPROVED } };
  if (subjectsFilter) where.subject = { in: subjectsFilter };
  if (gradesFilter) where.grade = { in: gradesFilter };
  if (!force) where.imageGenerationStatus = { in: ["PENDING", "FAILED"] };

  const lessons = await prisma.curriculumContent.findMany({
    where,
    select: { contentId: true, title: true, subject: true, grade: true, payload: true, waecSyllabusTopics: true },
    orderBy: [{ subject: "asc" }, { grade: "asc" }],
    ...(limit ? { take: limit } : {}),
  });
  console.log(`Candidates: ${lessons.length}\n`);

  for (const lesson of lessons) {
    if (spentUSD >= HARD_STOP_USD) {
      skippedBudget++;
      continue;
    }
    const category = categorizeLesson(lesson.subject, lesson.title);
    const band = gradeBand(lesson.grade);
    const stat = subjStat(lesson.subject);
    const start = new Date();

    // ABSTRACT -> skip
    if (category === "ABSTRACT") {
      await persist(lesson.contentId, { imageCategory: "ABSTRACT", imageGenerationStatus: "SKIPPED" });
      continue;
    }

    // Per-subject quality circuit breaker
    if (stat.aborted) {
      skippedBudget++;
      continue;
    }

    const altBase = `${lesson.title ?? "Lesson"} — ${lesson.subject.toLowerCase().replace(/_/g, " ")}`;

    try {
      if (category === "PHOTO") {
        const curated = await curatePhoto({
          title: lesson.title,
          subject: lesson.subject,
          topics: lesson.waecSyllabusTopics,
          altBase,
        });
        if (curated) {
          await persist(lesson.contentId, {
            heroImageUrl: curated.imageUrl,
            heroImageMeta: curated.meta as any,
            imageCategory: "PHOTO",
            imageGenerationStatus: "CURATED",
            imageGenerationCost: 0,
          });
          generated++;
          await logAssetGenerationTelemetry({
            provider: curated.provider, model: "curated", assetType: "lesson_hero_photo",
            tenantId: null, route: "script.generate-lesson-media", startTime: start, endTime: new Date(),
            success: true, estimatedCostUSD: 0, metadata: { contentId: lesson.contentId, category },
          });
          console.log(`  [PHOTO] ${lesson.subject} G${lesson.grade} "${(lesson.title ?? "").slice(0, 40)}" <- ${curated.provider}`);
          continue;
        }
        // fall through to AI photorealistic fallback
      }

      // VISUAL (or PHOTO fallback) -> generate hero
      const photoreal = category === "PHOTO";
      const hero = await generateLessonIllustration({
        subjectFocus: lesson.title ?? lesson.subject, subject: lesson.subject, band, photoreal,
      });
      stat.attempts++;
      spentUSD += hero.cost;

      if (!hero.ok) {
        stat.rejects++;
        rejections.push({ contentId: lesson.contentId, subject: lesson.subject, kind: "hero", reason: "reason" in hero ? hero.reason : "unknown" });
        await persist(lesson.contentId, { imageCategory: category, imageGenerationStatus: "FAILED", imageGenerationCost: hero.cost });
        maybeAbort(lesson.subject);
        continue;
      }
      if (hero.attempts === 1) firstPassOk++; else retryOk++;

      const heroPath = lessonMediaPath({ lessonId: lesson.contentId, kind: "hero", ext: "jpg" });
      const heroUrl = dryRun ? `dryrun://${heroPath}` : await uploadLessonImage({ path: heroPath, data: hero.bytes, contentType: hero.contentType });
      const heroMeta: HeroImageMeta = {
        alt: altBase, caption: null, provider: "fal", source: null,
        license: "AI-generated (Flux schnell)", credit: null, category,
      };

      // Inline (VISUAL only, unless --heroes-only)
      const inline: InlineIllustration[] = [];
      let lessonCost = hero.cost;
      if (category === "VISUAL" && !heroesOnly) {
        const specs = planInlineIllustrations({ title: lesson.title, body: bodyOf(lesson.payload) });
        for (const spec of specs) {
          if (spentUSD >= HARD_STOP_USD) break;
          const ill = await generateLessonIllustration({ subjectFocus: spec.subjectFocus, subject: lesson.subject, band, isDiagram: true });
          stat.attempts++;
          spentUSD += ill.cost;
          lessonCost += ill.cost;
          if (!ill.ok) {
            stat.rejects++;
            rejections.push({ contentId: lesson.contentId, subject: lesson.subject, kind: "inline", reason: "reason" in ill ? ill.reason : "unknown" });
            continue;
          }
          const p = lessonMediaPath({ lessonId: lesson.contentId, kind: "inline", index: inline.length, ext: "jpg" });
          const url = dryRun ? `dryrun://${p}` : await uploadLessonImage({ path: p, data: ill.bytes, contentType: ill.contentType });
          inline.push({ position: spec.position, url, alt: spec.subjectFocus, provider: "fal", license: "AI-generated (Flux schnell)" });
        }
      }

      await persist(lesson.contentId, {
        heroImageUrl: heroUrl, heroImageMeta: heroMeta as any,
        inlineIllustrations: inline.length ? (inline as any) : undefined,
        imageCategory: category, imageGenerationStatus: "GENERATED", imageGenerationCost: lessonCost,
      });
      generated++;
      await logAssetGenerationTelemetry({
        provider: "fal", model: "flux-schnell", assetType: "lesson_illustration",
        tenantId: null, route: "script.generate-lesson-media", startTime: start, endTime: new Date(),
        success: true, estimatedCostUSD: lessonCost, metadata: { contentId: lesson.contentId, category, inline: inline.length },
      });
      console.log(`  [${category}] ${lesson.subject} G${lesson.grade} "${(lesson.title ?? "").slice(0, 36)}" hero+${inline.length} inline  $${spentUSD.toFixed(3)}`);
    } catch (e: any) {
      rejections.push({ contentId: lesson.contentId, subject: lesson.subject, kind: "error", reason: e?.message });
      await persist(lesson.contentId, { imageCategory: category, imageGenerationStatus: "FAILED" });
    }

    if (generated > 0 && generated % 500 === 0) {
      console.log(`\n  --- Budget checkpoint: ${generated} lessons, $${spentUSD.toFixed(2)} spent ---\n`);
    }
    await sleep(250);
  }

  // rejection log
  if (rejections.length && !dryRun) {
    fs.mkdirSync(path.dirname(REJECT_LOG), { recursive: true });
    fs.writeFileSync(REJECT_LOG, JSON.stringify(rejections, null, 2));
  }

  console.log("\n=== SUMMARY ===");
  console.log({ generated, firstPassOk, retryOk, rejected: rejections.length, skippedBudget, spentUSD: Number(spentUSD.toFixed(3)) });
  console.log("Per-subject:", subjectStats);
  await prisma.$disconnect();
}

function maybeAbort(subject: string) {
  const s = subjStat(subject);
  if (s.attempts >= SUBJECT_ABORT_MIN_ATTEMPTS && s.rejects / s.attempts >= SUBJECT_ABORT_REJECT_RATE) {
    s.aborted = true;
    console.log(`\n  !! ABORTING subject ${subject}: ${s.rejects}/${s.attempts} rejected (quality too low)\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
