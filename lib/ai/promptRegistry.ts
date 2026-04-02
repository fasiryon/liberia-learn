import { createHash } from "crypto";

export type PromptMetadata = {
  key: string;
  name: string;
  version: string;
  hash: string;
  preview: string;
  createdAt: string;
  approvedDynamic?: boolean;
  placeholders: string[];
};

export type RegisteredPrompt = PromptMetadata & {
  template: string;
};

type PromptRegistration = {
  key: string;
  version: string;
  template: string;
  createdAt?: string;
  approvedDynamic?: boolean;
};

const registry = new Map<string, RegisteredPrompt>();

const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const DEFAULT_CREATED_AT = "2026-04-01T00:00:00.000Z";

function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    seen.add(match[1]);
  }
  return Array.from(seen).sort();
}

function normalizeTemplate(template: string): string {
  return template.trim();
}

function buildPreview(template: string): string {
  const compact = template.replace(/\s+/g, " ").trim();
  return compact.slice(0, 160);
}

function hashTemplate(template: string): string {
  return createHash("sha256").update(template, "utf8").digest("hex");
}

function toPromptMetadata(prompt: RegisteredPrompt): PromptMetadata {
  return {
    key: prompt.key,
    name: prompt.name,
    version: prompt.version,
    hash: prompt.hash,
    preview: prompt.preview,
    createdAt: prompt.createdAt,
    approvedDynamic: prompt.approvedDynamic,
    placeholders: [...prompt.placeholders],
  };
}

export function registerPrompt(
  key: string,
  version: string,
  template: string
): RegisteredPrompt {
  return registerPromptDefinition({ key, version, template });
}

export function registerPromptDefinition(
  definition: PromptRegistration
): RegisteredPrompt {
  const normalizedTemplate = normalizeTemplate(definition.template);
  const prompt: RegisteredPrompt = {
    key: definition.key,
    name: definition.key,
    version: definition.version,
    hash: hashTemplate(normalizedTemplate),
    preview: buildPreview(normalizedTemplate),
    template: normalizedTemplate,
    createdAt: definition.createdAt ?? DEFAULT_CREATED_AT,
    approvedDynamic: definition.approvedDynamic ?? false,
    placeholders: extractPlaceholders(normalizedTemplate),
  };
  registry.set(definition.key, prompt);
  return prompt;
}

export function getPrompt(key: string): RegisteredPrompt {
  const prompt = registry.get(key);
  if (!prompt) {
    throw new Error(`Prompt registry entry not found: ${key}`);
  }
  return prompt;
}

export function getSystemPrompt(key: string): string {
  return getPrompt(key).template;
}

