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
    if (format === "either") return 6000;
    if (format === "block") return 5000;
    return 3500;
  }
  if (contentType === "full_pack") return 4000;
  if (contentType === "term_plan") return 2000;
  return 1500;
}

function getGenerationMaxTokens(
  format: "standard" | "block" | "either",
  contentType: string
): number {
  if (contentType !== "lesson") return 3000;
  if (format === "either") return 14000;
  if (format === "block") return 12000;
  return 10000;
}

function buildLessonBodyPrompt(format: "standard" | "block" | "either"): string {
  const contentMandate = `
═══ CONTENT MANDATE — READ BEFORE WRITING ANY SECTION ═══
Every ## section below must contain ACTUAL INSTRUCTIONAL TEXT — the exact words a student reads on screen.
If a section description says "write a worked example", you write the full problem, every arithmetic step, every label, and the final answer.
If it says "write 3 practice problems", you write the full problem text for each, then the complete answers.
A section that describes what should be taught (rather than teaching it) will cause AUTOMATIC REJECTION.
Target minimum: 150 words per section in standard format; 200 words per section in block format.
═════════════════════════════════════════════════════════`;

  const standardTemplate = `
- body_standard must contain AT LEAST 17 clearly labeled ## sections for a 45-minute lesson.
  Follow this sequence exactly (add extra concept/example slides as needed to reach depth):

  ## 1. Hook — The Real-World Challenge (150+ words)
  Open with a vivid, concrete scenario from Liberian life that creates genuine curiosity about the topic.
  Write the full story or situation — do not describe it. Include a question that makes students want to know the answer.
  Example of correct format: "Boima works at Waterside Market in Monrovia. On Monday he sold 847 bags of cassava. On Tuesday he sold 593 bags. His boss needs to know the total — but there is no calculator. Boima needs to add these numbers in his head. How can he do it without making a mistake? Today you will learn a method that makes this fast and reliable."

  ## 2. Learning Objectives (100+ words)
  Include explicit "Learning Objective:" label.
  Write 3 specific, measurable objectives using action verbs (calculate, explain, identify, apply, compare, prove).
  Then write 2–3 sentences explaining WHY this skill matters for real life in Liberia AND for future careers or education.

  ## 3. Prior Knowledge Activation (150+ words)
  Write 3 warm-up problems or recall questions, fully stated. Number them 1, 2, 3.
  After each question, write the complete answer on a new line starting with "Answer:".
  These must connect directly to the concepts students need for today's lesson.

  ## 4. Core Concept — Concrete Foundation (200+ words)
  Include explicit "Introduction:" label.
  Begin with the most tangible, visual form of the concept using a physical Liberian context (counting objects, measuring distances, grouping items).
  Write the full explanation as if speaking to the student directly.
  Show one complete concrete example with specific Liberian numbers, names, and places.
  Define every new term the moment it appears.

  ## 5. Core Concept — The Rule and Why It Works (150+ words)
  State the abstract rule, formula, or principle.
  Then immediately explain WHY it works — the logical reason or proof, written in plain language.
  Connect back to the concrete example from Section 4 and show how the abstract rule produces the same result.
  Ask: "Can you see why this always works?"

  ## 6. Key Vocabulary (150+ words)
  List every new term from this lesson.
  For each term: (a) give the definition in simple language, (b) write a full example sentence using the term in a Liberian context, (c) for Grade 7+, explain the root or etymology if it helps memory.

  ## 7. Worked Example 1 — Standard Method (200+ words)
  State the full problem. Then solve it completely, showing and labelling every single step.
  Use Liberian names, places, or currency (LD). Show all arithmetic — do not skip steps.
  After the solution, write: "What do you notice about this method?" and give the expected student observation.
  End with: "Try this yourself: [a similar practice problem, fully stated]"

  ## 8. Worked Example 2 — Alternative Method or Higher Complexity (200+ words)
  For Grade 4+: show the same problem type using a second method (visual, estimation, shortcut, or algebraic).
  Compare both methods: write "Method 1 took X steps. Method 2 took Y steps. Method 2 is faster when..."
  For Grade 1–3: present a new problem at slightly higher difficulty and solve it completely with every step shown.

  ## 9. Error Analysis — Learning from Mistakes (150+ words)
  Write the heading "Common Error:" and show a specific wrong answer or wrong working that students often produce.
  Explain precisely WHY this error happens (what misconception causes it).
  Show the correct working side-by-side.
  Write: "The key difference is: [one sentence explaining the correct reasoning]."
  Repeat for 2–3 distinct errors.

  ## 10. Guided Practice — Problem 1 (150+ words)
  State the problem fully. Write "Work through this together:" and solve every step with explanation.
  Include a teacher-student dialogue in brackets if it helps: [Teacher: "What do we do first?"] [Expected: "..."]

  ## 11. Guided Practice — Problem 2 (150+ words)
  State a new problem. Solve it completely with every step labelled.
  Slightly increase difficulty from Problem 1.

  ## 12. Guided Practice — Problem 3 (150+ words)
  State a problem that requires combining two ideas from this lesson.
  Solve it completely. After the solution, ask: "Why did we need both ideas to solve this one?"

  ## 13. Independent Practice — Tier 1 Foundational (100+ words)
  Write 2 problems that any student who attended class can solve.
  State each problem fully. Then write the answer key: "Answers: 1. [answer] 2. [answer]"

  ## 14. Independent Practice — Tier 2 Standard (120+ words)
  Write 2 problems at grade-level standard. State each fully. Include the answer key.

  ## 15. Independent Practice — Tier 3 Advanced (120+ words)
  Write 2 problems that require an extra step or combining knowledge. State each fully. Include the answer key.

  ## 16. Independent Practice — Tier 4 Challenge (150+ words)
  Write 1 problem that connects this lesson to another subject or to a real-world situation requiring analysis, not just calculation.
  This question should challenge even strong students. Write the full worked solution below.
  For Grade 7+: this should approach competition or pre-university level thinking.

  ## 17. Assessment, Exit Ticket, and Lesson Summary (150+ words)
  Include explicit "Assessment:" label.
  Write 2 exit ticket questions students answer before leaving. State them fully.
  Then write "Key Takeaways:" and list 4–5 bullet points summarising what was learned today.
  End with one sentence: "In the next lesson, we will..."`;

  const blockTemplate = `
- body_block must contain AT LEAST 20 clearly labeled ## sections for a 90-minute block lesson.
  Follow this sequence exactly (add extra slides to reach the required depth):

  ## 1. Hook — Opening Challenge (200+ words)
  Write a rich, engaging real-world scenario from Liberia that students can physically engage with.
  Pose a multi-part problem or puzzle that the lesson will solve. Tell the full story — do not describe it.
  Include a question that creates intellectual tension students want to resolve.

  ## 2. Learning Objectives (120+ words)
  Include explicit "Learning Objective:" label.
  Write 4 specific, measurable objectives. Then explain in 3–4 sentences why this skill matters for university entrance, careers, and Liberian national development.

  ## 3. Prior Knowledge Activation (200+ words)
  Write 4 warm-up problems, fully stated, with complete answers.
  Include one that connects to a lesson from the previous week to build long-term retention.

  ## 4. Concept Foundation — Concrete Stage (250+ words)
  Include explicit "Introduction:" label.
  Begin with the most visible, hands-on form of the concept.
  Write the full explanation with a detailed Liberian scenario. Show every step of reasoning.
  Define every new term on first use.

  ## 5. Concept Development — Representational Stage (200+ words)
  Build on Section 4 by moving from physical objects to diagrams, tables, number lines, or visual models.
  Describe the visual clearly in text (since students may read on phones without graphics).
  Show how the representation links the concrete object to the abstract rule.

  ## 6. Concept Mastery — Abstract Rule and Proof (200+ words)
  State the abstract rule or formula.
  Derive or justify it from the concrete and representational stages.
  Show WHY it works. Write: "This rule always works because..."
  Give a second justification using a different approach where possible.

  ## 7. Key Vocabulary and Language Precision (200+ words)
  Define every new term. For each: definition, Liberian example sentence, memory tip or root word.
  For Grade 7+: include the technical academic term AND explain how it connects to everyday language.

  ## 8. Worked Example 1 — Foundational (200+ words)
  State the problem fully. Solve it step-by-step with every line of working shown.
  Label each step. Use Liberian names/places/LD. End with a "Try it yourself" question.

  ## 9. Worked Example 2 — Standard with Method Comparison (250+ words)
  State a problem. Solve it using Method A (standard/formal). Then solve it using Method B (shortcut/visual/alternative).
  Compare: "Method A is more reliable when... Method B is faster when..."
  This develops the mathematical maturity to choose tools wisely.

  ## 10. Worked Example 3 — Advanced Application (250+ words)
  State a multi-step problem that applies this lesson's concept in a real Liberian context (trade, health, engineering, agriculture).
  Solve it completely. After the solution, ask: "What other real situations require this same mathematical thinking?"

  ## 11. Error Analysis — Misconception Dissection (200+ words)
  Present 3–4 worked errors (wrong student solutions).
  For each: state the error, diagnose the misconception, show the correct solution, write a one-sentence rule that prevents this error.
  Make this section feel like a detective exercise: "Where exactly did the reasoning break down?"

  ## 12. Guided Practice — Problem 1 (150+ words)
  Full problem statement. Complete step-by-step solution with every line of working.

  ## 13. Guided Practice — Problem 2 (150+ words)
  Full problem statement. Complete solution. Slightly higher complexity than Problem 1.

  ## 14. Guided Practice — Problem 3 (150+ words)
  Full problem statement requiring two or more ideas from today's lesson. Complete solution.

  ## 15. Investigation Activity (200+ words)
  State the investigation goal. List the materials (locally available in Liberia).
  Write numbered procedure steps — each step as a clear instruction.
  Write "Prediction:" — what students should observe or hypothesise before the activity.
  Write "What You Should Find:" — the actual expected result, explained with the lesson's concept.

  ## 16. Group Discussion and Cross-Curricular Connection (150+ words)
  Write the full discussion prompt. Then write 4–5 key points students should arrive at through discussion.
  Connect the lesson topic to another subject or to a real-world Liberian issue (social, economic, scientific, historical).

  ## 17. Independent Practice — Tiers 1 and 2 (150+ words)
  Write 4 problems: 2 Foundational, 2 Standard. State each fully. Include complete answer key.

  ## 18. Independent Practice — Tiers 3 and 4 (200+ words)
  Write 2 Advanced problems and 1 Challenge problem.
  The Challenge problem should require synthesis of multiple concepts and approach pre-university or competition level.
  Include fully worked answers for all three.

  ## 19. Critical Thinking Extension (150+ words)
  Write 1–2 open questions that do not have a single correct answer.
  These should require students to evaluate, compare, or argue.
  Example: "Is Method A or Method B better for a market seller who does mental math? Justify your answer."
  Write a model answer showing what strong reasoning looks like.

  ## 20. Assessment, Exit Ticket, and Lesson Summary (200+ words)
  Include explicit "Assessment:" label.
  Write 3 exit ticket questions. Then write "Key Takeaways:" with 5–6 bullet points.
  Write a "Connections" section linking today's lesson to a previous lesson and to a future topic.
  End with: "In the next lesson, we will..."`;

  if (format === "standard") {
    return `${contentMandate}
${standardTemplate}
- Set body to the same content as body_standard.`;
  }

  if (format === "block") {
    return `${contentMandate}
${blockTemplate}
- Set body to the same content as body_block.`;
  }

  return `${contentMandate}
${standardTemplate}

${blockTemplate}
- Generate both body_standard and body_block.
- Set body to the same content as body_standard for compatibility.`;
}

