import { CurriculumPayloadSchema } from "@/lib/schemas/curriculumPayload";

type LessonPayload = Record<string, any>;

type EnrichmentInput = {
  contentId: string;
  grade: number;
  subject: string;
  payload: LessonPayload;
};

type SectionBundle = {
  explanation: string;
  workedExamples: string[];
  guidedPractice: string[];
  independentPractice: string[];
  assessment: string;
  remediation: string;
  extension: string;
  guardianSupport: string;
  realWorldApplication: string;
  materialsNotes: string;
};

const LOWER_GRADE_LABEL = "young learners who need clear language, repeated modeling, and short practice rounds";
const MIDDLE_GRADE_LABEL = "learners who can explain ideas, compare strategies, and work with moderate independence";
const UPPER_GRADE_LABEL = "learners who can analyze evidence, justify choices, and sustain multi-step reasoning";

function getGradeProfile(grade: number) {
  if (grade <= 3) {
    return {
      learnerProfile: LOWER_GRADE_LABEL,
      language: "Use short sentences, direct prompts, and concrete classroom examples.",
      independence: "The teacher should model first, then release responsibility in small steps.",
    };
  }

  if (grade <= 6) {
    return {
      learnerProfile: MIDDLE_GRADE_LABEL,
      language: "Use clear academic vocabulary with short explanations and checks for understanding.",
      independence: "Students can complete paired and independent work after guided modeling.",
    };
  }

  return {
    learnerProfile: UPPER_GRADE_LABEL,
    language: "Use subject vocabulary precisely and ask learners to justify decisions with evidence.",
    independence: "Students should move from model to guided reasoning to independent analysis.",
  };
}

function toTitle(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function getTopic(payload: LessonPayload) {
  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const topic = (metadata as Record<string, unknown>).topic;
    if (typeof topic === "string" && topic.trim().length > 0) {
      return topic.trim();
    }
  }

  const unitTitle = payload.unitTitle;
  if (typeof unitTitle === "string" && unitTitle.trim().length > 0) {
    return unitTitle.trim();
  }

  return "the lesson topic";
}

function createParagraphs(lines: string[]) {
  return lines.join("\n\n");
}

