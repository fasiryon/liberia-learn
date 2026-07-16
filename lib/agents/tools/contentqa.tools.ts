/**
 * Sprint 6.2: Content QA agent tools. All five are read-mostly or
 * advisory-write only — none of these tools change a lesson's publish
 * state, a video's approval state, or an existing student grade. See
 * lib/agents/prompts/content-qa.md for the policy that decides when each
 * is called.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { enqueueEscalation, type EscalationPriority } from "@/lib/agents/escalation";
import { createInboxNotification } from "@/lib/notifications/inboxService";
import { DEFAULT_RUBRIC } from "@/lib/grading/gradeEssay";
import { alignContentToMOE } from "@/lib/moe/alignment-engine";
import type { ToolDefinition } from "@/lib/agents/types";

const SUBMISSION_TYPES = ["lesson", "video", "essay", "code"] as const;
type SubmissionType = (typeof SUBMISSION_TYPES)[number];

async function findAdminForSchool(schoolId: string): Promise<string | null> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", schoolId }, select: { id: true } });
  return admin?.id ?? null;
}

// ─── contentqa.getSubmission ────────────────────────────────────────────────

const getSubmissionInput = z.object({
  submissionId: z.string(),
  submissionType: z.enum(SUBMISSION_TYPES),
});
const getSubmissionOutput = z.object({
  submissionId: z.string(),
  submissionType: z.enum(SUBMISSION_TYPES),
  title: z.string().nullable(),
  bodyText: z.string().nullable(),
  grade: z.number().nullable(),
  subject: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
});

/**
 * Loads a submission for review. `submissionId` is the natural identifier
 * for each type — CurriculumContent.contentId for lessons (carry-forward
 * rule: contentId in URLs, not the internal cuid), LessonVideo.id for
 * video, GradedSubmission.id for essay/code.
 */
export const contentqaGetSubmissionTool: ToolDefinition<
  z.infer<typeof getSubmissionInput>,
  z.infer<typeof getSubmissionOutput>
> = {
  name: "contentqa.getSubmission",
  description: "Load a lesson, video, essay, or code submission for review.",
  domain: "system",
  inputSchema: getSubmissionInput,
  outputSchema: getSubmissionOutput,
  auditTag: "agent.tool.contentqa.getSubmission",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input) => {
    if (input.submissionType === "lesson") {
      const lesson = await prisma.curriculumContent.findUnique({ where: { contentId: input.submissionId } });
      if (!lesson) throw new Error(`Lesson ${input.submissionId} not found`);
      const payload = lesson.payload as { body?: string } | null;
      return {
        submissionId: input.submissionId,
        submissionType: "lesson",
        title: lesson.title,
        bodyText: payload?.body ?? null,
        grade: lesson.grade,
        subject: lesson.subject,
        metadata: {
          schoolId: lesson.schoolId,
          editReviewStatus: lesson.editReviewStatus,
          waecSyllabusTopics: lesson.waecSyllabusTopics,
        },
      };
    }

    if (input.submissionType === "video") {
      const video = await prisma.lessonVideo.findUnique({
        where: { id: input.submissionId },
        include: { lesson: { select: { grade: true, subject: true } } },
      });
      if (!video) throw new Error(`Video ${input.submissionId} not found`);
      return {
        submissionId: input.submissionId,
        submissionType: "video",
        title: video.title,
        bodyText: video.description ?? null,
        grade: video.lesson?.grade ?? null,
        subject: video.lesson?.subject ?? null,
        metadata: {
          schoolId: video.schoolId,
          durationSeconds: video.durationSeconds,
          status: video.status,
          hasTranscript: false, // no transcription pipeline exists yet — see prompt
        },
      };
    }

    // essay | code
    const submission = await prisma.gradedSubmission.findUnique({
      where: { id: input.submissionId },
      include: { student: { select: { user: { select: { schoolId: true } } } } },
    });
    if (!submission) throw new Error(`Submission ${input.submissionId} not found`);
    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId: submission.lessonId },
      select: { grade: true, subject: true },
    });
    return {
      submissionId: input.submissionId,
      submissionType: input.submissionType,
      title: null,
      bodyText: submission.submissionText,
      grade: lesson?.grade ?? null,
      subject: lesson?.subject ?? null,
      metadata: {
        schoolId: submission.student.user.schoolId,
        exerciseType: submission.exerciseType,
        existingScore: submission.score,
        existingFeedback: submission.feedback,
        existingRubricBreakdown: submission.rubricBreakdown,
        status: submission.status,
      },
    };
  },
};
registerTool(contentqaGetSubmissionTool);

// ─── contentqa.getRubric ─────────────────────────────────────────────────────

const getRubricInput = z.object({
  subject: z.string(),
  gradeLevel: z.number(),
  submissionType: z.enum(SUBMISSION_TYPES),
});
const getRubricOutput = z.object({
  submissionType: z.enum(SUBMISSION_TYPES),
  criteria: z.array(z.object({ key: z.string(), label: z.string(), weight: z.number() })),
  source: z.string(),
});

