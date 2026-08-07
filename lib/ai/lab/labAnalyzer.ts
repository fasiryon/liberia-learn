import { z } from "zod";
import { routedCompletion } from "@/lib/ai/router";
import { buildPrompt } from "@/lib/ai/promptRegistry";
import { moderateText } from "@/lib/agents/moderation";
import { enqueueEscalation } from "@/lib/agents/escalation";

const LabAnalysisSchema = z.object({
  suggestedScore: z.number().min(0).max(100),
  observationFeedback: z.string().min(10),
  conclusionFeedback: z.string().min(10),
  whatWentWell: z.array(z.string().min(3)).min(1),
  areasToImprove: z.array(z.string().min(3)).min(1),
  connectionToStandard: z.string().min(10),
  teacherNote: z.string().min(10),
});

export type LabAnalysis = z.infer<typeof LabAnalysisSchema>;

export type LabDefinition = {
  title: string;
  subject: string;
  gradeLevel: number;
  labObjective?: string;
  analysisQuestions?: Array<{ question: string; expectedAnswer?: string; scoringRubric?: string }>;
  connectionToLesson?: string;
};

function safeFallbackAnalysis(): LabAnalysis {
  return {
    suggestedScore: 0,
    observationFeedback: "We could not generate feedback for this observation right now. Please talk to your teacher.",
    conclusionFeedback: "We could not generate feedback for this conclusion right now. Please talk to your teacher.",
    whatWentWell: ["Your teacher will review this lab directly."],
    areasToImprove: ["Ask your teacher for feedback on this submission."],
    connectionToStandard: "Not available. Please ask your teacher.",
    teacherNote: "AI feedback was blocked by the safety moderation check and needs manual review.",
  };
}

function extractFeedbackText(analysis: LabAnalysis): string {
  return [
    analysis.observationFeedback,
    analysis.conclusionFeedback,
    ...analysis.whatWentWell,
    ...analysis.areasToImprove,
    analysis.connectionToStandard,
  ].join("\n");
}

export async function analyzeLabSession(params: {
  lab: LabDefinition;
  observations: Record<string, any>;
  conclusions: string;
  gradeLevel: number;
}): Promise<LabAnalysis> {
  const inputVerdict = await moderateText(params.conclusions, "input", { audience: "minor" });
  if (inputVerdict.verdict !== "SAFE") {
    await enqueueEscalation({
      agentName: "lib.ai.lab.labAnalyzer",
      reason: `Lab session conclusions flagged unsafe on input moderation (lab: ${params.lab.title}).`,
      priority: "HIGH",
    });
    return safeFallbackAnalysis();
  }

  const messages = [
    {
      role: "system" as const,
      content: buildPrompt("lab.analysis.system"),
    },
    {
      role: "user" as const,
      content: buildPrompt("lab.analysis.user", {
        payloadJson: JSON.stringify({
          lab: params.lab,
          observations: params.observations,
          conclusions: params.conclusions,
          gradeLevel: params.gradeLevel,
        }),
      }),
    },
  ];

  const result = await routedCompletion({
    forceSmartTier: true,
    maxTokens: 900,
    messages,
  });

  function parseAnalysis(raw: string): LabAnalysis {
    let text = raw.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new Error(`Lab analysis returned invalid JSON. First 200 chars: ${raw.slice(0, 200)}`);
    }
    return LabAnalysisSchema.parse(parsedJson);
  }

  let analysis = parseAnalysis(result.content);

  // Output moderation, same pattern as runtime.ts and groundedAnswerService:
  // one regeneration attempt with an explicit K-12 safety instruction, then
  // escalate and return a safe fallback if still unsafe on retry.
  const out1 = await moderateText(extractFeedbackText(analysis), "output", { audience: "minor" });
  if (out1.verdict !== "SAFE") {
    messages.push(
      { role: "user" as const, content: JSON.stringify(analysis) },
      {
        role: "user" as const,
        content:
          "Your previous response was flagged as inappropriate for a K-12 audience. Provide a safe, age-appropriate response.",
      }
    );
    try {
      const retryResult = await routedCompletion({ forceSmartTier: true, maxTokens: 900, messages });
      const retryAnalysis = parseAnalysis(retryResult.content);
      const out2 = await moderateText(extractFeedbackText(retryAnalysis), "output", { audience: "minor" });
      if (out2.verdict !== "SAFE") {
        throw new Error("still_unsafe_after_retry");
      }
      analysis = retryAnalysis;
    } catch {
      await enqueueEscalation({
        agentName: "lib.ai.lab.labAnalyzer",
        reason: `Lab session AI feedback flagged unsafe twice for a K-12 audience (lab: ${params.lab.title}).`,
        priority: "HIGH",
      });
      return safeFallbackAnalysis();
    }
  }

  return analysis;
}
