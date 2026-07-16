/**
 * Content QA sweep (Sprint 6.2). Finds newly-submitted lesson content,
 * teacher video uploads, and freshly-graded essay/code submissions that
 * have not yet had a content-qa pass, and invokes the agent once per item.
 * Mirrors lib/agents/opsSentinel/sweep.ts's shape: a cron-driven scan, not
 * a per-submission webhook — invoked by app/api/cron/content-qa-sweep.
 *
 * Video is special-cased (Escalation Point 3, approved design): the
 * deterministic safeguarding keyword gate (lib/agents/safeguarding/
 * keywordGate.ts, the same one Sprint 6.1 runs on guardian SMS) runs
 * against the video's title+description BEFORE the LLM is ever invoked. A
 * match escalates directly and skips the LLM call entirely, exactly
 * mirroring lib/agents/sms/guardianInbound.ts's bypass. This is on top of,
 * not instead of, the LLM's own soft-signal judgment inside the agent loop
 * for videos that pass the keyword gate — see prompts/content-qa.md.
 */
import { prisma } from "@/lib/db";
import { runAgent } from "@/lib/agents/runtime";
import { detectSafeguardingKeywords } from "@/lib/agents/safeguarding/keywordGate";
import { notifySchoolSafeguarding } from "@/lib/agents/safeguarding/notify";
import { enqueueEscalation } from "@/lib/agents/escalation";
import { logger } from "@/lib/logger";

const BATCH_SIZE_PER_TYPE = 10;

export interface SweepItemResult {
  submissionId: string;
  submissionType: "lesson" | "video" | "essay" | "code";
  outcome: "reviewed" | "safeguarding_escalated" | "invoke_failed";
  invocationId?: string | null;
}

export interface ContentQaSweepResult {
  ranAt: string;
  items: SweepItemResult[];
}

async function alreadyReviewed(submissionId: string): Promise<boolean> {
  const existing = await prisma.contentQaReview.findFirst({
    where: { submissionId },
    select: { id: true },
  });
  return existing !== null;
}

function buildInstruction(submissionId: string, submissionType: string): string {
  return [
    "Review this submission.",
    `submissionId: ${submissionId}`,
    `submissionType: ${submissionType}`,
    "Call contentqa.getSubmission first to load it, then follow the per-type handling in your instructions.",
  ].join("\n");
}

async function reviewOne(submissionId: string, submissionType: "lesson" | "video" | "essay" | "code"): Promise<SweepItemResult> {
  try {
    const result = await runAgent("content-qa", buildInstruction(submissionId, submissionType), {
      userRole: "system",
      triggeredBy: "SCHEDULE",
    });
    return { submissionId, submissionType, outcome: "reviewed", invocationId: result.invocationId };
  } catch (e) {
    logger.warn("[content-qa.sweep] invocation failed", {
      submissionId,
      submissionType,
      message: e instanceof Error ? e.message : String(e),
    });
    return { submissionId, submissionType, outcome: "invoke_failed" };
  }
}

async function escalateVideoOnKeywordMatch(video: {
  id: string;
  title: string;
  description: string | null;
  schoolId: string | null;
}): Promise<SweepItemResult> {
  await prisma.contentQaReview.create({
    data: {
      agentName: "content-qa",
      submissionId: video.id,
      submissionType: "video",
      confidence: 1,
      feedback: "Deterministic safeguarding keyword match on title/description — escalated automatically, LLM review skipped.",
      status: "PENDING_TEACHER_REVIEW",
    },
  });

  const { id: escalationId } = await enqueueEscalation({
    agentName: "content-qa",
    reason: `safeguarding (keyword gate): possible concern in video upload (videoId=${video.id})`,
    priority: "HIGH",
    schoolId: video.schoolId,
  });

  if (video.schoolId) {
    await notifySchoolSafeguarding(video.schoolId, `Teacher video upload flagged for safeguarding review (escalation ${escalationId}).`);
  } else {
    logger.warn("[content-qa.sweep] safeguarding escalation has no resolvable schoolId - school not notified", {
      videoId: video.id,
      escalationId,
    });
  }

  return { submissionId: video.id, submissionType: "video", outcome: "safeguarding_escalated" };
}

export async function runContentQaSweep(): Promise<ContentQaSweepResult> {
  const items: SweepItemResult[] = [];

  // Matches app/api/admin/content-review's own filter exactly, so content-qa
  // only reviews items that are actually visible in that queue.
  const lessons = await prisma.curriculumContent.findMany({
    where: { editReviewStatus: "PENDING", editedById: { not: null } },
    select: { contentId: true },
    take: BATCH_SIZE_PER_TYPE * 3, // over-fetch since some will already be reviewed
    orderBy: { createdAt: "desc" },
  });
  for (const lesson of lessons) {
    if (items.filter((i) => i.submissionType === "lesson").length >= BATCH_SIZE_PER_TYPE) break;
    if (await alreadyReviewed(lesson.contentId)) continue;
    items.push(await reviewOne(lesson.contentId, "lesson"));
  }

  const videos = await prisma.lessonVideo.findMany({
    where: { status: "PENDING" },
    select: { id: true, title: true, description: true, schoolId: true },
    take: BATCH_SIZE_PER_TYPE * 3,
    orderBy: { uploadedAt: "desc" },
  });
  for (const video of videos) {
    if (items.filter((i) => i.submissionType === "video").length >= BATCH_SIZE_PER_TYPE) break;
    if (await alreadyReviewed(video.id)) continue;
    const text = `${video.title} ${video.description ?? ""}`;
    if (detectSafeguardingKeywords(text)) {
      items.push(await escalateVideoOnKeywordMatch(video));
    } else {
      items.push(await reviewOne(video.id, "video"));
    }
  }

  const graded = await prisma.gradedSubmission.findMany({
    where: { status: "graded" },
    select: { id: true, exerciseType: true },
    take: BATCH_SIZE_PER_TYPE * 3,
    orderBy: { createdAt: "desc" },
  });
  for (const submission of graded) {
    const type = submission.exerciseType === "code" ? "code" : "essay";
    if (items.filter((i) => i.submissionType === type).length >= BATCH_SIZE_PER_TYPE) break;
    if (await alreadyReviewed(submission.id)) continue;
    items.push(await reviewOne(submission.id, type));
  }

  return { ranAt: new Date().toISOString(), items };
}
