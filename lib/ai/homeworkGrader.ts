import { routedCompletion } from "@/lib/ai/routedCompletion";
import { moderateText } from "@/lib/agents/moderation";
import { enqueueEscalation } from "@/lib/agents/escalation";

export type HomeworkGradeResult = {
  grade: number;
  feedback: string;
  rationale: string;
  perQuestionFeedback: string[];
};

const SYSTEM_PROMPT = `You are an expert homework grader for Liberia's Ministry of Education.
Grade this student submission against the assignment instructions.

Return ONLY valid JSON:
{
  "grade": number (0-100),
  "feedback": "string (2-3 sentences for student, encouraging but honest)",
  "rationale": "string (1 sentence for teacher, explaining the grade)",
  "perQuestionFeedback": ["string (one entry per question if identifiable)"]
}

Grading criteria:
- Accuracy: Does the student demonstrate understanding of the concept? (50%)
- Effort: Is the work complete and thoughtful? (30%)
- Expression: Is the answer clearly written? (20%)

Be fair, encouraging, and specific. Reference Liberian context where relevant.`;

const MODERATION_BLOCKED_RESULT: HomeworkGradeResult = {
  grade: 50,
  feedback: "Your submission has been received. A teacher will review it shortly.",
  rationale: "AI grading was blocked by the safety moderation check and needs manual review.",
  perQuestionFeedback: [],
};

export async function gradeHomework(
  submission: { content: string | null },
  assignment: { title: string; description: string | null },
): Promise<HomeworkGradeResult> {
  const content = submission.content?.trim() ?? "";

  const inputVerdict = await moderateText(content, "input");
  if (inputVerdict.verdict === "UNSAFE") {
    await enqueueEscalation({
      agentName: "lib.ai.homeworkGrader",
      reason: `Assignment submission flagged unsafe on input moderation (assignment: ${assignment.title}).`,
      priority: "HIGH",
    });
    return MODERATION_BLOCKED_RESULT;
  }

  const instructions = assignment.description?.trim() ?? "Complete the assignment as instructed.";

  const userMessage = `Assignment: ${assignment.title}
Instructions: ${instructions}

Student Submission:
${content}`;

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  async function callAndParse() {
    const result = await routedCompletion({
      messages,
      maxTokens: 600,
      responseFormat: "json",
      aiUsage: {
        route: "lib/ai/homeworkGrader",
        feature: "grading",
        requestType: "homework_grade",
      },
    });
    const parsed = JSON.parse(result.content) as {
      grade?: unknown;
      feedback?: unknown;
      rationale?: unknown;
      perQuestionFeedback?: unknown;
    };
    const grade = typeof parsed.grade === "number" ? Math.min(100, Math.max(0, Math.round(parsed.grade))) : 50;
    const feedback = typeof parsed.feedback === "string" ? parsed.feedback.slice(0, 1000) : "Good effort on this submission.";
    const rationale = typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 500) : "AI graded based on accuracy, effort, and expression.";
    const perQuestionFeedback = Array.isArray(parsed.perQuestionFeedback)
      ? (parsed.perQuestionFeedback as unknown[]).filter((f) => typeof f === "string") as string[]
      : [];
    return { grade, feedback, rationale, perQuestionFeedback };
  }

  try {
    const graded = await callAndParse();
    const feedbackText = [graded.feedback, graded.rationale, ...graded.perQuestionFeedback].join("\n");
    const outputVerdict = await moderateText(feedbackText, "output");
    if (outputVerdict.verdict === "UNSAFE") {
      messages.push(
        { role: "user", content: JSON.stringify(graded) },
        {
          role: "user",
          content:
            "Your previous response was flagged as inappropriate for a K-12 audience. Provide a safe, age-appropriate response.",
        }
      );
      try {
        const retried = await callAndParse();
        const retriedText = [retried.feedback, retried.rationale, ...retried.perQuestionFeedback].join("\n");
        const retryVerdict = await moderateText(retriedText, "output");
        if (retryVerdict.verdict === "UNSAFE") {
          throw new Error("still_unsafe_after_retry");
        }
        return retried;
      } catch {
        await enqueueEscalation({
          agentName: "lib.ai.homeworkGrader",
          reason: `Assignment grading output flagged unsafe twice for a K-12 audience (assignment: ${assignment.title}).`,
          priority: "HIGH",
        });
        return MODERATION_BLOCKED_RESULT;
      }
    }
    return graded;
  } catch {
    return {
      grade: 50,
      feedback: "Your submission has been received. A teacher will review it shortly.",
      rationale: "AI grading encountered an issue — teacher review required.",
      perQuestionFeedback: [],
    };
  }
}
