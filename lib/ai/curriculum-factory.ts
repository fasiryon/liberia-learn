// lib/ai/curriculum-factory.ts
import { routedCompletion } from "@/lib/ai/router";
import {
  CurriculumPayloadSchema,
  GenerateInputSchema,
  type CurriculumPayload,
  type GenerateInput,
} from "@/lib/schemas/curriculumPayload";

export async function generateCurriculumPayload(
  rawInput: GenerateInput
): Promise<CurriculumPayload> {
  const input = GenerateInputSchema.parse(rawInput);

  const moeHint = input.moeAlignmentCodes?.length
    ? `\nMOE alignment codes to reference: ${input.moeAlignmentCodes.join(", ")}`
    : "";

  const wordLimit = input.maxWords ?? 600;
  const readingHint = input.readingLevel
    ? `\nTarget reading level: ${input.readingLevel}`
    : "";

  const liberiaHint = input.liberiaContext
    ? `\nUse Liberian context throughout â€” reference local markets, rivers (St. Paul, Farmington), farms, cassava, palm oil, Liberian dollars, county names, and Liberian student names.`
    : "";

  const systemPrompt = `You are a curriculum content generator for LiberiaLearn, an educational platform for Liberian schools.
You MUST return ONLY a valid JSON object. No markdown, no backticks, no explanation, no extra keys.
The JSON must match this exact structure:

{
  "title": "string (lesson title, min 3 chars)",
  "grade": number (1-12),
  "subject": "string (e.g. MATH, SCIENCE, LITERACY)",
  "objectives": ["string", "string"] (at least 1),
  "body": "string (lesson content, min 50 chars, up to ${wordLimit} words)",
  "activities": ["string", "string"] (0 or more hands-on activities),
  "moeAlignments": ["string"] (MOE standard codes if applicable),
  "metadata": {
    "topic": "string",
    "locale": "LR",
    "generatedAt": "ISO datetime string"
  }
}

Rules:
- Output ONLY valid JSON. Nothing else.
- body must be detailed educational content suitable for a Grade ${input.grade} student.
- activities should be practical and doable in a Liberian classroom.${liberiaHint}${readingHint}${moeHint}`;

  const userPrompt = `Generate a ${input.subject} lesson for Grade ${input.grade} on the topic: "${input.topic}".`;

  const result = await routedCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 1500,
    forceSmartTier: true,
  });

  let raw: unknown;
  try {
    // Strip markdown fences if the model wraps in ```json
    let text = result.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      `AI returned invalid JSON. First 200 chars: ${result.content.slice(0, 200)}`
    );
  }

  // Inject metadata fields the model may have missed
  const enriched = {
    ...(raw as Record<string, unknown>),
    grade: input.grade,
    subject: input.subject,
    metadata: {
      ...((raw as any)?.metadata ?? {}),
      topic: input.topic,
      locale: "LR",
      generatedAt: new Date().toISOString(),
      model: result.model,
    },
  };

  const parsed = CurriculumPayloadSchema.safeParse(enriched);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(
      `AI output failed validation: ${issues}. First 200 chars: ${result.content.slice(0, 200)}`
    );
  }

  return parsed.data;
}