function buildDepthPrompt(format: "standard" | "block" | "either"): string {
  const forbiddenClause = `
- NEVER insert placeholder text. If you cannot fill a section, generate real content instead.
  FORBIDDEN phrases (automatic rejection): "Pause for student explanation", "Add content here",
  "Insert example", "placeholder", "TODO", "TBD", "[content]", "[insert", "lorem ipsum",
  "add your", "fill in", "write here", "example here", "content goes here",
  "model one complete example", "guide learners through", "students will explore",
  "walk students through", "present the concept", "include examples showing".`;

  if (format === "standard") {
    return `
- body and body_standard must each be at least 2,500 words (17+ ## sections, each with 120+ words).
- Every worked example section must contain the full problem statement AND every step of the solution shown.
- Every practice section must contain fully stated problems AND a complete answer key.
- Section 9 (Error Analysis) must contain at least 2 specific wrong answers with diagnosis and correction.
- The four-tier independent practice sections must contain actual problems — not descriptions of problems.${forbiddenClause}`;
  }

  if (format === "block") {
    return `
- body and body_block must each be at least 4,000 words (20+ ## sections, each with 150+ words).
- Every worked example section must show the full problem, every line of working, every label.
- Sections 9 and 11 (Worked Example 2 and Error Analysis) must show method comparisons and misconception diagnoses.
- Every practice section must contain fully stated problems with complete answer keys.
- The Investigation Activity must include materials list, numbered procedure, prediction, and expected result.
- The Critical Thinking Extension must include a model answer showing strong reasoning.${forbiddenClause}`;
  }

  return `
- body_standard must be at least 2,500 words (17+ ## sections, each with 120+ words).
- body_block must be at least 4,000 words (20+ ## sections, each with 150+ words).
- body must match body_standard for compatibility.
- Both versions must be fully developed with actual instructional text — not abbreviated summaries.
- Every worked example, practice problem, and assessment must show complete solutions.
- Error analysis sections must show actual wrong answers, not generic descriptions of mistakes.${forbiddenClause}`;
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
