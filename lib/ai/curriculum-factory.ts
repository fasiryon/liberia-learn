// lib/ai/curriculum-factory.ts
import { routedCompletion } from "@/lib/ai/router";
import { getSystemPrompt } from "@/lib/ai/promptRegistry";
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
    if (format === "either") return 3600;
    if (format === "block") return 2200;
    return 1400;
  }
  if (contentType === "full_pack") return 3000;
  if (contentType === "term_plan") return 1800;
  return 1000;
}

function getGenerationMaxTokens(
  format: "standard" | "block" | "either",
  contentType: string
): number {
  if (contentType !== "lesson") return 2500;
  if (format === "either") return 9000;
  if (format === "block") return 4000;
  return 3000;
}

function buildLessonBodyPrompt(format: "standard" | "block" | "either"): string {
  const standardTemplate = `
- body_standard must contain AT LEAST 15 clearly labeled ## sections for a 45-minute lesson.
  Use these exact slide types in order (add more concept/example/practice slides as needed):
  ## 1. Welcome and Hook
  Engaging hook question or story using Liberian context (market, farm, river, county).
  ## 2. Learning Objective
  Include explicit "Learning Objective:" label. State what students will know and be able to do.
  ## 3. Prior Knowledge Check
  2-3 warm-up questions or a quick recall task linking to what students already know.
  ## 4. Concept Introduction
  Include explicit "Introduction:" label. Explain the core concept clearly and completely.
  ## 5. Key Vocabulary
  Define all key terms with simple explanations and one example sentence each.
  ## 6. Worked Example 1
  Complete step-by-step solution. Name every step. Use Liberian context.
  ## 7. Worked Example 2
  Second worked example with a different scenario. Show full solution.
  ## 8. Common Mistakes to Avoid
  List 2-3 frequent errors students make and how to correct them.
  ## 9. Guided Practice - Problem 1
  Teacher-led problem with full solution. Include teacher prompts.
  ## 10. Guided Practice - Problem 2
  Teacher-led problem with full solution. Include teacher prompts.
  ## 11. Guided Practice - Problem 3
  Teacher-led problem with full solution. Include common error check.
  ## 12. Independent Practice - Easy
  2 straightforward problems. Include answer key.
  ## 13. Independent Practice - Medium
  2 medium-difficulty problems. Include answer key.
  ## 14. Independent Practice - Challenge
  1 challenge problem with a worked answer for teacher reference.
  ## 15. Assessment and Exit Ticket
  Include explicit "Assessment:" label. 2 exit ticket questions students complete before leaving.
  Summary of key concepts learned today.
  Preview of what comes next.`;

  const blockTemplate = `
- body_block must contain AT LEAST 18 clearly labeled ## sections for a 90-minute block lesson.
  Use these exact slide types in order (add more as needed to reach 18+):
  ## 1. Welcome and Hook
  Engaging hook using Liberian context.
  ## 2. Learning Objective
  Include explicit "Learning Objective:" label. State both knowledge and skill outcomes.
  ## 3. Prior Knowledge Check
  3-4 warm-up questions linking to previous learning.
  ## 4. Concept Introduction — Part 1
  Include explicit "Introduction:" label. First part of the concept explanation.
  ## 5. Concept Introduction — Part 2
  Second part of the concept, building on Part 1.
  ## 6. Key Vocabulary
  Define all key terms with explanations and example sentences.
  ## 7. Worked Example 1
  Complete step-by-step solution with Liberian context.
  ## 8. Worked Example 2
  Second worked example — different scenario, full solution shown.
  ## 9. Worked Example 3
  Third worked example — increasing complexity, full solution shown.
  ## 10. Common Mistakes to Avoid
  3-4 frequent errors with correct approaches.
  ## 11. Guided Practice - Problem 1
  Teacher-led with full solution and teacher notes.
  ## 12. Guided Practice - Problem 2
  Teacher-led with full solution and teacher notes.
  ## 13. Guided Practice - Problem 3
  Teacher-led with full solution.
  ## 14. Lab or Investigation Activity
  Hands-on activity or investigation. Include procedure, materials, and expected outcome.
  ## 15. Group Discussion
  Discussion prompt connecting to real Liberian context or current events.
  ## 16. Independent Practice — Easy and Medium
  Include the phrase "Independent Practice". 4 problems (2 easy, 2 medium) with answer key.
  ## 17. Independent Practice — Challenge and Extension
  2 challenge problems and 1 extension task. Include worked answers for teacher.
  ## 18. Assessment, Exit Ticket, and Reflection
  Include explicit "Assessment:" label. 2-3 exit ticket questions.
  Lesson summary and preview of next lesson.`;

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

function buildDepthPrompt(format: "standard" | "block" | "either"): string {
  const forbiddenClause = `
- NEVER insert placeholder text. If you cannot fill a section, generate real content instead.
  FORBIDDEN phrases (will cause automatic rejection): "Pause for student explanation", "Add content here",
  "Insert example", "placeholder", "TODO", "TBD", "[content]", "[insert", "lorem ipsum",
  "add your", "fill in", "write here", "example here", "content goes here".`;

  if (format === "standard") {
    return `
- body and body_standard must each be at least 1500 words (15+ ## sections, each with 60+ words).
- Each ## section must contain full teacher-ready content — not headings with empty bodies.
- Every worked example must show the complete step-by-step solution.
- Every practice section must include an answer key.${forbiddenClause}`;
  }

  if (format === "block") {
    return `
- body and body_block must each be at least 2200 words (18+ ## sections, each with 80+ words).
- Each ## section must contain full teacher-ready content — not headings with empty bodies.
- Every worked example must show the complete step-by-step solution.
- Every practice section must include an answer key.
- The lab/activity section must include procedure steps, materials, and expected results.${forbiddenClause}`;
  }

  return `
- body_standard must be at least 1500 words (15+ ## sections for grades 1–6, each 60+ words).
- body_block must be at least 2200 words (18+ ## sections for grades 7–12, each 80+ words).
- body must match body_standard for compatibility.
- Both versions must be fully developed, not abbreviated summaries.
- Every worked example, practice problem, and assessment must include complete answers.${forbiddenClause}`;
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
- Every lab observationForm must include at least 2 fields.
- Every lab analysisQuestions must include at least 2 questions.
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
  const depthPrompt = buildDepthPrompt(lessonFormat);
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

  const systemPrompt = `${getSystemPrompt("lesson.deep")}
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
${depthPrompt}
${lessonBodyHint}`;

  const userPrompt = `Generate a ${lessonFormat} format ${input.subject} lesson for Grade ${input.grade} on the topic: "${input.topic}". Keep the content classroom-ready and teachable.`;

  const result = await routedCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: getGenerationMaxTokens(lessonFormat, input.contentType ?? "lesson"),
    forceSmartTier: input.forceSmartTier ?? true,
    aiUsage: {
      route: "curriculum.factory.generate",
      feature: "curriculum",
      subject: input.subject,
      strandKey: input.moeAlignmentCodes?.[0] ?? "curriculum",
      requestType: "elite_curriculum_generation",
      promptKey: "lesson.deep",
      metadata: {
        grade: input.grade,
        contentType: input.contentType ?? "lesson",
        lessonFormat,
      },
    },
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
