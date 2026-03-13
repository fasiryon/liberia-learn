// lib/ai/curriculum-factory.ts
import { routedCompletion } from "@/lib/ai/router";
import {
  CurriculumPayloadSchema,
  GenerateInputSchema,
  type CurriculumPayload,
  type GenerateInput,
} from "@/lib/schemas/curriculumPayload";
import { toneGuidance } from "@/lib/localization/tone-standardizer";
import { isDeliveryProfileEnabled } from "@/lib/serverFlags";

const VALID_TOOL_KEYS = [
  "basic-calculator",
  "scientific-calculator",
  "fraction-visualizer",
  "number-line",
  "digital-ruler",
  "protractor",
  "multiplication-table",
  "periodic-table",
  "unit-converter",
  "coordinate-grid",
  "timer",
  "dictionary",
];

function getLessonWordLimit(
  format: "standard" | "block" | "either",
  contentType: string
): number {
  if (contentType === "lesson") {
    if (format === "block") return 2200;
    return 1400;
  }
  if (contentType === "full_pack") return 3000;
  if (contentType === "term_plan") return 1800;
  return 1000;
}

function buildLessonBodyPrompt(format: "standard" | "block" | "either"): string {
  const standardTemplate = `
- body_standard must contain these clearly labeled sections for a 45-minute lesson:
  ## Opening (5 minutes)
  Hook question or scenario using Liberian context.
  Connect to prior knowledge.
  State today's learning objective clearly.

  ## Direct Instruction (15 minutes)
  Explain the concept clearly and completely.
  Use at least 2 worked examples with full step-by-step solutions shown.
  Reference Liberian context throughout (markets, rivers, farms, Liberian currency, county names, local names).
  Define all key vocabulary terms.

  ## Guided Practice (15 minutes)
  3-4 practice problems for teacher to work through with the class.
  Show full solutions for each.
  Include common mistakes to watch for.

  ## Independent Practice (8 minutes)
  4-5 problems for students to work alone.
  Vary difficulty (2 easy, 2 medium, 1 challenge).
  Include answer key.

  ## Closing (7 minutes)
  Summary of key concepts learned today.
  Exit ticket question (links to assessment).
  Preview of next lesson.`;

  const blockTemplate = `
- body_block must contain these clearly labeled sections for a 90-minute block lesson:
  ## Opening (5 minutes)
  Hook question or scenario using Liberian context.
  Connect to prior knowledge.
  State today's learning objective clearly.

  ## Direct Instruction (20 minutes)
  Explain the concept clearly and completely.
  Use at least 3 worked examples with full step-by-step solutions shown.
  Reference Liberian context throughout (markets, rivers, farms, Liberian currency, county names, local names).
  Define all key vocabulary terms.

  ## Guided Practice (20 minutes)
  5-6 practice problems for teacher-led class work.
  Show full solutions for each.
  Include common mistakes to watch for.

  ## Lab or Activity (25 minutes)
  Include a lab, investigation, or group project activity tied to the lesson objective.
  If no lab is appropriate, include an extended investigation or group project activity that is still teachable.

  ## Independent Work (15 minutes)
  6-8 problems with a wider difficulty range.
  Include answer key.

  ## Group Discussion (8 minutes)
  Discussion prompt connecting the lesson to real Liberian context or current events.

  ## Closing (7 minutes)
  Summary of key concepts learned today.
  Exit ticket question.
  Reflection question and preview of next lesson.`;

  if (format === "standard") {
    return `${standardTemplate}
- Set body to the same content as body_standard.`;
  }

  if (format === "block") {
    return `${blockTemplate}
- Set body to the same content as body_block.`;
  }

  return `${standardTemplate}

${blockTemplate}
- Generate both body_standard and body_block.
- Set body to the same content as body_standard for compatibility.`;
}

function shouldGenerateLabs(subject: string, grade: number): boolean {
  const normalized = subject.toUpperCase();

  if (normalized === "SCIENCE" || normalized === "COMPUTER_SCIENCE" || normalized === "ENGINEERING") {
    return true;
  }

  if (normalized === "MATH") {
    return grade >= 7;
  }

  if (normalized === "LITERACY") {
    return true;
  }

  return false;
}

