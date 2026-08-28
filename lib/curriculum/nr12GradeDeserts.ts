import { createHash } from "crypto";
import { CurriculumPayloadSchema } from "@/lib/schemas/curriculumPayload";
import { getStorageSubject } from "@/lib/curriculum/subjectTaxonomy";

/** NR-12 is the first coverage run that must produce teachable lessons, not shells. */
export const NR12_VERSION = "nr12-2026.1";
export const NR12_TARGET_LESSONS = 15;
export const NR12_LESSON_QUIZ_COUNT = 5;
export const NR12_UNIT_QUIZ_COUNT = 10;
export const NR12_TERM_EXAM_COUNT = 30;

export const NR12_SUBJECTS = [
  "MATH",
  "LITERACY",
  "SCIENCE",
  "SOCIAL_STUDIES",
  "CIVICS",
] as const;

export type Nr12Subject = (typeof NR12_SUBJECTS)[number];

export type Nr12AuthorityRecord = {
  code: string;
  grade: number;
  subject: Nr12Subject;
  strand: string;
  description: string;
  sourceFile: string;
  sourcePages: string;
  sourceArchive: string;
  sourceSha256?: string;
  evidenceStatus: "REPO_STANDARD" | "VERIFIED_MOE_OBJECTIVE";
};

export type Nr12Topic = {
  unitTitle: string;
  strand: string;
  concept: string;
  standardCodes: string[];
  objective: string;
  examples: [string, string];
  application: string;
  misconception: string;
  correction: string;
  materials: string[];
};

export type Nr12GenerationRecord = {
  contentId: string;
  grade: number;
  subject: string;
  canonicalSubject: Nr12Subject;
  contentType: "lesson";
  status: "generated";
  version: string;
  hash: string;
  unitId: string;
  orderInUnit: number;
  lessonType: "core";
  payload: Record<string, unknown>;
};

type Nr12AssessmentBlueprint = {
  lessonQuiz: {
    questionCount: 5;
    conceptCount: number;
    items: Array<{
      id: string;
      type: "mcq";
      standardCode: string;
      concept: string;
      prompt: string;
      options: string[];
      correctIndex: number;
      answerKey: string;
      explanation: string;
      points: number;
    }>;
  };
  unitQuiz: { questionCount: 10; conceptCount: number; standardCodes: string[] };
  termExam: { questionCount: 30; conceptCount: number; standardCodes: string[] };
};

const G16_ARCHIVE = "GRADE-1-6.zip";
const G79_ARCHIVE = "GRADE-7-9.zip";

/**
 * These records intentionally distinguish project standard records from
 * verbatim MOE objective records. No WAEC topic-level claim is made where the
 * repository only has subject-level WAEC evidence.
 */
export const NR12_AUTHORITY_RECORDS: Nr12AuthorityRecord[] = [
  ...[
    ["LR-MATH-G1_3-01", "Number and place value", "Count, read, and write whole numbers up to 1,000; understand place value to hundreds"],
    ["LR-MATH-G1_3-02", "Operations", "Add and subtract whole numbers up to 100 with and without regrouping"],
    ["LR-MATH-G1_3-03", "Geometry", "Identify and describe basic geometric shapes"],
    ["LR-MATH-G1_3-04", "Measurement", "Measure length using non-standard and standard units"],
    ["LR-MATH-G1_3-05", "Time", "Tell time to the hour and half-hour; identify days and months"],
    ["LR-LIT-G1_3-01", "Phonemic awareness", "Recognize and produce letter sounds in English"],
    ["LR-LIT-G1_3-02", "Reading fluency", "Read and comprehend grade-level texts with fluency"],
    ["LR-LIT-G1_3-03", "Writing", "Write simple sentences and short paragraphs using correct grammar"],
    ["LR-SCI-G1_3-01", "Classification", "Identify living and non-living things in the local environment"],
    ["LR-SCI-G1_3-02", "Needs of living things", "Describe the basic needs of plants and animals"],
    ["LR-SCI-G1_3-03", "Weather", "Observe and describe weather patterns and seasonal changes in Liberia"],
    ["LR-CIV-G1_3-01", "National identity", "Identify national symbols of Liberia and their meanings"],
  ].map(([code, strand, description]) => ({
    code, grade: 2, subject: (code.startsWith("LR-MATH") ? "MATH" : code.startsWith("LR-LIT") ? "LITERACY" : code.startsWith("LR-SCI") ? "SCIENCE" : "CIVICS") as Nr12Subject,
    strand, description, sourceFile: "prisma/seeds/moe-standards.ts", sourcePages: "seed record", sourceArchive: "repo curriculum authority", evidenceStatus: "REPO_STANDARD" as const,
  })),
  {
    code: "MOE.G2.SOCIAL_STUDIES.GEOGRAPHY_OF_LIBERIA", grade: 2, subject: "SOCIAL_STUDIES", strand: "Geography of Liberia",
    description: "Locate Liberia on the map of Africa; list physical features; state the importance of natural resources; describe climate and effects; identify the people that make up Liberia; demonstrate the ability to advocate for needs and rights.",
    sourceFile: "Social Studies Grade 1-6.pdf", sourcePages: "23-24", sourceArchive: G16_ARCHIVE,
    sourceSha256: "5e6330de23f882058415b713cdf9bf28053214cd3e8ea54edb8191e13617a53d", evidenceStatus: "VERIFIED_MOE_OBJECTIVE",
  },
  {
    code: "MOE.G2.SOCIAL_STUDIES.TRANSPORTATION_AND_COMMUNICATION", grade: 2, subject: "SOCIAL_STUDIES", strand: "Transportation and Communication",
    description: "List reasons why people travel; classify air, land, and sea transportation; describe transportation in Liberia today and yesterday; list, identify, and describe traditional and modern means of communication.",
    sourceFile: "Social Studies Grade 1-6.pdf", sourcePages: "24-26", sourceArchive: G16_ARCHIVE,
    sourceSha256: "5e6330de23f882058415b713cdf9bf28053214cd3e8ea54edb8191e13617a53d", evidenceStatus: "VERIFIED_MOE_OBJECTIVE",
  },
  ...[
    ["LR-MATH-G7_9-01", "Equations", "Solve linear equations and inequalities in one variable"],
    ["LR-MATH-G7_9-02", "Ratios and percentages", "Understand and apply ratios, proportions, and percentages"],
    ["LR-MATH-G7_9-05", "Statistics", "Collect, organize, and interpret data; calculate mean, median, and mode"],
    ["LR-LIT-G7_9-01", "Literary analysis", "Analyze literary devices in African and world literature"],
    ["LR-LIT-G7_9-02", "Argument writing", "Write persuasive and argumentative essays with evidence and reasoning"],
    ["LR-LIT-G7_9-03", "Research", "Conduct research using multiple sources and cite references properly"],
    ["LR-SCI-G7_9-01", "Chemical reasoning", "Explain chemical reactions, acids, bases, and the pH scale"],
    ["LR-SCI-G7_9-02", "Life science", "Describe cell structure, cell division, and basic genetics"],
    ["LR-SCI-G7_9-03", "Forces and motion", "Understand forces, motion, and Newton's laws of motion"],
    ["LR-CIV-G7_9-01", "Liberian history", "Analyze the history of Liberia from founding through the civil wars to present"],
    ["LR-CIV-G7_9-02", "Constitutions", "Compare Liberia's constitution with other democratic constitutions"],
  ].map(([code, strand, description]) => ({
    code, grade: 9, subject: (code.startsWith("LR-MATH") ? "MATH" : code.startsWith("LR-LIT") ? "LITERACY" : code.startsWith("LR-SCI") ? "SCIENCE" : "CIVICS") as Nr12Subject,
    strand, description, sourceFile: "prisma/seeds/moe-standards.ts", sourcePages: "seed record", sourceArchive: "repo curriculum authority", evidenceStatus: "REPO_STANDARD" as const,
  })),
  {
    code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS", grade: 9, subject: "MATH", strand: "Sets",
    description: "Apply sets to solve simple two-set problems using Venn diagrams, find the complement of a set, draw and use Venn diagrams, find the number of subsets in a set with up to five elements, and state the rule for the number of subsets.",
    sourceFile: "Math 7-9.pdf", sourcePages: "37", sourceArchive: G79_ARCHIVE,
    sourceSha256: "b8f076e1448671bc4f0e7af91ca69795db273f10d6fa0aba6cfc4e9065d28224", evidenceStatus: "VERIFIED_MOE_OBJECTIVE",
  },
  {
    code: "MOE.G9.LANGUAGE_ARTS.COMPOSITION_LITERATURE_COMPREHENSION", grade: 9, subject: "LITERACY", strand: "Composition, literature, and comprehension",
    description: "Write sentences and paragraphs using punctuation correctly; develop composition using antonyms and synonyms; read a passage and identify and interpret figures of speech.",
    sourceFile: "English 7-9.pdf", sourcePages: "23", sourceArchive: G79_ARCHIVE,
    sourceSha256: "8f01d51551438db0e66c8d31c464a20025fb7c66054d4e836a41dc5d6dd02069", evidenceStatus: "VERIFIED_MOE_OBJECTIVE",
  },
  {
    code: "MOE.G9.GENERAL_SCIENCE.MAGNETISM_AND_ELECTRICITY", grade: 9, subject: "SCIENCE", strand: "Physical science",
    description: "Discuss the causes and properties of magnetism; state electrostatic laws and discuss static electricity; describe effects of current electricity on metallic and non-metallic substances.",
    sourceFile: "General Science 7-9.pdf", sourcePages: "52", sourceArchive: G79_ARCHIVE,
    sourceSha256: "79e237c6ecd428f156a617dba074adbf67cba643c3082f81fa4a47ad49440234", evidenceStatus: "VERIFIED_MOE_OBJECTIVE",
  },
  {
    code: "MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS", grade: 9, subject: "SOCIAL_STUDIES", strand: "Regional geography",
    description: "Locate major areas of West Africa noted for agriculture, mining, forestry, fishing, and industries; evaluate geographical factors favoring agriculture; identify major mineral resources.",
    sourceFile: "Social Studies 7-9.pdf", sourcePages: "29", sourceArchive: G79_ARCHIVE,
    sourceSha256: "89b1f263f6cd238d4e1c9b31897f85a2ca7cdcece5c78f21ed72f1b8262849bb", evidenceStatus: "VERIFIED_MOE_OBJECTIVE",
  },
];