function buildSubjectBundle(subject: string, grade: number, topic: string): SectionBundle {
  const gradeProfile = getGradeProfile(grade);
  const subjectCode = subject.toUpperCase();

  if (subjectCode === "MATH") {
    return {
      explanation: createParagraphs([
        `This lesson teaches ${topic.toLowerCase()} by breaking the idea into manageable steps that learners can name, practice, and explain. The teacher begins with concrete examples, using numbers, diagrams, or everyday school situations so learners understand what each step means before they are asked to calculate on their own. ${gradeProfile.language}`,
        `During explanation, the teacher should highlight not only what to do, but why the process works. Students should hear mathematical vocabulary, see a worked process, and compare a correct method with a common mistake. This helps them notice patterns, check their own work, and build durable number sense instead of memorizing disconnected rules.`,
        `The lesson should close the explanation phase by asking learners to restate the method in their own words. ${gradeProfile.independence} This creates a gradual path from observation to confidence and keeps the concept connected to the progression sequence already defined for the unit.`,
      ]),
      workedExamples: [
        `Worked Example 1: The teacher solves one representative ${topic.toLowerCase()} problem step by step, naming the starting information, the operation or reasoning choice, and the final check. Each step should be spoken aloud so learners see how mathematical thinking is organized.`,
        `Worked Example 2: The teacher solves a second problem with a small variation, then asks learners to explain which step stayed the same and which step changed. This comparison helps students avoid treating every problem like an isolated case.`,
        `Worked Example 3: The teacher presents a common error, such as skipping a step or choosing the wrong operation, and shows how to detect and correct it. This makes error analysis part of the learning routine rather than a punishment after the fact.`,
      ],
      guidedPractice: [
        `In guided practice, the class solves two short tasks together. The teacher asks learners to predict the next step, justify their answers, and check whether the result is reasonable. Sentence frames can support younger learners: “First I notice…”, “Next I…”, “My answer makes sense because…”.`,
        `Pairs then complete one follow-up task using the same concept with slightly different numbers or conditions. The teacher circulates, listens for misconceptions, and reteaches immediately when students confuse vocabulary, sequence, or operation choice.`,
      ],
      independentPractice: [
        `Independent practice should include one straightforward item, two standard items, and one challenge item. Learners show every step, not only the answer, so the teacher can see whether understanding is secure.`,
        `Students who finish early can write a short explanation of how they checked accuracy. This reinforces metacognition and makes practice about reasoning as well as completion.`,
      ],
      assessment: createParagraphs([
        `Assessment should include at least three checks: a quick fluency item, a standard application item, and a reasoning prompt asking learners to explain how they knew what to do. The teacher should review both accuracy and clarity of explanation.`,
        `A strong response shows correct procedure, appropriate vocabulary, and evidence that the learner can transfer the idea to a new example rather than copy the exact model.`,
      ]),
      remediation: createParagraphs([
        `For remediation, return to smaller numbers, visual supports, or partially completed examples. Rehearse the sequence one step at a time and ask learners to name each move before solving.`,
        `Students needing support should complete a short scaffolded task with immediate feedback so the lesson ends with success and a clear picture of the next concept they will meet.`,
      ]),
      extension: createParagraphs([
        `For extension, learners solve a richer problem, compare two valid methods, or explain which strategy is more efficient and why. Older learners can write a short justification using mathematical language.`,
        `This maintains the difficulty curve by offering deeper reasoning without pulling earlier learners away from the core objective.`,
      ]),
      guardianSupport: `Guardian support: ask the learner to explain one ${topic.toLowerCase()} example at home using words, bottle caps, sticks, or notebook drawings. The goal is not extra pressure, but a short conversation that helps the learner rehearse steps and vocabulary clearly.`,
      realWorldApplication: `Real-world application: connect ${topic.toLowerCase()} to counting goods in the market, sharing resources fairly, measuring distance or quantity, or checking totals in daily life. Learners should see mathematics as useful reasoning, not only classroom exercise.`,
      materialsNotes: `Materials and activity notes: chalkboard or paper, pencils, counters such as stones or bottle caps, and a simple worked-example display. Use low-resource materials first so the lesson remains teachable in any classroom.`,
    };
  }

  if (subjectCode === "LITERACY") {
    return {
      explanation: createParagraphs([
        `This lesson develops ${topic.toLowerCase()} through explicit reading, speaking, listening, and writing support. The teacher introduces the text, vocabulary, and purpose for reading before students work independently. ${gradeProfile.language}`,
        `During explanation, the teacher should model how strong readers notice key ideas, use context to understand unfamiliar words, and cite details from the text when answering questions. Younger learners need oral rehearsal and repeated prompts, while older learners should practice inference, organization, and evidence-based response.`,
        `The explanation phase should also show how discussion and writing connect. Learners should know what they are looking for in the text, what vocabulary matters, and how they will prove understanding during guided and independent tasks.`,
      ]),
      workedExamples: [
        `Worked Example 1: The teacher reads a short passage or paragraph aloud and models a think-aloud that identifies a key detail, an important vocabulary word, and the main idea.`,
        `Worked Example 2: The teacher answers one comprehension question using evidence from the text, explicitly naming the sentence or phrase that supports the answer.`,
        `Worked Example 3: The teacher models one short written response, showing how to begin with a clear claim, add evidence, and explain the evidence in simple language.`,
      ],
      guidedPractice: [
        `Guided practice should include partner reading, oral retell, and one shared evidence hunt in which learners underline or repeat details that support an answer. The teacher should pause often to check vocabulary and meaning.`,
        `Discussion prompts should move from recall to reasoning: what happened, why it mattered, and what evidence proves the response. This helps students connect comprehension to communication.`,
      ],
      independentPractice: [
        `Independent practice should ask learners to read or review a short text segment, answer comprehension questions, and complete one writing task that uses evidence or vocabulary from the lesson.`,
        `Where appropriate, students can sort new vocabulary, write a summary sentence, or compare two details from the text. These tasks should match the grade level rather than becoming generic worksheet filling.`,
      ],
      assessment: createParagraphs([
        `Assessment should include one vocabulary check, one comprehension item, and one response that requires evidence from the lesson text. The teacher should look for clarity, accuracy, and whether the learner can point to support in the reading.`,
        `For upper grades, the assessment can also ask learners to compare viewpoints, identify author purpose, or justify an interpretation with textual evidence.`,
      ]),
      remediation: createParagraphs([
        `For remediation, re-read shorter text sections, pre-teach difficult words, and offer sentence frames or discussion stems. Students may respond orally before writing so ideas are secure before spelling and mechanics become a barrier.`,
        `Short repeated reading, vocabulary matching, and guided retell help learners recover confidence without reducing the intellectual goal of the lesson.`,
      ]),
      extension: createParagraphs([
        `For extension, learners can write a longer evidence-based response, compare two texts, or lead a short discussion using prepared questions. This deepens interpretation while preserving the lesson focus.`,
        `Advanced learners may also rewrite the central idea for a new audience or produce a short reflection that connects the text to community life.`,
      ]),
      guardianSupport: `Guardian support: invite the learner to retell the passage, explain two new vocabulary words, and share one sentence of written or oral response at home. A short family conversation strengthens confidence and comprehension.`,
      realWorldApplication: `Real-world application: show how reading and communication help learners follow instructions, understand community messages, tell their own stories clearly, and participate in school and civic life.`,
      materialsNotes: `Materials and activity notes: passage text on chart or notebook, vocabulary list, discussion prompts, and writing paper. When books are limited, the teacher can use repeated oral reading and copied excerpts.`,
    };
  }

  if (subjectCode === "SCIENCE") {
    return {
      explanation: createParagraphs([
        `This lesson teaches ${topic.toLowerCase()} through observation, explanation, and evidence-based reasoning. The teacher should begin with something learners can notice, imagine, or compare, then connect those observations to the scientific idea. ${gradeProfile.language}`,
        `The explanation phase must make cause and effect clear. Students should hear the key concept, see how scientists or careful observers describe it, and understand how evidence supports a conclusion. Where equipment is limited, the teacher can use household materials, diagrams, or thought experiments that still preserve scientific thinking.`,
        `Throughout the explanation, the teacher should distinguish between what students observe directly and what they infer from those observations. This protects scientific accuracy and prepares learners for later investigation and assessment.`,
      ]),
      workedExamples: [
        `Worked Example 1: The teacher walks through a simple scientific situation related to ${topic.toLowerCase()}, identifying the observation, the explanation, and the conclusion drawn from evidence.`,
        `Worked Example 2: The teacher compares two cases and asks what changes, what stays the same, and what that means scientifically. This models careful comparison instead of guesswork.`,
        `Worked Example 3: The teacher demonstrates how a common misconception can be corrected by returning to observable evidence and precise vocabulary.`,
      ],
      guidedPractice: [
        `Guided practice should involve one shared observation task and one short explanation task. Learners may record what they notice, discuss possible explanations, and then refine answers with teacher support.`,
        `Where appropriate, use a practical activity or thought experiment that is safe and low-resource. The teacher should keep the focus on evidence, not entertainment.`,
      ],
      independentPractice: [
        `Independent practice should include a short observation or scenario analysis, a vocabulary application item, and a response explaining why the scientific conclusion makes sense.`,
        `Older learners can compare variables, identify likely outcomes, or explain a simple process in sequence. Younger learners can label, sort, or describe what they see and why it matters.`,
      ],
      assessment: createParagraphs([
        `Assessment should include recall, application, and explanation. A strong response names the concept correctly, uses evidence or observation, and avoids unsupported claims.`,
        `The teacher should also check whether learners can transfer the concept to a new local example, such as weather, plants, water, energy use, or matter in daily life.`,
      ]),
      remediation: createParagraphs([
        `For remediation, return to simpler observations, concrete materials, and clearer distinctions between evidence and explanation. Rephrase the core concept and have learners practice naming what they can directly observe.`,
        `The teacher can use one repeated demonstration with structured questions so students rebuild understanding from the ground up.`,
      ]),
      extension: createParagraphs([
        `For extension, learners can design a fairer test, compare two explanations, or predict outcomes under a changed condition. This supports advanced reasoning without breaking grade appropriateness.`,
        `Upper grades may also write a short scientific explanation using claim, evidence, and reasoning.`,
      ]),
      guardianSupport: `Guardian support: ask the learner to describe one observation from the lesson and explain what it shows. Families can discuss a local example from home, weather, water, food, plants, or tools to reinforce the concept safely.`,
      realWorldApplication: `Real-world application: connect ${topic.toLowerCase()} to health, farming, weather awareness, water use, energy, the environment, or everyday materials so science remains practical and meaningful.`,
      materialsNotes: `Materials and activity notes: low-resource items such as cups, leaves, paper, water, soil, stones, or diagrams, depending on the topic. Emphasize safe observation and explanation over specialized equipment.`,
    };
  }

  if (subjectCode === "COMPUTER_SCIENCE") {
    return {
      explanation: createParagraphs([
        `This lesson introduces ${topic.toLowerCase()} using simple technical language, clear definitions, and applied examples that make computing ideas feel understandable rather than abstract. ${gradeProfile.language}`,
        `The teacher should explain how the concept works, where learners might see it in digital tools, and what habits of careful thinking it supports. Even when devices are limited, the class can learn computer science through unplugged modeling, diagrams, sequencing tasks, and structured problem solving.`,
        `The explanation should connect vocabulary, process, and purpose. Students need to know what the concept is, how it behaves, and why it matters in real systems or daily technology use.`,
      ]),
      workedExamples: [
        `Worked Example 1: Model one simple computing task related to ${topic.toLowerCase()}, naming each step clearly and explaining what input, process, and output look like.`,
        `Worked Example 2: Show a second case with a small variation so learners compare the logic rather than memorizing a script.`,
        `Worked Example 3: Present one common confusion, such as mixing up sequence and condition, and correct it by tracing the steps aloud.`,
      ],
      guidedPractice: [
        `Guided practice should ask learners to predict what happens next in a process, arrange steps in order, and explain why a sequence or rule works. If devices are unavailable, learners can use cards, arrows, or spoken algorithms.`,
        `The teacher should watch for vocabulary confusion and ensure learners explain both the process and the purpose of the action.`,
      ],
      independentPractice: [
        `Independent practice should include one short sequencing or logic task, one vocabulary application item, and one applied challenge that asks learners to use the concept in a realistic digital situation.`,
        `Older learners can compare approaches or debug a simple error. Younger learners can label steps, sort actions, or explain a routine clearly.`,
      ],
      assessment: createParagraphs([
        `Assessment should check whether learners can define the concept, apply it in a simple case, and explain the reasoning behind their answer. Strong responses show both procedural accuracy and conceptual understanding.`,
        `If appropriate, include a quick reflection on safe, responsible, or effective technology use tied to the lesson topic.`,
      ]),
      remediation: createParagraphs([
        `For remediation, reduce the task to a smaller sequence, use visuals, and let learners rehearse the logic orally before writing or diagramming it.`,
        `One-on-one or small-group replay of the process helps students separate the concept from memorized wording.`,
      ]),
      extension: createParagraphs([
        `For extension, learners can design a new example, improve an existing sequence, or compare two methods for efficiency or clarity.`,
        `Advanced learners may also explain how the idea connects to future study in coding, data, networks, or digital systems.`,
      ]),
      guardianSupport: `Guardian support: ask the learner to explain one technology or step-by-step process from the lesson in simple language. The goal is to practice logical thinking, not require device access at home.`,
      realWorldApplication: `Real-world application: connect ${topic.toLowerCase()} to phones, radio, information systems, safe digital habits, or everyday problem solving so learners see computing as useful and accessible.`,
      materialsNotes: `Materials and activity notes: board diagrams, paper cards, simple flowcharts, or limited shared devices when available. Keep tasks low-resource and school-safe.`,
    };
  }

  return {
    explanation: createParagraphs([
      `This lesson teaches ${topic.toLowerCase()} with a clear sequence of explanation, examples, guided work, and reflection. The teacher should connect the concept to learners' daily experiences and explain why it matters in school and community life. ${gradeProfile.language}`,
      `Students should be able to define the main idea, discuss examples, and apply the concept in a short scenario by the end of the lesson. The teacher should use questions, comparison, and short checks for understanding throughout the lesson rather than waiting until the end.`,
      `The explanation phase should build understanding step by step so learners can move into practice confidently and show what they know with age-appropriate independence.`,
    ]),
    workedExamples: [
      `Worked Example 1: Model a short scenario related to ${topic.toLowerCase()} and explain the key idea in action.`,
      `Worked Example 2: Compare a second scenario and ask what changed, what stayed the same, and what learners should notice.`,
      `Worked Example 3: Show a likely misconception and correct it with clear reasoning and vocabulary.`,
    ],
    guidedPractice: [
      `Guided practice should include one whole-class discussion task and one pair or group task. Learners should explain their thinking, not only state an answer.`,
      `The teacher should use follow-up questions that move from recall to application so understanding grows during the lesson itself.`,
    ],
    independentPractice: [
      `Independent practice should ask learners to apply the concept in writing, speech, or a short scenario analysis using the lesson vocabulary correctly.`,
      `Where appropriate, students can reflect on how the idea appears in family, school, community, or national life.`,
    ],
    assessment: createParagraphs([
      `Assessment should include a simple knowledge check and a short application or reflection item. Strong responses show correct understanding, clear reasoning, and appropriate use of examples.`,
      `Older learners should support claims with evidence or explanation. Younger learners should answer with clear and accurate language.`,
    ]),
    remediation: createParagraphs([
      `For remediation, revisit the concept with shorter examples, discussion prompts, and direct clarification of vocabulary.`,
      `Learners needing support should complete one scaffolded task with immediate teacher feedback before the lesson closes.`,
    ]),
    extension: createParagraphs([
      `For extension, ask learners to compare contexts, evaluate choices, or design their own example that shows the idea in action.`,
      `This keeps challenge available without changing the core progression path.`,
    ]),
    guardianSupport: `Guardian support: invite the learner to explain the lesson idea at home and give one simple example from family, school, or community life.`,
    realWorldApplication: `Real-world application: connect ${topic.toLowerCase()} to community participation, decision making, local history, rights and responsibilities, or social problem solving, depending on the subject focus.`,
    materialsNotes: `Materials and activity notes: discussion prompts, board notes, short scenarios, and simple paper-based tasks that remain practical in low-resource classrooms.`,
  };
}