function buildLabPrompt(subject: string, grade: number, lessonFormat: "standard" | "block" | "either"): string {
  const warrantsLabs = shouldGenerateLabs(subject, grade);
  const durationRange = lessonFormat === "block" ? "25-35" : "20-30";

  if (!warrantsLabs) {
    return `
- Include a "labs" field and set it to an empty array for ${subject} at Grade ${grade}.`;
  }

  return `
- Include a "labs" field in the JSON.
- Generate at least one lab object for ${subject} at Grade ${grade}.
- For rural schools with limited or no internet, the primary lab type should be "guided_walkthrough".
- You may add "2d_simulation" as an optional alternative. Only use "3d_environment" when a connected experience is pedagogically necessary.
- Every lab object must match this structure:
  {
    "title": string,
    "type": "guided_walkthrough" | "2d_simulation" | "3d_environment",
    "durationMinutes": number (${durationRange} minutes),
    "subject": string,
    "gradeLevel": number,
    "labObjective": string,
    "materialsNeeded": [string] using locally available materials in Liberia such as leaves, water, stones, local plants, paper, pencils, string, rulers, cups, buckets, notebooks, cassava leaves, bottle caps, or other basic household items,
    "safetyNotes": string | null,
    "procedure": [
      {
        "stepNumber": number,
        "instruction": string,
        "teacherNote": string | null,
        "durationMinutes": number
      }
    ],
    "observationForm": [
      {
        "field": string,
        "prompt": string,
        "inputType": "text" | "number" | "choice",
        "choices": [string] | null
      }
    ],
    "analysisQuestions": [
      {
        "question": string,
        "expectedAnswer": string,
        "scoringRubric": string
      }
    ],
    "connectionToLesson": string,
    "offlineCapable": boolean,
    "virtualAlternative": string | null
  }
- Every lab must include a real step-by-step procedure, a real observation form, and analysis questions.
- Use locally available Liberian materials. Avoid specialised imported equipment unless the virtualAlternative explains the substitute.
- For guided_walkthrough labs, set offlineCapable to true.`;
}

function buildDeliveryProfilePrompt(grade: number, subject: string): string {
  return `
Additionally, include a "deliveryProfile" field in the JSON with this structure:
{
  "estimatedMinutes": number,
  "recommendedFormat": "standard" | "block" | "either",
  "phases": [{ "name": string, "durationMinutes": number, "description": string }],
  "standardVersion": {
    "phases": [{ "name": string, "durationMinutes": number, "description": string }],
    "omittedActivities": [string]
  },
  "blockVersion": {
    "phases": [{ "name": string, "durationMinutes": number, "description": string }],
    "extensions": [string]
  },
  "splitPoint": { "afterPhase": string, "day2Opening": string } | null,
  "exitTicket": {
    "questions": [{ "question": string, "type": "mcq"|"short_answer", "standardCode": string, "choices": [string] }]
  },
  "toolsRequired": [{ "toolKey": string, "reason": string, "phase": string, "required": boolean }],
  "labComponent": { "title": string, "type": string, "phase": string, "durationMinutes": number, "objectives": [string] } | null
}

deliveryProfile rules:
- standardVersion compresses phases for a 45-minute period.
- blockVersion extends to a 90-minute block period.
- splitPoint ONLY included when estimatedMinutes > 60; otherwise omit.
- exitTicket must have 2–3 questions, each with a standardCode matching one of the moeAlignments codes.
- toolsRequired keys MUST be from this exact list: ${VALID_TOOL_KEYS.join(", ")}.
- labComponent included only when subject/topic warrants hands-on investigation (especially ${subject} at Grade ${grade}).
- omit labComponent (set to null) when it doesn't apply.`;
}