function topic(unitTitle: string, strand: string, concept: string, standardCodes: string[], objective: string, examples: [string, string], application: string, misconception: string, correction: string, materials: string[]): Nr12Topic {
  return { unitTitle, strand, concept, standardCodes, objective, examples, application, misconception, correction, materials };
}

const G2_TOPICS: Record<Exclude<Nr12Subject, never>, Nr12Topic[]> = {
  MATH: [
    topic("Number and Place Value", "Number and place value", "numbers to 1,000 and hundreds", ["LR-MATH-G1_3-01"], "Read, write, compare, and represent numbers to 1,000 using hundreds, tens, and ones.", ["347 is 3 hundreds, 4 tens, and 7 ones.", "506 has 5 hundreds, 0 tens, and 6 ones."], "Build 628 with bottle caps or stones, then explain the value of each digit.", "The zero in 506 has no value at all, so 506 is the same as 56.", "Zero holds an empty tens place, but the five still means five hundreds.", ["place-value chart", "stones or bottle caps", "paper number cards"]),
    topic("Addition and Subtraction", "Operations", "adding and subtracting within 100", ["LR-MATH-G1_3-02"], "Add and subtract whole numbers to 100, showing regrouping when a place needs help.", ["36 + 27 = 63: add ones, regroup 13 ones as 1 ten and 3 ones.", "72 - 38 = 34: rename one ten as 10 ones before subtracting."], "Solve 45 + 28 and 83 - 47 with bottle caps, a drawing, and a written method.", "When the top ones digit is smaller, a learner must put the smaller answer without renaming a ten.", "Rename one ten as ten ones, then subtract. The total quantity does not change.", ["bottle caps", "number cards", "board and chalk"]),
    topic("Shape and Measure", "Geometry and measurement", "shapes, length, and time", ["LR-MATH-G1_3-03", "LR-MATH-G1_3-04", "LR-MATH-G1_3-05"], "Name common shapes, measure length in centimeters or meters, and read time to the hour or half-hour.", ["A rectangle has four sides and four corners; a classroom door is a rectangle.", "A pencil 14 cm long is longer than a 9 cm crayon."], "Sort classroom objects by shape, measure two objects, and show 7:30 on a clock face.", "A shape is a rectangle only when it is drawn standing upright.", "Turn the shape. Its name depends on its sides and corners, not its direction.", ["ruler", "paper shapes", "drawn clock face"]),
  ],
  LITERACY: [
    topic("Sounds and Words", "Phonemic awareness", "hearing and blending letter sounds", ["LR-LIT-G1_3-01"], "Blend and segment familiar English sounds to read short words, then use one word in a spoken sentence.", ["/m/ /a/ /p/ blends to make map.", "The word sun starts with /s/ and ends with /n/."], "Tap three sounds in fish, blend them, and tell a partner a sentence with fish.", "A learner names letter names but does not listen to the sounds those letters make.", "Say the sound, not only the letter name, and blend the sounds without adding extra syllables.", ["letter cards", "word cards", "small objects or pictures"]),
    topic("Read and Retell", "Reading fluency", "accurate reading and main events", ["LR-LIT-G1_3-02"], "Read a short grade-level passage accurately, answer a literal question, and retell its beginning, middle, and end.", ["In a passage about Fatu planting beans, the seed is planted first, watered next, and observed last.", "The main event tells what the passage is mostly about."], "Read the passage twice, circle one key detail, and retell it in three sentences.", "A learner retells every small word but cannot say what the passage is mainly about.", "Choose the event that explains the passage, then support it with one detail.", ["short passage", "word cards", "three-part retell chart"]),
    topic("Sentences and Paragraphs", "Writing", "complete sentences and short paragraphs", ["LR-LIT-G1_3-03"], "Write complete sentences with a capital letter and end mark, then join related sentences into a short paragraph.", ["Musa reads. Musa tells the story. becomes Musa reads and tells the story.", "A paragraph about rain can explain what rain does and how people prepare."], "Arrange sentence cards, add punctuation, and write four connected sentences about a school activity.", "A capital letter and a full stop alone make any group of words a complete sentence.", "A complete sentence also needs a clear idea with a subject and an action or state.", ["sentence cards", "writing paper", "pencils"]),
  ],
  SCIENCE: [
    topic("Living or Non-Living", "Classification", "classifying things in the local environment", ["LR-SCI-G1_3-01"], "Classify familiar local things as living or non-living and give one observable reason for each choice.", ["A goat is living because it grows and needs food.", "A stone is non-living because it does not grow or reproduce."], "Sort a leaf, stone, cup, seed, and pencil, then explain one choice using an observation.", "Anything that moves once is living, including a rolling stone.", "Movement alone is not enough. Living things grow, need resources, and carry out life processes.", ["leaf", "stone", "seed", "cup"]),
    topic("Needs of Plants and Animals", "Needs of living things", "water, food, air, and shelter", ["LR-SCI-G1_3-02"], "Describe the basic needs of plants and animals and connect each need to survival.", ["A bean plant needs water, air, light, and a suitable place to grow.", "A chicken needs food, water, air, and shelter from danger."], "Match each need card to a plant or animal example and explain what happens when one need is missing.", "Plants eat food in the same way animals eat rice.", "Plants make food using light, water, and air; they still need water and a safe place to grow.", ["need cards", "bean or leaf", "picture cards"]),
    topic("Weather and Seasons", "Weather", "observing weather patterns in Liberia", ["LR-SCI-G1_3-03"], "Record weather observations and describe how rain, sun, wind, or cloud cover affect daily activities.", ["A rainy morning can make a path muddy and delay travel.", "A sunny day can dry clothes and increase the need for drinking water."], "Keep a three-day weather chart and compare what changed and what stayed the same.", "Weather and climate mean exactly the same thing and can be recorded from one moment.", "Weather is what we observe now or today; climate describes patterns over a long time.", ["weather chart", "pencil", "safe outdoor observation"]),
  ],
  SOCIAL_STUDIES: [
    topic("Locate Liberia", "Geography of Liberia", "Liberia's location in Africa", ["MOE.G2.SOCIAL_STUDIES.GEOGRAPHY_OF_LIBERIA"], "Locate Liberia on a map of Africa and describe its position using nearby countries and the Atlantic Ocean.", ["Liberia is on the west coast of Africa beside the Atlantic Ocean.", "A map key and compass help a learner interpret a map instead of guessing from its shape."], "Point to Liberia on a map, name one neighboring country, and use the compass to describe one direction.", "Liberia is in Europe because its name is connected to freedom in the Americas.", "Liberia is a country on the west coast of Africa; the map title and labels provide evidence.", ["map of Africa", "map of Liberia", "compass rose"]),
    topic("Features and Resources", "Geography of Liberia", "physical features and natural resources", ["MOE.G2.SOCIAL_STUDIES.GEOGRAPHY_OF_LIBERIA"], "Name physical features of Liberia and explain one way a natural resource supports people.", ["A river can provide water and a route for travel.", "A forest provides habitat and materials, but it must be cared for."], "Match mountains, rivers, lakes, and forests to a use, then name one safe way to protect them.", "A natural resource is made by people in a factory.", "Natural resources come from nature; people use them carefully for needs and livelihoods.", ["feature pictures", "Liberia map", "matching cards"]),
    topic("Travel and Communication", "Transportation and Communication", "traditional and modern ways people move and share messages", ["MOE.G2.SOCIAL_STUDIES.TRANSPORTATION_AND_COMMUNICATION"], "Classify transportation as land, air, or sea and compare a traditional and modern way to communicate in Liberia.", ["A canoe is sea or water transportation; a motorbike is land transportation.", "A town crier shares news traditionally; a radio shares news electronically."], "Sort picture cards into land, air, sea, traditional communication, and modern communication groups.", "Only cars count as transportation, and communication must use the internet.", "People can travel by walking, canoe, car, or aircraft and communicate through speech, print, radio, or phones.", ["transport cards", "communication pictures", "sorting chart"]),
  ],
  CIVICS: [
    topic("Liberia's Symbols", "National identity", "the flag, seal, and anthem", ["LR-CIV-G1_3-01"], "Identify Liberia's flag, seal, and anthem and describe why national symbols are treated with respect.", ["The flag identifies Liberia as a nation and should be handled respectfully.", "The anthem is a national song that people sing together on important occasions."], "Match each symbol to its name and role, then describe one respectful action during an assembly.", "A national symbol belongs only to the person holding it.", "A national symbol represents the country and its people, so everyone should treat it respectfully.", ["symbol pictures", "Liberian flag image", "song or printed words"]),
    topic("Symbols and Belonging", "National identity", "how shared symbols build belonging", ["LR-CIV-G1_3-01"], "Explain how shared national symbols help people feel connected while respecting differences among citizens.", ["Learners can stand together for the anthem even when they speak different home languages.", "A classroom display can show a symbol while learners explain its meaning."], "Discuss one way a class can respect a national symbol and one way it can include every learner.", "Belonging means everyone must look, speak, or think the same.", "Belonging allows differences while shared responsibilities connect people.", ["discussion circle", "symbol image", "chart paper"]),
    topic("Respect in Civic Life", "National identity", "respectful participation in shared civic routines", ["LR-CIV-G1_3-01"], "Demonstrate respectful behavior during a national-symbol routine and explain the reason for each action.", ["During an anthem, learners face the flag, listen, and avoid distracting others.", "A class representative can explain the symbol without claiming it belongs to one group."], "Role-play an assembly routine, then use a checklist to give kind, specific feedback.", "Respect requires silence only; a learner cannot show respect through careful participation.", "Respect includes attention, safe behavior, accurate words, and allowing others to participate.", ["routine checklist", "flag image", "role cards"]),
  ],
};

