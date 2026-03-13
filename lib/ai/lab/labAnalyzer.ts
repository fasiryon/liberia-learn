import { z } from "zod";
import { routedCompletion } from "@/lib/ai/router";

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

export async function analyzeLabSession(params: {
  lab: LabDefinition;
  observations: Record<string, any>;
  conclusions: string;
  gradeLevel: number;
}): Promise<LabAnalysis> {
  const result = await routedCompletion({
    forceSmartTier: true,
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You are an education assessment specialist reviewing a student lab submission from a Liberian school. Assess the observations and conclusions fairly and constructively. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          lab: params.lab,
          observations: params.observations,
          conclusions: params.conclusions,
          gradeLevel: params.gradeLevel,
          outputSchema: {
            suggestedScore: "number 0-100",
            observationFeedback: "string",
            conclusionFeedback: "string",
            whatWentWell: ["string"],
            areasToImprove: ["string"],
            connectionToStandard: "string",
            teacherNote: "string",
          },
        }),
      },
    ],
  });

  let parsedJson: unknown;
  try {
    let text = result.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error(`Lab analysis returned invalid JSON. First 200 chars: ${result.content.slice(0, 200)}`);
  }

  return LabAnalysisSchema.parse(parsedJson);
}