export async function generateCurriculumPayload(
  rawInput: GenerateInput
): Promise<CurriculumPayload> {
  const input = GenerateInputSchema.parse(rawInput);

  const moeHint = input.moeAlignmentCodes?.length
    ? `\nMOE alignment codes to reference: ${input.moeAlignmentCodes.join(", ")}`
    : "";

  const lessonFormat = input.lessonFormat ?? "standard";
  const wordLimit =
    input.maxWords ??
    getLessonWordLimit(lessonFormat, input.contentType ?? "lesson");
  const readingHint = input.readingLevel
    ? `\nTarget reading level: ${input.readingLevel}`
    : "";

  const liberiaHint = input.liberiaContext
    ? `\nUse Liberian context throughout — reference local markets, rivers (St. Paul, Farmington), farms, cassava, palm oil, Liberian dollars, county names, and Liberian student names.`
    : "";

  const toneHint = `\nTone and language guidance: ${toneGuidance(input.grade)}`;

  const deliveryProfileHint = isDeliveryProfileEnabled()
    ? buildDeliveryProfilePrompt(input.grade, input.subject)
    : "";

  const lessonBodyHint = buildLessonBodyPrompt(lessonFormat);
  const labPrompt = buildLabPrompt(input.subject, input.grade, lessonFormat);

  const baseJsonSchema = `{
  "title": "string (lesson title, min 3 chars)",
  "grade": number (1-12),
  "subject": "string (e.g. MATH, SCIENCE, LITERACY)",
  "lessonFormat": "standard" | "block" | "either",
  "objectives": ["string", "string"] (at least 1),
  "body": "string (primary lesson body, min 50 chars, up to ${wordLimit} words)",
  "body_standard": "string (45-minute standard lesson, required when format is standard or either)",
  "body_block": "string (90-minute block lesson, required when format is block or either)",
  "activities": ["string", "string"] (0 or more hands-on activities),
  "labs": [{
    "title": "string",
    "type": "guided_walkthrough | 2d_simulation | 3d_environment",
    "durationMinutes": "number",
    "subject": "string",
    "gradeLevel": "number",
    "labObjective": "string",
    "materialsNeeded": ["string"],
    "safetyNotes": "string | null",
    "procedure": [{
      "stepNumber": "number",
      "instruction": "string",
      "teacherNote": "string | null",
      "durationMinutes": "number"
    }],
    "observationForm": [{
      "field": "string",
      "prompt": "string",
      "inputType": "text | number | choice",
      "choices": ["string"] | null
    }],
    "analysisQuestions": [{
      "question": "string",
      "expectedAnswer": "string",
      "scoringRubric": "string"
    }],
    "connectionToLesson": "string",
    "offlineCapable": "boolean",
    "virtualAlternative": "string | null"
  }],
  "moeAlignments": ["string"] (MOE standard codes if applicable),
  "metadata": {
    "topic": "string",
    "locale": "LR",
    "generatedAt": "ISO datetime string"
  }
}`;

  const systemPrompt = `You are a curriculum content generator for LiberiaLearn, an educational platform for Liberian schools.
You MUST return ONLY a valid JSON object. No markdown, no backticks, no explanation, no extra keys.
The JSON must match this exact structure:

${baseJsonSchema}

Rules:
- Output ONLY valid JSON. Nothing else.
- Generate complete, detailed content for each section. Do not summarize or abbreviate.
- Each section must contain enough content for a teacher to actually teach from without any additional materials.
- body/body_standard/body_block must be detailed educational content suitable for a Grade ${input.grade} student.
- activities should be practical and doable in a Liberian classroom.${liberiaHint}${readingHint}${moeHint}${toneHint}${deliveryProfileHint}
${labPrompt}
${lessonBodyHint}`;

  const userPrompt = `Generate a ${lessonFormat} format ${input.subject} lesson for Grade ${input.grade} on the topic: "${input.topic}". Keep the content classroom-ready and teachable.`;

  const result = await routedCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 2500,
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
    lessonFormat,
    metadata: {
      ...((raw as any)?.metadata ?? {}),
      topic: input.topic,
      locale: "LR",
      generatedAt: new Date().toISOString(),
      model: result.model,
    },
  };

  const primaryBody =
    typeof (enriched as any).body === "string" && (enriched as any).body.trim().length > 0
      ? (enriched as any).body
      : lessonFormat === "block"
      ? (enriched as any).body_block
      : (enriched as any).body_standard ?? (enriched as any).body_block;

  if (typeof primaryBody === "string" && primaryBody.trim().length > 0) {
    (enriched as any).body = primaryBody;
  }

  if (lessonFormat === "standard" && !(enriched as any).body_standard && typeof (enriched as any).body === "string") {
    (enriched as any).body_standard = (enriched as any).body;
  }

  if (lessonFormat === "block" && !(enriched as any).body_block && typeof (enriched as any).body === "string") {
    (enriched as any).body_block = (enriched as any).body;
  }

  // When flag is OFF, strip deliveryProfile from output before validation
  if (!isDeliveryProfileEnabled()) {
    delete (enriched as any).deliveryProfile;
  }

  if (isDeliveryProfileEnabled()) {
    (enriched as any).deliveryProfile = {
      ...((enriched as any).deliveryProfile ?? {}),
      recommendedFormat:
        (enriched as any).deliveryProfile?.recommendedFormat ?? lessonFormat,
    };
  }

  const parsed = CurriculumPayloadSchema.safeParse(enriched);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(
      `AI output failed validation: ${issues}. First 200 chars: ${result.content.slice(0, 200)}`
    );
  }

  if (shouldGenerateLabs(parsed.data.subject, parsed.data.grade) && parsed.data.labs.length === 0) {
    throw new Error(
      `AI output failed validation: labs are required for ${parsed.data.subject} Grade ${parsed.data.grade}.`
    );
  }

  return parsed.data;
}