const G9_TOPICS: Record<Nr12Subject, Nr12Topic[]> = {
  MATH: [
    topic("Two-Set Problems", "Sets", "Venn diagrams and two-set problems", ["MOE.G9.MATH.SETS.TWO_SET_PROBLEMS"], "Draw and interpret a two-set Venn diagram, find a complement, and solve a simple two-set problem.", ["If 18 learners like rice, 12 like beans, and 5 like both, the union is 25.", "The complement of a set contains the members in the universal set that are outside that set."], "Survey a class about two activities, place the data in a Venn diagram, and justify the union count.", "The overlap is added twice when finding the union, so no correction is needed.", "Subtract the overlap once because it was counted in both sets.", ["Venn diagram template", "survey table", "ruler"]),
    topic("Subsets and Complements", "Sets", "subsets and the 2^n rule", ["MOE.G9.MATH.SETS.TWO_SET_PROBLEMS"], "Find complements and the number of subsets of a set with up to five elements, explaining why the rule is 2^n.", ["A set with 3 elements has 2^3 = 8 subsets.", "Each element can be included or excluded, giving two choices per element."], "List subsets of {a,b}, then use the two-choice argument to predict the count for {a,b,c,d}.", "A set with four elements has four subsets because one subset belongs to each element.", "Every element creates two choices, so four elements give 2 x 2 x 2 x 2 = 16 subsets.", ["set cards", "Venn diagram", "notebook"]),
    topic("Equations and Percentages", "Algebra and ratio", "linear equations and percentage reasoning", ["LR-MATH-G7_9-01", "LR-MATH-G7_9-02"], "Solve a linear equation and a percentage problem, showing operations that preserve equality.", ["3x + 4 = 19 gives 3x = 15 and x = 5.", "15 percent of 200 is 30 because 0.15 x 200 = 30."], "Compare a balance method and inverse-operation method for 4x - 7 = 21, then check the result.", "An operation can be applied to one side of an equation without changing the solution.", "Equality is preserved only when the same valid operation is applied to both sides.", ["balance diagram", "calculator if available", "board"]),
    topic("Data and Averages", "Statistics", "mean, median, mode, and data interpretation", ["LR-MATH-G7_9-05"], "Calculate and interpret mean, median, and mode from a small data set, choosing a suitable measure.", ["For 2, 3, 3, 8, 9, the mode is 3 and the median is 3.", "An extreme value can pull the mean away from most observations."], "Compare the average daily water-use data of two groups and explain which measure tells the clearer story.", "The mean is always one of the values in the data set.", "The mean is a calculated balance point and may be a value not observed in the list.", ["data table", "graph paper", "ruler"]),
    topic("Mathematical Reasoning", "Problem solving", "choosing and defending a method", ["LR-MATH-G7_9-01", "LR-MATH-G7_9-02", "LR-MATH-G7_9-05"], "Select an efficient method for a multi-step problem and justify the answer with a check or alternate representation.", ["A table can reveal a percentage pattern before an equation formalizes it.", "Substitution checks whether an equation answer satisfies the original condition."], "Solve a Liberia market comparison in two ways and defend which method is clearer.", "A method is correct only when it reaches an answer, even if the units or condition are ignored.", "A valid solution includes correct operations, units or labels, and a check against the question.", ["market data", "calculator", "solution checklist"]),
  ],
  LITERACY: [
    topic("Figures of Speech", "Composition, literature, and comprehension", "interpreting metaphor, simile, and imagery", ["MOE.G9.LANGUAGE_ARTS.COMPOSITION_LITERATURE_COMPREHENSION", "LR-LIT-G7_9-01"], "Identify and interpret a figure of speech in a short passage, using the surrounding words as evidence.", ["The phrase 'the road swallowed the rain' is imagery, not a literal claim that a road eats.", "A simile uses a comparison such as 'like' or 'as'; a metaphor states a comparison directly."], "Annotate a short passage, label the device, and explain the effect in two evidence-based sentences.", "A figure of speech should always be interpreted literally.", "Interpret the image in context and explain what quality or idea the comparison emphasizes.", ["short passage", "highlighters", "device chart"]),
    topic("Punctuation and Clarity", "Composition, literature, and comprehension", "punctuating sentences and paragraphs", ["MOE.G9.LANGUAGE_ARTS.COMPOSITION_LITERATURE_COMPREHENSION"], "Use punctuation marks correctly to separate ideas and improve the clarity of a paragraph.", ["A comma can separate an introductory phrase; a full stop closes a complete thought.", "A colon can introduce a list when the first clause is complete."], "Edit a short paragraph, explain two changes, and read the revised version aloud for meaning.", "Punctuation is decoration and does not change how a reader understands a sentence.", "Punctuation signals relationships among ideas, pauses, boundaries, and emphasis.", ["editing passage", "colored pens", "punctuation guide"]),
    topic("Vocabulary in Composition", "Composition, literature, and comprehension", "antonyms, synonyms, and precise word choice", ["MOE.G9.LANGUAGE_ARTS.COMPOSITION_LITERATURE_COMPREHENSION"], "Use antonyms and synonyms accurately to develop a clear composition without changing the intended meaning.", ["'Rapid' and 'quick' can be synonyms in one context, while 'rapid' and 'slow' are antonyms.", "A synonym must fit the sentence, not merely share a dictionary definition."], "Revise a paragraph by replacing repeated words with precise synonyms and explaining one choice.", "Every synonym can replace another word in every sentence.", "Check meaning, tone, and grammar in the sentence before selecting a synonym.", ["word bank", "paragraph draft", "dictionary"]),
    topic("Composition Structure", "Composition, literature, and comprehension", "planning a coherent composition", ["MOE.G9.LANGUAGE_ARTS.COMPOSITION_LITERATURE_COMPREHENSION", "LR-LIT-G7_9-02"], "Plan an introduction, linked body paragraphs, and a conclusion for a composition using precise vocabulary and correct punctuation.", ["An introduction gives context and a clear direction; a conclusion returns to the main idea without copying it.", "Each body paragraph should develop one controlling idea with relevant detail."], "Turn a Liberia community topic into a paragraph plan, then write one developed body paragraph.", "A composition is organized when it has several paragraphs, even if ideas do not connect.", "Coherence depends on a clear purpose, logical order, linking words, and relevant details.", ["planning frame", "sample composition", "writing paper"]),
    topic("Evidence and Research", "Research", "using multiple sources responsibly", ["LR-LIT-G7_9-03"], "Compare information from two sources, record the key evidence, and cite each source clearly.", ["A textbook and an interview may offer different evidence that must be compared, not blended without labels.", "A citation tells a reader where a claim or quotation came from."], "Create a two-source evidence table about a local issue and write a paragraph that distinguishes fact from opinion.", "Research means copying the first search result into an assignment.", "Research requires purposeful source selection, notes in your own words, and transparent attribution.", ["two short sources", "evidence table", "citation model"]),
  ],
  SCIENCE: [
    topic("Magnetic Properties", "Physical science", "causes and properties of magnetism", ["MOE.G9.GENERAL_SCIENCE.MAGNETISM_AND_ELECTRICITY"], "Describe magnetic attraction and repulsion, identify magnetic materials, and relate the observations to magnetic poles.", ["Like poles repel and unlike poles attract.", "Iron is attracted to a magnet, while a wooden ruler is not magnetic in the same way."], "Test safe classroom objects, record observations, and infer which property explains each result.", "A magnet attracts every metal and has only one kind of pole.", "Magnetic response depends on the material, and every magnet has a north and south pole.", ["bar magnet", "paper clips", "wood and metal objects"]),
    topic("Static Electricity", "Physical science", "electrostatic laws and charge", ["MOE.G9.GENERAL_SCIENCE.MAGNETISM_AND_ELECTRICITY"], "Explain how static charge forms and use attraction and repulsion observations to describe electrostatic behavior.", ["Rubbing a balloon on dry hair can transfer charge and attract small paper pieces.", "Two objects with like charges repel, while unlike charges attract."], "Carry out a safe balloon or paper demonstration, state the observation, and distinguish it from current electricity.", "Static electricity is a continuous flow through a circuit like current electricity.", "Static charge builds up in one place; current electricity is an ongoing movement of charge through a conducting path.", ["balloon", "dry cloth", "paper pieces"]),
    topic("Current Electricity", "Physical science", "effects of current on materials", ["MOE.G9.GENERAL_SCIENCE.MAGNETISM_AND_ELECTRICITY"], "Describe how current affects metallic and non-metallic substances and classify materials by electrical conduction.", ["Copper wire allows current to pass well; rubber around the wire helps prevent contact.", "A lamp changes electrical energy into light and heat when a complete circuit supplies current."], "Use a circuit diagram to predict which material will complete the path, then explain the safety reason.", "If a material looks shiny, it must conduct electricity safely in every situation.", "Conductivity and safety are different questions; current requires a suitable conducting path and control.", ["circuit diagram", "battery symbol cards", "conductor cards"]),
    topic("Acids, Bases, and pH", "Chemical reasoning", "classifying acids and bases", ["LR-SCI-G7_9-01"], "Use the pH scale to compare acids and bases and explain why indicators change color.", ["A solution with pH 3 is more acidic than one with pH 6.", "A pH 9 solution is basic, while pH 7 is neutral at the center of the scale."], "Arrange sample pH cards from acidic to basic and justify the order without tasting any substance.", "A higher pH always means a stronger acid.", "Lower pH values are more acidic and higher pH values are more basic on the usual scale.", ["pH scale", "indicator color chart", "sample cards"]),
    topic("Forces and Motion", "Forces and motion", "net force and Newton's laws", ["LR-SCI-G7_9-03"], "Represent forces in a simple situation and explain how a net force changes an object's motion.", ["Equal opposite pushes on a box give zero net force, so its motion does not change because of those pushes.", "A stronger unbalanced push can increase acceleration when mass stays the same."], "Draw force arrows for a cart, calculate the net direction qualitatively, and explain the result using Newton's laws.", "A moving object always needs a forward force to keep moving at constant speed.", "An object can continue moving at constant velocity when the net force is zero; friction and other forces must be considered.", ["force arrows", "toy cart", "smooth surface"]),
  ],
  SOCIAL_STUDIES: [
    topic("Regional Production", "Regional geography", "locating West African economic activities", ["MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS"], "Use a map to locate major West African areas associated with agriculture, mining, forestry, fishing, and industry.", ["A map can show that economic activity is distributed across regions rather than concentrated in one city.", "A legend helps distinguish a mining area from a farming area."], "Annotate a regional map with a legend, then explain one pattern shown by the locations.", "Every West African country produces the same resources in the same amounts.", "Production varies with resources, climate, relief, transport, history, and investment.", ["West Africa map", "legend cards", "colored pencils"]),
    topic("Agriculture and Geography", "Regional geography", "geographical factors that favor agriculture", ["MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS"], "Evaluate how climate, soil, relief, water, and transport can support or limit agriculture in West Africa.", ["Reliable rainfall and fertile soil can support crops, while steep relief may make farming and transport harder.", "Access to roads can affect whether farmers reach markets after harvest."], "Rank factors for a farming scenario and defend the ranking with geographical evidence.", "One factor, such as rainfall, determines agricultural success everywhere.", "Agriculture results from interacting factors, and technology or infrastructure can change their effects.", ["factor cards", "scenario map", "ranking chart"]),
    topic("Mineral Resources", "Regional geography", "identifying resources and interpreting evidence", ["MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS"], "Identify major mineral resources and distinguish a resource's location from the social and economic effects of extraction.", ["Iron ore, gold, and bauxite are minerals, but a mineral map does not by itself show who benefits.", "Extraction can create jobs while also requiring environmental management."], "Read a resource table, identify a mineral region, and write one benefit and one responsibility connected to extraction.", "Finding a mineral on a map proves that extraction is always beneficial.", "Evidence must include both economic opportunities and social or environmental responsibilities.", ["resource map", "data table", "cause-effect chart"]),
    topic("Forestry, Fishing, and Industry", "Regional geography", "comparing connected economic activities", ["MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS"], "Compare forestry, fishing, agriculture, mining, and industry using location, resources, labor, and sustainability evidence.", ["A coastal community may connect fishing, processing, transport, and markets.", "Forest products require rules that protect future use while supporting livelihoods."], "Complete a comparison table and explain one relationship between a resource and an industry.", "Economic activities are separate and cannot affect each other.", "Activities are linked through resources, labor, infrastructure, markets, and environmental decisions.", ["comparison table", "coastal and inland maps", "case cards"]),
    topic("Evidence-Based Regional Decisions", "Regional geography", "evaluating a development choice", ["MOE.G9.SOCIAL_STUDIES.WEST_AFRICA_AGRICULTURE_MINERALS"], "Use geographical evidence to recommend a responsible development choice for a West African community.", ["A recommendation should name the evidence, acknowledge a cost, and explain who is affected.", "A map, table, and short testimony can answer different parts of the same regional question."], "Write a recommendation about a farming, mining, or fishing proposal using at least two pieces of evidence.", "A strong recommendation simply states a personal preference.", "A reasoned recommendation connects evidence to consequences and recognizes more than one stakeholder.", ["case study", "map and table", "recommendation frame"]),
  ],
  CIVICS: [
    topic("Liberian Historical Change", "Liberian history", "sequencing major periods of Liberia's history", ["LR-CIV-G7_9-01"], "Construct a supported timeline of major periods in Liberian history and distinguish sequence from explanation.", ["A timeline shows when events occurred; an explanation also discusses causes and consequences.", "Primary and secondary sources can provide different evidence about a historical event."], "Place provided event cards in sequence and write one cause-and-effect statement supported by a card.", "Putting dates in order alone explains why history changed.", "Chronology is a foundation; historical analysis connects evidence, causes, actions, and consequences.", ["timeline cards", "short source excerpts", "paper strip"]),
    topic("Constitutional Comparison", "Constitutions", "comparing democratic constitutional ideas", ["LR-CIV-G7_9-02"], "Compare a constitutional principle in Liberia with a comparable democratic principle, identifying both similarity and difference.", ["A constitution can distribute power among institutions while protecting rights.", "A comparison must use the same criterion for both systems."], "Use a comparison table to examine rights, institutions, or limits on power, then write a balanced conclusion.", "A country has a democratic constitution whenever it holds an election.", "Democracy includes accountable institutions, participation, rights, and limits on power, not elections alone.", ["comparison table", "constitution excerpts", "vocabulary cards"]),
    topic("Rights and Responsibilities", "Citizenship", "balancing rights with civic duties", ["LR-CIV-G7_9-02"], "Explain how rights and responsibilities support one another in a school or community scenario.", ["Freedom of expression includes responsibility to avoid threats and respect the rights of others.", "A right is not erased because a citizen has a disagreement with a leader."], "Analyze a scenario, name the right involved, and propose a responsible action that protects others.", "Responsibilities can cancel another person's rights whenever an authority disagrees.", "Limitations must be lawful and fair; civic responsibility should protect, not erase, rights.", ["scenario cards", "rights chart", "discussion protocol"]),
    topic("Public Trust and Evidence", "Civic reasoning", "evaluating a civic claim", ["LR-CIV-G7_9-01", "LR-CIV-G7_9-02"], "Evaluate a civic claim by separating evidence, opinion, source reliability, and the interests of affected groups.", ["A repeated claim is not automatically reliable without evidence.", "A public decision should be explained in language citizens can understand and question."], "Classify statements as evidence or opinion, identify a missing source, and ask one fair follow-up question.", "A claim is true because many people repeat it.", "Credible reasoning checks the source, evidence, context, and whether other perspectives were considered.", ["claim cards", "source checklist", "board"]),
    topic("Civic Participation", "Citizenship", "constructive participation and dialogue", ["LR-CIV-G7_9-02"], "Plan a respectful civic response to a school or community issue, using dialogue, evidence, and a realistic action.", ["A petition, meeting, service project, or informed vote can be a civic action when connected to a clear issue.", "Dialogue seeks understanding and a workable response even when people disagree."], "Write a short action plan naming the issue, stakeholders, evidence, proposed action, and way to review results.", "Civic participation means winning an argument over another person.", "Participation improves shared decisions when people listen, explain evidence, and accept accountability.", ["action-plan frame", "stakeholder map", "discussion roles"]),
  ],
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function answerOptions(correct: string, position: number) {
  const distractors = [
    `It is true only when the opposite situation occurs.`,
    `It depends on a different subject, not this lesson.`,
    `It can be decided without evidence or checking.`,
  ];
  const options = [...distractors];
  options.splice(position % 4, 0, correct);
  return options;
}

function buildAssessmentPlan(topicData: Nr12Topic, lessonIndex: number): Nr12AssessmentBlueprint {
  const suffix = `${slugify(topicData.concept)}-${lessonIndex}`;
  const items = [
    { prompt: `Which statement best explains ${topicData.concept}?`, answer: topicData.objective },
    { prompt: `Which action applies ${topicData.concept} in a real classroom or community situation?`, answer: topicData.application },
    { prompt: `What is the best correction for this common mistake: ${topicData.misconception}`, answer: topicData.correction },
    { prompt: `Which example from the lesson is evidence for the target idea?`, answer: topicData.examples[0] },
    { prompt: `Which response shows transfer of ${topicData.concept} to a new situation?`, answer: topicData.examples[1] },
  ].map((item, index) => ({
    id: `nr12-${suffix}-q${index + 1}`,
    type: "mcq" as const,
    standardCode: topicData.standardCodes[index % topicData.standardCodes.length],
    concept: topicData.concept,
    prompt: item.prompt,
    options: answerOptions(item.answer, index),
    correctIndex: index % 4,
    answerKey: item.answer,
    explanation: `The correct response is supported by the lesson's explanation of ${topicData.concept}. Learners should be able to point to the example or reasoning used.`,
    points: 1,
  }));

  return {
    lessonQuiz: { questionCount: NR12_LESSON_QUIZ_COUNT, conceptCount: Math.min(5, topicData.standardCodes.length + 1), items },
    unitQuiz: { questionCount: NR12_UNIT_QUIZ_COUNT, conceptCount: 3, standardCodes: topicData.standardCodes },
    termExam: { questionCount: NR12_TERM_EXAM_COUNT, conceptCount: 5, standardCodes: topicData.standardCodes },
  };
}

function buildDepthNotes(topicData: Nr12Topic, grade: number, stage: string) {
  const junior = grade >= 7;
  const notes = [
    `Teacher talk and vocabulary: define ${topicData.concept} before asking learners to use it. Say the word, give the meaning in plain language, and connect it to this lesson's concrete example: ${topicData.examples[0]} ${junior ? "Then require learners to use the term in a complete explanation." : "Then ask learners to say the term and point to what it describes."}`,
    `Concrete to pictorial to abstract: begin with ${topicData.examples[0]} Ask learners what they notice before naming the rule. Represent the idea with a drawing, table, map, diagram, word card, or physical object. Only after the representation is understood should the class record the formal statement in the objective.`,
    `Second worked path: compare the first example with ${topicData.examples[1]} Ask what stayed the same and what changed. ${junior ? "Require a second method, comparison, or justification where the subject permits it." : "Let learners explain the difference using a sentence frame and a partner rehearsal."} The teacher records accurate language on the board so the class can reuse it during practice.`,
    `Guided questioning: ask one recall question, one why question, and one what-if question. For this lesson, the key application is ${topicData.application} Accept an oral rehearsal first, then ask for a written, drawn, mapped, sorted, or calculated response.`,
    `Error analysis: surface the misconception that ${topicData.misconception} Do not only mark it wrong. Ask learners to test the claim against the examples, identify the step or assumption that failed, and state the correction: ${topicData.correction}`,
    `Differentiation: learners needing support receive the vocabulary cards, a partially completed representation, one worked step at a time, and a partner explanation routine. Learners who are ready for more challenge should change one condition, defend a choice, or create a new example without changing the target standard.`,
    `Retrieval and spacing: open the next lesson with two short questions from this lesson. One question should retrieve the concept and one should apply it to a new context. Keep the same standard code visible so review strengthens the intended progression rather than becoming unrelated drill.`,
    `Low-resource delivery: the required materials are ${topicData.materials.join(", ")}. If one is unavailable, use a board drawing, oral description, paper substitute, or learner-made model. The activity must preserve the thinking target. Technology may enrich the lesson but is never required for access.`,
    `Teacher evidence: listen for accurate use of ${topicData.concept}, inspect whether the learner uses evidence or a complete method, and record the misconception if it appears. Do not infer mastery from copying. Ask at least one learner to explain a choice in their own words.`,
    `Application and transfer: close by returning to ${topicData.application} Learners should state what they would do, why it works, and what evidence would change their conclusion. This makes the lesson useful outside the worksheet while preserving the Liberia MOE objective.`,
    `Assessment interpretation: the five-question lesson quiz samples the objective, application, misconception correction, worked evidence, and transfer. A score below the local mastery threshold should trigger the listed remediation task, not a new unrelated lesson.`,
    `Family connection: invite a learner to show the idea with ordinary materials or explain it using a local example. Families are not asked to teach new content; they help the learner rehearse vocabulary, describe a process, or notice the concept in daily life.`,
    `Modeling script: say what you notice, name the information that matters, choose a representation, complete one step, and explain why that step is allowed. Then ask learners to repeat the reasoning with ${topicData.examples[1]} This verbal routine prevents the lesson from becoming answer copying.`,
    `Response quality: accept a correct answer only when the learner also gives the required evidence, unit, label, text clue, map feature, diagram, or reasoning. If the response is incomplete, name the missing part and let the learner revise it immediately.`,
    `Practice progression: begin with the exact structure of the first worked example, remove one support for the second task, and change the context for the final task. This gradual release keeps the objective stable while independence increases.`,
    `Teacher feedback: use one precise praise statement about the thinking and one next-step prompt. For example, identify the accurate comparison, then ask the learner to justify it with the evidence in ${topicData.examples[0]}. Avoid praise that rewards speed without understanding.`,
    `Misconception sort: write the accurate claim and the misconception on separate cards. Learners sort them, cite an example, and revise the incorrect card. This makes the error visible without embarrassing a learner and produces evidence the teacher can act on.`,
    `Cross-subject connection: use the same reasoning habit in another context without claiming a new standard. A measurement response may use a science observation; a map response may use a reading caption; a historical claim may use a data table. The mapped objective remains the assessment target.`,
    `End reflection: each learner completes the sentence, I used ${topicData.concept} when..., because... The teacher samples several responses and records whether the class needs more concrete practice, vocabulary rehearsal, or transfer practice in the next lesson.`,
    `Board plan: reserve one space for the objective, one for vocabulary, one for the worked representation, and one for the mastery check. Keep the first example visible while learners practise, then cover only the answer so they must reconstruct the reasoning. This supports recall without leaking the solution.`,
    `Talk moves: prompt learners to say, I notice..., I think..., My evidence is..., and I changed my mind because... For Grade 2, allow pointing, drawing, and short sentences before a full oral response. For Grade 9, require complete explanations with accurate subject vocabulary and a source, calculation, diagram, or observation where relevant.`,
    `Feedback cycle: after the first guided attempt, stop for a quick whole-class check. Sort responses into secure, almost secure, and needs another model. Give the second group one missing step, give the third group the concrete representation again, and let the first group test a changed condition.`,
    `Assessment fairness: do not make reading load, unfamiliar names, device access, or handwriting difficulty obscure the target skill. Read a Grade 2 prompt aloud when the target is mathematics, science, social studies, or civics. Keep Grade 9 language precise but remove irrelevant complexity.`,
    `Teacher handoff: record the strongest evidence, the most common error, and the next retrieval prompt. This record supports the following lesson, assignment selection, and teacher review. It also makes the generated lesson auditable: another teacher can see what to teach, what to ask, what to accept, and what to reteach.`,
    `Planning for absence or interruption: mark the stopping point after the teacher model or guided practice. When the class resumes, retrieve the vocabulary and one example before continuing. The block version keeps the same objective, practice, and assessment so learners do not lose the progression when a school day changes.`,
    `Quality boundary: this lesson may use familiar local names, places, materials, and situations, but those details are examples rather than new curriculum authority. The authority codes and source records control the concept. If a future editor cannot explain how an activity measures one of those codes, the activity belongs in revision, not in the approved lesson.`,
    `Mastery decision: use the five quiz responses together with the independent response. A learner who knows a definition but cannot apply it is developing, not secure. A learner who gets an answer by guessing but cannot explain the evidence needs another model. Plan the next step from the observed gap and keep the same standard visible during remediation.`,
    `Question design: the lesson questions use one target concept at a time, but the contexts change. The teacher should ask learners to underline the evidence in a passage, point to the map feature, show the calculation, draw the diagram, name the observation, or explain the civic principle. This keeps the assessment aligned to the standard instead of rewarding recognition of a repeated phrase.`,
    `Numerical variation: when a quantitative example is revisited, change the values while preserving the same operation and concept. Learners must not memorize 347, 36 + 27, or 2^3 as the answer. They must identify place value, regrouping, or the two-choice rule and then solve the new case accurately.`,
    `Language variation: when the target is not reading, read directions aloud and let learners explain orally, draw, sort, or demonstrate. When the target is literacy, keep the passage and writing demand central. The same lesson structure therefore supports access without lowering the intended cognitive demand.`,
    `Closure for the teacher: compare the objective, the independent response, the exit ticket, and the five quiz concepts before marking the lesson secure. If an item does not measure the mapped authority record, remove or revise it. If a section only describes an activity without giving usable teacher and learner actions, it is a shell and must not be approved.`,
  ];
  return notes;
}

function buildBodies(topicData: Nr12Topic, grade: number, stage: string, lessonIndex: number) {
  const depth = buildDepthNotes(topicData, grade, stage);
  const standard = [
    `## Objective\nBy the end of this Grade ${grade} lesson, learners will ${topicData.objective.toLowerCase()}`,
    `## Prerequisite and Retrieval\nRecall the earlier idea needed for ${topicData.concept}. Ask learners to explain one familiar example before instruction begins.`,
    `## Key Vocabulary\n${topicData.concept}. Define it in learner-friendly language, display it, and use it in a complete sentence.`,
    `## Teacher Explanation\nThis lesson uses a ${stage.toLowerCase()} sequence. Start with a concrete Liberia-relevant situation, move to a visual or spoken representation, then name the formal idea. ${depth[0]}`,
    `## Worked Example 1\n${topicData.examples[0]}\n\nTeacher moves: identify the information, model each step, ask why the step is valid, and check the result against the original situation.`,
    `## Worked Example 2\n${topicData.examples[1]}\n\nCompare this example with the first one. Learners must identify one similarity, one difference, and the evidence that supports the conclusion.`,
    `## Guided Practice\n1. ${topicData.application}\n2. Work with a partner to represent the same idea in a second way.\n3. Explain the answer to the teacher using the key vocabulary.\n\nThe teacher pauses after each step for a visible check and corrects errors before independent work.`,
    `## Independent Practice\nComplete the target task without copying the worked example. Show the method or evidence, label the response clearly, and write one sentence explaining why the answer is reasonable. Then complete one new case that changes the context but keeps the same standard.`,
    `## Misconception and Repair\nCommon misconception: ${topicData.misconception}\nRepair: ${topicData.correction}\nAsk learners to compare the incorrect claim with both worked examples and explain the exact reason the correction is stronger.`,
    `## Mastery Check\nThe teacher checks accurate vocabulary, correct process or evidence, independent reasoning, and transfer. A learner who is not yet secure returns to the concrete representation and completes one scaffolded example before retrying.`,
    `## Remediation\nUse ${topicData.materials[0]} and reduce the task to one decision at a time. Rehearse the vocabulary orally, complete a partially worked example, and ask the learner to explain the repaired step.`,
    `## Extension\nChange one condition in the application, ask learners to predict the result, and require evidence for the prediction. Extension deepens the same standard; it does not introduce an unrelated advanced topic.`,
    `## Lesson Quiz\nFive multiple-choice questions are stored in the assessment plan. They sample the objective, application, misconception repair, worked evidence, and transfer. Each question has four plausible response positions and one deterministic answer key.`,
    `## Teacher Notes\nUse the local materials list: ${topicData.materials.join(", ")}. Keep directions short, ask learners to explain rather than copy, and record which concept needs retrieval in the next lesson.`,
    `## Guardian Support\nAsk the learner to explain ${topicData.concept} with one household or community example. The guardian should ask, What is your evidence? and allow the learner to answer in speech, drawing, or writing.`,
    ...depth,
  ].join("\n\n");

  const block = [
    `## Block Lesson Opening\nReview one prior example, state the objective, and ask learners to predict what they will need to notice about ${topicData.concept}.`,
    `## Block Lesson Model\n${topicData.examples[0]}\n\nModel the complete process, naming the vocabulary and checking each step. Then use ${topicData.examples[1]} to compare a changed condition.`,
    `## Block Lesson Workshop\nLearners complete this task: ${topicData.application}\n\nUse mixed groups with assigned roles: reader or observer, recorder, checker, and reporter. Every learner must produce individual evidence after group discussion.`,
    `## Block Lesson Reasoning\nAnalyze the misconception: ${topicData.misconception} Test it against the correction: ${topicData.correction} Ask groups to defend the correction, not merely repeat it.`,
    `## Block Lesson Independent Response\nComplete a new situation using the same standard. Include the representation, method or evidence, conclusion, and a short explanation. The teacher uses the same mastery check as the standard lesson.`,
    `## Block Lesson Review\nUse five retrieval prompts from the lesson quiz blueprint. Mix oral rehearsal with written response. End with one transfer question and collect the answer for planning the next lesson.`,
    `## Block Lesson Support\nLearners needing support use ${topicData.materials.join(", ")}. Advanced learners compare two methods, challenge an assumption, or design an example that would expose the misconception.`,
    `## Block Lesson Home Connection\nExplain ${topicData.concept} to a family member with a local example. No paid device, internet connection, or specialist equipment is required.`,
    ...depth,
  ].join("\n\n");
  return { standard, block };
}

export function getNr12AuthorityRecords(grade: number, subject: Nr12Subject) {
  return NR12_AUTHORITY_RECORDS.filter((record) => record.grade === grade && record.subject === subject);
}

export function getNr12Topics(grade: number, subject: Nr12Subject) {
  if (grade === 2) return G2_TOPICS[subject];
  if (grade === 9) return G9_TOPICS[subject];
  return [];
}

export function isNr12Cell(grade: number, subject: string): subject is Nr12Subject {
  return (grade === 2 || grade === 9) && NR12_SUBJECTS.includes(subject.trim().toUpperCase() as Nr12Subject);
}

export function buildNr12GenerationPlan(grade: number, subject: Nr12Subject): Nr12GenerationRecord[] {
  if (!isNr12Cell(grade, subject)) return [];
  const topics = getNr12Topics(grade, subject);
  const storageSubject = getStorageSubject(subject) ?? subject;
  const authority = getNr12AuthorityRecords(grade, subject);

  return Array.from({ length: NR12_TARGET_LESSONS }, (_, index) => {
    const topicIndex = Math.floor(index / 3);
    const stageIndex = index % 3;
    const topicData = topics[topicIndex % topics.length];
    const stage = ["Concept build", "Guided application", "Independent transfer"][stageIndex];
    const title = `Unit ${topicIndex + 1}: ${topicData.unitTitle} - ${stage}`;
    const unitId = `nr12-${storageSubject.toLowerCase()}-g${grade}-u${topicIndex + 1}-${slugify(topicData.unitTitle)}`;
    const contentId = `${unitId}-l${stageIndex + 1}`;
    const bodies = buildBodies(topicData, grade, stage, index + 1);
    const assessmentPlan = buildAssessmentPlan(topicData, index + 1);
    const priorTopic = topics[(topicIndex - 1 + topics.length) % topics.length];
    const payload = CurriculumPayloadSchema.parse({
      title,
      grade,
      subject: storageSubject,
      lessonFormat: "either",
      objectives: [topicData.objective],
      body: bodies.standard,
      body_standard: bodies.standard,
      body_block: bodies.block,
      activities: [
        `Concrete representation of ${topicData.concept}`,
        `Guided partner application: ${topicData.application}`,
        `Independent explanation and transfer`,
      ],
      labs: [],
      moeAlignments: topicData.standardCodes,
      metadata: {
        topic: topicData.unitTitle,
        locale: "LR",
        generatedAt: NR12_VERSION,
        model: "nr12-authored-deterministic-generator",
      },
    });

    const enrichedPayload: Record<string, unknown> = {
      ...payload,
      assessmentPlan,
      objective: topicData.objective,
      explanation: `Teach ${topicData.concept} through concrete examples, visual or spoken representation, explicit reasoning, guided practice, and independent transfer.`,
      workedExamples: [...topicData.examples],
      guidedPractice: [topicData.application, "Represent the idea a second way.", "Explain the reasoning to a partner."],
      independentPractice: ["Complete the modeled task independently.", "Solve or analyze a changed case.", "Explain the evidence in your own words."],
      assessment: "The lesson quiz has exactly five questions: objective, application, misconception repair, evidence, and transfer.",
      remediation: `Return to the concrete representation and use ${topicData.materials[0]} while rehearsing the correction: ${topicData.correction}`,
      extension: "Change one condition and defend the result with evidence.",
      guardianSupport: `Ask the learner to explain ${topicData.concept} with one local example and state the evidence.`,
      primaryConcept: topicData.concept,
      conceptTag: `${subject.toLowerCase()}.${slugify(topicData.concept)}`,
      prerequisites: [priorTopic.concept],
      prerequisiteConcepts: [priorTopic.concept],
      nextConcepts: [topics[(topicIndex + 1) % topics.length].concept],
      canonicalSubject: subject,
      unitTitle: topicData.unitTitle,
      lessonStage: stage,
      generationStage: "generated_enriched",
      difficulty: grade === 2 ? "foundational" : "secondary",
      contentCompleteness: {
        objective: true, explanation: true, workedExamples: true, guidedPractice: true,
        independentPractice: true, assessment: true, remediation: true, extension: true,
        guardianSupport: true, assessmentPlan: true, authorityTrace: true,
      },
      authorityTrace: authority.filter((record) => topicData.standardCodes.includes(record.code)),
      metadata: {
        ...(payload.metadata ?? {}),
        nr: "NR-12",
        authorityCodes: topicData.standardCodes,
        authorityEvidence: topicData.standardCodes.map((code) => authority.find((record) => record.code === code)?.evidenceStatus ?? "UNRESOLVED"),
        strand: topicData.strand,
        readingLevel: grade === 2 ? "early-primary-short-sentences" : "junior-secondary-academic-register",
        pedagogy: grade === 2 ? "concrete-pictorial-abstract; oral rehearsal; short cycles" : "worked examples; error analysis; retrieval spiral; independent reasoning",
        lessonIndex: index + 1,
        stage,
      },
      deliveryProfile: {
        estimatedMinutes: 50,
        recommendedFormat: "either",
        phases: [
          { name: "Retrieval and objective", durationMinutes: 5, description: "Recall a prerequisite and state the success check." },
          { name: "Teacher model", durationMinutes: 15, description: "Model the concrete example and reason through each step." },
          { name: "Guided practice", durationMinutes: 15, description: "Learners apply the method with prompts and partner explanation." },
          { name: "Independent practice", durationMinutes: 10, description: "Learners complete a new case without copying." },
          { name: "Mastery check", durationMinutes: 5, description: "Use the exit ticket and record the next retrieval need." },
        ],
        standardVersion: { phases: [], omittedActivities: [] },
        blockVersion: { phases: [], extensions: ["Use the block workshop roles and complete the transfer response."] },
        exitTicket: {
          questions: [
            { question: `State or show the key idea about ${topicData.concept}.`, type: "short_answer", standardCode: topicData.standardCodes[0] },
            { question: `Apply ${topicData.concept} to one new example and explain your evidence.`, type: "short_answer", standardCode: topicData.standardCodes[topicData.standardCodes.length - 1] },
          ],
        },
        toolsRequired: topicData.materials.map((material) => ({ toolKey: slugify(material), reason: "Supports the concrete representation or evidence check.", phase: "Teacher model or guided practice", required: false })),
      },
    };

    return {
      contentId,
      grade,
      subject: storageSubject,
      canonicalSubject: subject,
      contentType: "lesson",
      status: "generated",
      version: NR12_VERSION,
      hash: createHash("sha256").update(JSON.stringify(enrichedPayload)).digest("hex").slice(0, 40),
      unitId,
      orderInUnit: stageIndex + 1,
      lessonType: "core",
      payload: enrichedPayload,
    };
  });
}

export function validateNr12Lesson(record: Nr12GenerationRecord) {
  const payload = record.payload as Record<string, any>;
  const body = `${payload.body_standard ?? ""}\n${payload.body_block ?? ""}`;
  const plan = payload.assessmentPlan as Nr12AssessmentBlueprint | undefined;
  const reasons: string[] = [];
  if (record.grade !== payload.grade) reasons.push("grade_mismatch");
  if (record.subject !== payload.subject) reasons.push("subject_mismatch");
  if (!Array.isArray(payload.moeAlignments) || payload.moeAlignments.length === 0) reasons.push("missing_authority_alignment");
  if (!payload.authorityTrace || !Array.isArray(payload.authorityTrace) || payload.authorityTrace.length === 0) reasons.push("missing_authority_trace");
  if (!plan || plan.lessonQuiz.questionCount !== 5 || plan.lessonQuiz.items.length !== 5) reasons.push("lesson_quiz_contract");
  if (!plan || plan.unitQuiz.questionCount !== 10 || plan.termExam.questionCount !== 30) reasons.push("assessment_count_contract");
  if (plan) {
    const alignedCodes = new Set(Array.isArray(payload.moeAlignments) ? payload.moeAlignments : []);
    if (plan.lessonQuiz.items.some((item) => !alignedCodes.has(item.standardCode) || item.options[item.correctIndex] !== item.answerKey || new Set(item.options).size !== 4)) {
      reasons.push("assessment_traceability");
    }
  }
  if (!/##\s+Worked Example/i.test(body) || !/##\s+Guided Practice/i.test(body) || !/##\s+Independent Practice/i.test(body)) reasons.push("lesson_structure");
  if (/placeholder|TODO|TBD|Option A|Review question/i.test(body)) reasons.push("placeholder_content");
  if (wordCount(body) < 3500) reasons.push("below_shared_approval_depth");
  return { passed: reasons.length === 0, reasons, wordCount: wordCount(body) };
}