/**
 * Essay criteria reuse the platform's existing WAEC-aligned rubric
 * (lib/grading/gradeEssay.DEFAULT_RUBRIC) verbatim — this tool does not
 * define its own essay rubric. Lesson/video/code QA criteria are new
 * (Deliverable 0 investigation confirmed no equivalent existed) and are
 * intentionally small.
 */
const LESSON_QUALITY_CRITERIA = [
  { key: "grade_appropriateness", label: "Grade-appropriate language and difficulty", weight: 0.3 },
  { key: "factual_accuracy", label: "Factual and safety accuracy", weight: 0.35 },
  { key: "curriculum_alignment", label: "Alignment to MOE curriculum standards", weight: 0.35 },
];
const VIDEO_METADATA_CRITERIA = [
  { key: "topic_match", label: "Title/description match claimed lesson topic", weight: 0.5 },
  { key: "grade_match", label: "Title/description consistent with claimed grade level", weight: 0.5 },
];
const CODE_QA_CRITERIA = [
  { key: "feedback_quality", label: "Auto-generated feedback is accurate and actionable", weight: 0.5 },
  { key: "pattern_concern", label: "Code shows no pattern warranting teacher attention", weight: 0.5 },
];

export const contentqaGetRubricTool: ToolDefinition<
  z.infer<typeof getRubricInput>,
  z.infer<typeof getRubricOutput>
> = {
  name: "contentqa.getRubric",
  description: "Get the grading/QA rubric criteria for a submission type.",
  domain: "system",
  inputSchema: getRubricInput,
  outputSchema: getRubricOutput,
  auditTag: "agent.tool.contentqa.getRubric",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async (input) => {
    if (input.submissionType === "essay") {
      return {
        submissionType: "essay",
        criteria: DEFAULT_RUBRIC.criteria,
        source: "lib/grading/gradeEssay.DEFAULT_RUBRIC",
      };
    }
    if (input.submissionType === "lesson") {
      return { submissionType: "lesson", criteria: LESSON_QUALITY_CRITERIA, source: "contentqa.tools (Sprint 6.2, new)" };
    }
    if (input.submissionType === "video") {
      return { submissionType: "video", criteria: VIDEO_METADATA_CRITERIA, source: "contentqa.tools (Sprint 6.2, new)" };
    }
    return { submissionType: "code", criteria: CODE_QA_CRITERIA, source: "contentqa.tools (Sprint 6.2, new)" };
  },
};
registerTool(contentqaGetRubricTool);

// ─── contentqa.flagForReview ─────────────────────────────────────────────────

const flagForReviewInput = z.object({
  submissionId: z.string(),
  submissionType: z.enum(SUBMISSION_TYPES),
  reason: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  confidence: z.number().min(0).max(1),
});
const flagForReviewOutput = z.object({ flagId: z.string() });

/**
 * Routes into whichever human-review surface already exists for the
 * submission type — never a new queue. Lesson -> /admin/content-review
 * (Wave 4). Video -> /admin/videos (Wave 3F). Essay/code -> EscalationQueue
 * (Sprint 6.0), already surfaced at /admin/agents ("Escalations" tab,
 * lib/agents/admin/escalations.ts) — that page was missed during this
 * sprint's initial investigation and almost got a duplicate built beside
 * it; corrected before shipping. NOTE: that existing panel has no tenant
 * (schoolId) scoping at all — a pre-existing gap, out of scope here, but
 * flagged in the Sprint 6.2 report.
 */
export const contentqaFlagForReviewTool: ToolDefinition<
  z.infer<typeof flagForReviewInput>,
  z.infer<typeof flagForReviewOutput>
> = {
  name: "contentqa.flagForReview",
  description: "Flag a submission for human review with a reason and severity.",
  domain: "system",
  inputSchema: flagForReviewInput,
  outputSchema: flagForReviewOutput,
  auditTag: "agent.tool.contentqa.flagForReview",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input, ctx) => {
    const review = await prisma.contentQaReview.create({
      data: {
        agentName: ctx.agentName,
        submissionId: input.submissionId,
        submissionType: input.submissionType,
        confidence: input.confidence,
        feedback: input.reason,
        status: "PENDING_TEACHER_REVIEW",
      },
    });

    if (input.submissionType === "lesson") {
      const lesson = await prisma.curriculumContent.findUnique({
        where: { contentId: input.submissionId },
        select: { schoolId: true, title: true },
      });
      if (lesson?.schoolId) {
        const adminId = await findAdminForSchool(lesson.schoolId);
        if (adminId) {
          await createInboxNotification(adminId, {
            title: "Content QA flagged a lesson",
            body: `"${lesson.title ?? "A lesson"}" was flagged by automated review: ${input.reason}`,
            url: "/admin/content-review",
            type: "content_qa",
          });
        }
      }
    } else if (input.submissionType === "video") {
      const video = await prisma.lessonVideo.findUnique({
        where: { id: input.submissionId },
        select: { schoolId: true, title: true },
      });
      if (video?.schoolId) {
        const adminId = await findAdminForSchool(video.schoolId);
        if (adminId) {
          await createInboxNotification(adminId, {
            title: "Content QA flagged a video",
            body: `"${video.title}" was flagged by automated review: ${input.reason}`,
            url: "/admin/videos",
            type: "content_qa",
          });
        }
      }
    } else {
      const submission = await prisma.gradedSubmission.findUnique({
        where: { id: input.submissionId },
        select: { student: { select: { user: { select: { schoolId: true } } } } },
      });
      const schoolId = submission?.student.user.schoolId ?? null;
      await enqueueEscalation({
        agentName: ctx.agentName,
        userId: null,
        reason: `content-qa: ${input.reason} (submissionId=${input.submissionId}, type=${input.submissionType})`,
        priority: input.severity as EscalationPriority,
        traceId: ctx.traceId ?? null,
        schoolId,
      });
    }

    return { flagId: review.id };
  },
};
registerTool(contentqaFlagForReviewTool);