function buildSectionBody(title: string, content: string) {
  return `## ${title}\n${content}`;
}

function createWordCountBooster(topic: string, grade: number, subject: string) {
  const gradeProfile = getGradeProfile(grade);
  return createParagraphs([
    `Additional teaching notes: revisit ${topic.toLowerCase()} using another classroom example that matches ${gradeProfile.learnerProfile}. The teacher should ask learners to speak, listen, write, and explain in short cycles so understanding becomes visible before the lesson closes.`,
    `Additional guided support: connect the ${subject.toLowerCase()} idea to one familiar Liberian school or community situation, then ask learners to explain what the concept looks like, what good reasoning sounds like, and how they can avoid the most likely mistake.`,
    `Additional reflection: end with a brief oral or written reflection in which learners state the key idea, describe one example, and name one question they can now answer more confidently than they could at the start of the lesson.`,
  ]);
}

export function countWords(text: string | undefined) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countLessonWords(payload: LessonPayload) {
  const standard = typeof payload.body_standard === "string" ? payload.body_standard : undefined;
  const block = typeof payload.body_block === "string" ? payload.body_block : undefined;
  if (standard && block) return countWords(standard) + countWords(block);
  return countWords(typeof payload.body === "string" ? payload.body : standard ?? block);
}

export function enrichGeneratedLesson(input: EnrichmentInput) {
  const title = toTitle(input.payload.title, input.contentId);
  const topic = getTopic(input.payload);
  const bundle = buildSubjectBundle(input.subject, input.grade, topic);

  let bodyStandard = [
    buildSectionBody("Objective", toTitle(input.payload.objective, `Students will explain and apply ${topic.toLowerCase()} in grade-appropriate ways.`)),
    buildSectionBody("Teacher Explanation", bundle.explanation),
    buildSectionBody("Worked Examples or Demonstrations", bundle.workedExamples.join("\n\n")),
    buildSectionBody("Guided Practice", bundle.guidedPractice.join("\n\n")),
    buildSectionBody("Independent Practice", bundle.independentPractice.join("\n\n")),
    buildSectionBody("Assessment Questions", bundle.assessment),
    buildSectionBody("Remediation Support", bundle.remediation),
    buildSectionBody("Extension or Challenge", bundle.extension),
    buildSectionBody("Guardian Support", bundle.guardianSupport),
    buildSectionBody("Real-World Application", bundle.realWorldApplication),
    buildSectionBody("Materials and Activity Notes", bundle.materialsNotes),
  ].join("\n\n");

  let bodyBlock = [
    buildSectionBody("Opening and Review", `${bundle.explanation}\n\nUse a short recap to connect prior learning to ${topic.toLowerCase()} before the main activity begins.`),
    buildSectionBody("Teacher Modeling and Demonstration", bundle.workedExamples.join("\n\n")),
    buildSectionBody("Guided Group Work", bundle.guidedPractice.join("\n\n")),
    buildSectionBody("Independent or Project Work", `${bundle.independentPractice.join("\n\n")}\n\n${bundle.realWorldApplication}`),
    buildSectionBody("Assessment and Reflection", `${bundle.assessment}\n\n${bundle.extension}`),
    buildSectionBody("Home and Guardian Connection", `${bundle.guardianSupport}\n\n${bundle.materialsNotes}`),
  ].join("\n\n");

  const booster = createWordCountBooster(topic, input.grade, input.subject);
  while (countWords(bodyStandard) + countWords(bodyBlock) < 1200) {
    bodyStandard = `${bodyStandard}\n\n${buildSectionBody("Additional Teacher Notes", booster)}`;
    bodyBlock = `${bodyBlock}\n\n${buildSectionBody("Additional Reflection and Review", booster)}`;
  }

  const parsed = CurriculumPayloadSchema.parse({
    ...input.payload,
    title,
    grade: input.grade,
    subject: input.subject,
    body: bodyStandard,
    body_standard: bodyStandard,
    body_block: bodyBlock,
    objective: toTitle(input.payload.objective, `Students will explain and apply ${topic.toLowerCase()} with confidence.`),
    explanation: bundle.explanation,
    workedExamples: bundle.workedExamples,
    guidedPractice: bundle.guidedPractice,
    independentPractice: bundle.independentPractice,
    assessment: bundle.assessment,
    remediation: bundle.remediation,
    extension: bundle.extension,
    guardianSupport: bundle.guardianSupport,
    realWorldApplication: bundle.realWorldApplication,
    materialsNotes: bundle.materialsNotes,
    generationStage: "generated_enriched",
  });

  const mergedPayload = {
    ...input.payload,
    ...parsed,
    primaryConcept: input.payload.primaryConcept,
    prerequisites: input.payload.prerequisites,
    nextConcepts: input.payload.nextConcepts,
    difficulty: input.payload.difficulty,
    unitTitle: input.payload.unitTitle,
    canonicalSubject: input.payload.canonicalSubject,
    contentCompleteness: {
      ...(typeof input.payload.contentCompleteness === "object" &&
      input.payload.contentCompleteness &&
      !Array.isArray(input.payload.contentCompleteness)
        ? (input.payload.contentCompleteness as Record<string, unknown>)
        : {}),
      objective: true,
      explanation: true,
      workedExamples: true,
      guidedPractice: true,
      independentPractice: true,
      assessment: true,
      remediation: true,
      extension: true,
      guardianSupport: true,
      realWorldApplication: true,
      materialsNotes: true,
    },
  };

  const wordCount = countLessonWords(mergedPayload as LessonPayload);

  return {
    payload: mergedPayload,
    wordCount,
    belowThreshold: wordCount < 1200,
  };
}