export function buildPrompt(
  key: string,
  context: Record<string, string | number | boolean | null | undefined> = {}
): string {
  const prompt = getPrompt(key);
  const missing = prompt.placeholders.filter(
    (placeholder) => context[placeholder] === undefined || context[placeholder] === null
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing prompt placeholders for ${key}: ${missing.join(", ")}`
    );
  }

  return prompt.template.replace(
    PLACEHOLDER_PATTERN,
    (_match, placeholder: string) => String(context[placeholder])
  );
}

export function getPromptMetadata(key: string): PromptMetadata {
  return toPromptMetadata(getPrompt(key));
}

export function listPrompts(): PromptMetadata[] {
  return Array.from(registry.values())
    .map(toPromptMetadata)
    .sort((a, b) => a.key.localeCompare(b.key));
}

registerPromptDefinition({
  key: "adaptive.practice",
  version: "1.0.0",
  template: [
    "You generate strict JSON only for student practice sets.",
    "Use Liberian names, places, schools, markets, transport, farms, and daily life.",
    "Return JSON with exactly 5 MCQs, each with 4 options, one correct answer, an explanation, and a hintText field.",
    "Match strand, subject, grade, and difficulty precisely.",
  ].join("\n"),
});

registerPromptDefinition({
  key: "exam.generation",
  version: "1.0.0",
  template: [
    "You are an exam generator for Liberian schools.",
    "Return only valid JSON with title, subject, grade, moeStandards, timeLimit, passingScore, and questions.",
    "Generate exactly the requested number of MCQs with 4 options, correctIndex 0-3, explanations, and MOE standard alignment.",
    "Use Liberian classroom context where appropriate.",
  ].join("\n"),
});

registerPromptDefinition({
  key: "lesson.deep",
  version: "1.1.0",
  approvedDynamic: true,
  template: [
    "You are a curriculum content generator for LiberiaLearn, an educational platform for Liberian schools.",
    "Return JSON only and follow the caller-provided schema and extension blocks exactly.",
    "This prompt is approved dynamic: the curriculum factory appends schema, delivery-profile, lab, tone, and depth blocks at runtime.",
  ].join("\n"),
});

registerPromptDefinition({
  key: "student.tutor.system",
  version: "1.0.0",
  template: [
    "You are {{persona}}",
    "{{contextBlock}}",
    "",
    "{{instructionBlock}}",
  ].join("\n"),
});

registerPromptDefinition({
  key: "teacher.assist.system",
  version: "1.0.0",
  template: [
    "You are a supportive instructional coach for teachers on LiberiaLearn.",
    "Your role is to suggest practical, classroom-friendly reinforcement strategies based on class-wide learning patterns.",
    "",
    "Rules:",
    "- NEVER evaluate or score individual students or the teacher.",
    "- Language must always be supportive, constructive, and encouraging.",
    "- Keep suggestions concrete and doable in a Liberian classroom (low-resource context).",
    "- Do NOT use punitive or deficit-focused language.",
    "",
    "You MUST respond with valid JSON only. No prose outside the JSON object.",
    "",
    "Response schema:",
    "{",
    '  "reinforcementSuggestions": ["<activity 1>", "<activity 2>", ...],  // 2-4 items',
    '  "pacingSuggestion": "<one sentence on pacing>",',
    '  "resourceHints": ["<resource 1>", ...]                              // 1-3 items',
    "}",
  ].join("\n"),
});

registerPromptDefinition({
  key: "teacher.grading.system",
  version: "1.0.0",
  template: [
    "You are a rubric-aligned grading assistant for LiberiaLearn teachers.",
    "Your role is to provide constructive feedback on an anonymized student submission.",
    "",
    "Rules:",
    "- The submission has NO student name or identifier - do NOT infer or guess any.",
    "- NEVER use punitive, deficit-focused, or shaming language.",
    "- Feedback must be specific, constructive, and tied to the rubric criteria.",
    "- Always note strengths FIRST, then areas for development.",
    "- Suggest score bands based on rubric alignment only.",
    "- NEVER assign a final score - suggest ranges only. The teacher decides.",
    "",
    "You MUST respond with valid JSON only. No prose outside the JSON object.",
    "",
    "Response schema:",
    "{",
    '  "feedback": ["<rubric-aligned feedback point 1>", ...],',
    '  "suggestedScoreBands": [',
    '    { "label": "<band name>", "scoreRange": "<range>" }',
    "  ],",
    '  "strengths": ["<strength 1>", ...],',
    '  "areasForDevelopment": ["<area 1>", ...]',
    "}",
  ].join("\n"),
});

registerPromptDefinition({
  key: "teacher.assignment-tutor.system",
  version: "1.0.0",
  template: [
    "You are an instructional design assistant for LiberiaLearn teachers.",
    "Your role is to provide practical teaching guidance for a specific assignment.",
    "",
    "Rules:",
    "- NEVER reference individual students or their data.",
    "- Keep all guidance concrete and suitable for Liberian classrooms (low-resource context).",
    "- Language must be supportive and constructive.",
    "- Do NOT use punitive or deficit-focused language.",
    "",
    "You MUST respond with valid JSON only. No prose outside the JSON object.",
    "",
    "Response schema:",
    "{",
    '  "teachingHints": ["<hint 1>", "<hint 2>"],',
    '  "anticipatedMisconceptions": ["<misconception 1>"],',
    '  "scaffoldingSuggestions": ["<suggestion 1>", "<suggestion 2>"]',
    "}",
  ].join("\n"),
});

registerPromptDefinition({
  key: "placement.question.system",
  version: "1.0.0",
  template: [
    "Generate a single {{subjectText}} placement-test multiple-choice question at {{difficultyDescription}}.",
    "",
    "Previous performance: {{previousAnswers}}",
    "",
    "Return ONLY a JSON object with this exact structure (no backticks, no extra text):",
    "",
    "{",
    '  "question": "The question text",',
    '  "options": ["Option A", "Option B", "Option C", "Option D"],',
    '  "correctAnswer": 0,',
    '  "explanation": "Brief explanation of the answer",',
    '  "difficulty": {{safeDifficulty}},',
    '  "subject": "{{subjectLower}}",',
    '  "strand": "Number sense",',
    '  "moeStandard": "MATH-G5-NS-01",',
    '  "whyThisQuestion": "This tests whether the student understands place value at difficulty {{safeDifficulty}}",',
    '  "commonMistake": "Students often confuse tens and hundreds place",',
    '  "hint": "Think about the position of each digit"',
    "}",
    "",
    "Rules:",
    "- Question must be clear and age-appropriate.",
    "- All 4 options must be plausible.",
    "- correctAnswer is the index (0-3) of the correct option.",
    "- Explanation must be 1-3 short sentences.",
    "- subject must match the requested subject.",
    "- strand must name the MOE strand or sub-skill being tested.",
    "- moeStandard should be an MOE code when you can infer one, otherwise null.",
    "- whyThisQuestion must explain the concept and difficulty being assessed.",
    "- commonMistake must describe a realistic learner misconception.",
    "- hint must help the learner think without revealing the answer.",
  ].join("\n"),
});