// ─── contentqa.writeAdvisoryGrade ────────────────────────────────────────────

const writeAdvisoryGradeInput = z.object({
  submissionId: z.string(),
  submissionType: z.enum(SUBMISSION_TYPES),
  // Nullable: video review has no numeric score, only a metadata assessment.
  score: z.number().nullable(),
  feedback: z.string(),
  confidence: z.number().min(0).max(1),
  rubricUsed: z.string().optional(),
});
const writeAdvisoryGradeOutput = z.object({ gradeId: z.string() });

/**
 * Writes ONLY to ContentQaReview, a brand-new table with no relation to
 * GradedSubmission/AssignmentSubmission/CurriculumContent's existing grade
 * or status fields (Escalation Point 1). Never touches the authoritative
 * score a student/teacher already sees — this is a parallel, purely
 * advisory record, always PENDING_TEACHER_REVIEW until a human acts on it.
 */
export const contentqaWriteAdvisoryGradeTool: ToolDefinition<
  z.infer<typeof writeAdvisoryGradeInput>,
  z.infer<typeof writeAdvisoryGradeOutput>
> = {
  name: "contentqa.writeAdvisoryGrade",
  description: "Record an advisory QA assessment for a submission. Never final, never overwrites an existing grade.",
  domain: "system",
  inputSchema: writeAdvisoryGradeInput,
  outputSchema: writeAdvisoryGradeOutput,
  auditTag: "agent.tool.contentqa.writeAdvisoryGrade",
  estimatedCostUnits: 1,
  requiresAuth: ["system"],
  handler: async (input, ctx) => {
    const review = await prisma.contentQaReview.create({
      data: {
        agentName: ctx.agentName,
        submissionId: input.submissionId,
        submissionType: input.submissionType,
        score: input.score,
        confidence: input.confidence,
        feedback: input.feedback,
        rubricUsed: input.rubricUsed ?? null,
        status: "PENDING_TEACHER_REVIEW",
      },
    });
    return { gradeId: review.id };
  },
};
registerTool(contentqaWriteAdvisoryGradeTool);

// ─── contentqa.matchAgainstCurriculum ────────────────────────────────────────

const matchAgainstCurriculumInput = z.object({ contentId: z.string() });
const matchAgainstCurriculumOutput = z.object({
  alignmentScore: z.number(),
  matchedStandards: z.array(z.string()),
  gaps: z.array(z.string()),
});

const CONFIDENCE_WEIGHT: Record<"high" | "medium" | "low", number> = { high: 1, medium: 0.6, low: 0.3 };

/**
 * Reuses lib/moe/alignment-engine.ts's alignContentToMOE verbatim — the
 * same engine that already powers MOE standards tagging elsewhere in the
 * platform. Takes contentId (not raw content/subject/gradeLevel as the
 * sprint spec's tool sketch suggested) because alignContentToMOE already
 * derives subject/grade/band from the stored CurriculumContent row; passing
 * duplicate raw fields here would risk them drifting out of sync with what
 * is actually stored.
 */
export const contentqaMatchAgainstCurriculumTool: ToolDefinition<
  z.infer<typeof matchAgainstCurriculumInput>,
  z.infer<typeof matchAgainstCurriculumOutput>
> = {
  name: "contentqa.matchAgainstCurriculum",
  description: "Check a lesson's alignment against MOE curriculum standards.",
  domain: "system",
  inputSchema: matchAgainstCurriculumInput,
  outputSchema: matchAgainstCurriculumOutput,
  auditTag: "agent.tool.contentqa.matchAgainstCurriculum",
  estimatedCostUnits: 2,
  requiresAuth: ["system"],
  handler: async (input) => {
    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId: input.contentId },
      select: { id: true },
    });
    if (!lesson) throw new Error(`Lesson ${input.contentId} not found`);

    const result = await alignContentToMOE(lesson.id);
    const matchedStandards = result.standards.map((s) => s.code);
    const gaps = result.standards.length === 0 ? ["No MOE standards matched for this grade band/subject."] : [];
    const alignmentScore =
      result.standards.length === 0
        ? 0
        : result.standards.reduce((sum, s) => sum + CONFIDENCE_WEIGHT[s.confidence], 0) / result.standards.length;

    return { alignmentScore, matchedStandards, gaps };
  },
};
registerTool(contentqaMatchAgainstCurriculumTool);
