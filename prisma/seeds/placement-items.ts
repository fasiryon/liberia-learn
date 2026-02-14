// prisma/seeds/placement-items.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITEMS = [
  // ── MATH (10 items) ──
  {
    subject: "MATH" as const, band: "G1_3" as const, difficulty: "D1" as const,
    stimulus: "A trader buys 24 oranges for $12. What is the cost of one orange?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) $0.25", "B) $0.50", "C) $1.00", "D) $2.00"] },
    hints: ["Divide the total cost by the number of oranges", "12 divided by 24"],
  },
  {
    subject: "MATH" as const, band: "G1_3" as const, difficulty: "D2" as const,
    stimulus: "What is 47 + 35?",
    itemType: "MCQ" as const,
    answerKey: { correct: "C", options: ["A) 72", "B) 80", "C) 82", "D) 92"] },
    hints: ["Add the ones first: 7 + 5", "Remember to carry over"],
  },
  {
    subject: "MATH" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "A market woman sells 3/4 of her cassava. She started with 80 kg. How many kg did she sell?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) 60 kg", "B) 40 kg", "C) 20 kg", "D) 75 kg"] },
    hints: ["Find 3/4 of 80", "Multiply 80 by 3, then divide by 4"],
  },
  {
    subject: "MATH" as const, band: "G4_6" as const, difficulty: "D3" as const,
    stimulus: "A rectangular garden is 12 meters long and 8 meters wide. What is the area?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) 40 m²", "B) 96 m²", "C) 20 m²", "D) 80 m²"] },
    hints: ["Area = length × width", "Multiply 12 by 8"],
  },
  {
    subject: "MATH" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "Solve for x: 3x + 7 = 22",
    itemType: "MCQ" as const,
    answerKey: { correct: "C", options: ["A) x = 3", "B) x = 7", "C) x = 5", "D) x = 10"] },
    hints: ["First subtract 7 from both sides", "Then divide both sides by 3"],
  },
  {
    subject: "MATH" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "A shopkeeper increases prices by 15%. If rice costs $200, what is the new price?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) $230", "B) $215", "C) $250", "D) $300"] },
    hints: ["Calculate 15% of 200", "Add that to the original price"],
  },
  {
    subject: "MATH" as const, band: "G7_9" as const, difficulty: "D4" as const,
    stimulus: "A right triangle has legs of 6 cm and 8 cm. What is the hypotenuse?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) 12 cm", "B) 10 cm", "C) 14 cm", "D) 7 cm"] },
    hints: ["Use the Pythagorean theorem: a² + b² = c²", "6² + 8² = 36 + 64 = 100"],
  },
  {
    subject: "MATH" as const, band: "G10_12" as const, difficulty: "D4" as const,
    stimulus: "Solve: x² - 5x + 6 = 0",
    itemType: "MCQ" as const,
    answerKey: { correct: "D", options: ["A) x = 1, 6", "B) x = -2, -3", "C) x = 5, 6", "D) x = 2, 3"] },
    hints: ["Factor the quadratic", "Find two numbers that multiply to 6 and add to -5"],
  },
  {
    subject: "MATH" as const, band: "G10_12" as const, difficulty: "D4" as const,
    stimulus: "What is the probability of rolling an even number on a fair six-sided die?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) 1/3", "B) 1/2", "C) 2/3", "D) 1/6"] },
    hints: ["Count even numbers: 2, 4, 6", "Divide favorable outcomes by total outcomes"],
  },
  {
    subject: "MATH" as const, band: "G10_12" as const, difficulty: "D5" as const,
    stimulus: "If $500 is invested at 8% annual compound interest, what is the amount after 2 years?",
    itemType: "FR" as const,
    answerKey: { correct: "$583.20" },
    hints: ["Use A = P(1 + r)^n", "P = 500, r = 0.08, n = 2"],
  },

  // ── SCIENCE (6 items) ──
  {
    subject: "SCIENCE" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "Which of the following is NOT a stage of the water cycle?",
    itemType: "MCQ" as const,
    answerKey: { correct: "D", options: ["A) Evaporation", "B) Condensation", "C) Precipitation", "D) Photosynthesis"] },
    hints: ["Think about what happens to water in nature", "One of these is about plants making food"],
  },
  {
    subject: "SCIENCE" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "What organ pumps blood throughout the human body?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) Heart", "B) Lungs", "C) Brain", "D) Liver"] },
    hints: ["It is in your chest", "You can feel it beat"],
  },
  {
    subject: "SCIENCE" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "What is the chemical formula for water?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) CO2", "B) H2O", "C) NaCl", "D) O2"] },
    hints: ["Water is made of hydrogen and oxygen", "Two hydrogen atoms and one oxygen atom"],
  },
  {
    subject: "SCIENCE" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "Explain why Liberia's tropical rainforest is important for biodiversity.",
    itemType: "FR" as const,
    answerKey: { correct: "Liberia's rainforest provides habitat for thousands of species, helps regulate climate, and is part of the Upper Guinean forest ecosystem" },
    hints: ["Think about habitat, species, and climate", "Consider the rainforest's role in West Africa"],
  },
  {
    subject: "SCIENCE" as const, band: "G10_12" as const, difficulty: "D4" as const,
    stimulus: "Which law of motion explains why passengers lurch forward when a bus stops suddenly?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) Newton's First Law (Inertia)", "B) Newton's Second Law", "C) Newton's Third Law", "D) Law of Conservation of Energy"] },
    hints: ["An object in motion tends to stay in motion", "This is about inertia"],
  },
  {
    subject: "SCIENCE" as const, band: "G10_12" as const, difficulty: "D5" as const,
    stimulus: "Describe the role of mitosis and meiosis in human growth and reproduction.",
    itemType: "FR" as const,
    answerKey: { correct: "Mitosis produces identical cells for growth and repair (2n→2n). Meiosis produces gametes with half the chromosomes (2n→n) for sexual reproduction." },
    hints: ["Mitosis = growth, Meiosis = reproduction", "Think about chromosome numbers"],
  },

  // ── LITERACY (6 items) ──
  {
    subject: "LITERACY" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "Read: 'The farmer worked hard all day under the hot Liberian sun.' What is the main idea?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) A farmer works hard in the heat", "B) The sun is hot in Liberia", "C) Farmers like the sun", "D) Liberia is a hot country"] },
    hints: ["Focus on what the sentence is mostly about", "Who is doing what?"],
  },
  {
    subject: "LITERACY" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "Which word is a synonym for 'happy'?",
    itemType: "MCQ" as const,
    answerKey: { correct: "C", options: ["A) Sad", "B) Angry", "C) Joyful", "D) Tired"] },
    hints: ["A synonym means a word with a similar meaning", "Which word also means feeling good?"],
  },
  {
    subject: "LITERACY" as const, band: "G4_6" as const, difficulty: "D3" as const,
    stimulus: "Write a paragraph about your favorite place in Liberia and explain why it is special to you.",
    itemType: "FR" as const,
    answerKey: { correct: "A well-structured paragraph with a topic sentence, supporting details about a Liberian location, and a concluding sentence" },
    hints: ["Start with a topic sentence", "Give at least two reasons why it's special"],
  },
  {
    subject: "LITERACY" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "'The river was a silver ribbon under the moonlight.' What literary device is used?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) Simile", "B) Metaphor", "C) Alliteration", "D) Onomatopoeia"] },
    hints: ["Is it comparing two things directly or using 'like/as'?", "The river IS called a ribbon"],
  },
  {
    subject: "LITERACY" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "Write a persuasive paragraph arguing whether school uniforms should be required in Liberian schools.",
    itemType: "FR" as const,
    answerKey: { correct: "A clear claim/thesis, at least two supporting reasons with evidence, and a concluding statement" },
    hints: ["State your opinion clearly", "Give reasons to support your argument"],
  },
  {
    subject: "LITERACY" as const, band: "G7_9" as const, difficulty: "D4" as const,
    stimulus: "What is the purpose of a bibliography in a research paper?",
    itemType: "MCQ" as const,
    answerKey: { correct: "C", options: ["A) To summarize the paper", "B) To introduce the topic", "C) To list sources used in the research", "D) To state the conclusion"] },
    hints: ["Think about giving credit to sources", "Where do you list books and articles you used?"],
  },

  // ── CIVICS (4 items) ──
  {
    subject: "CIVICS" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "What is the capital city of Liberia?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) Monrovia", "B) Buchanan", "C) Gbarnga", "D) Harper"] },
    hints: ["It is the largest city in Liberia", "It was named after a U.S. president"],
  },
  {
    subject: "CIVICS" as const, band: "G4_6" as const, difficulty: "D2" as const,
    stimulus: "How many counties does Liberia have?",
    itemType: "MCQ" as const,
    answerKey: { correct: "C", options: ["A) 10", "B) 12", "C) 15", "D) 20"] },
    hints: ["Count the administrative divisions of Liberia", "It's between 10 and 20"],
  },
  {
    subject: "CIVICS" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "In what year was Liberia founded as a republic?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) 1822", "B) 1847", "C) 1960", "D) 1989"] },
    hints: ["Liberia was one of the first African republics", "It was in the 19th century"],
  },
  {
    subject: "CIVICS" as const, band: "G7_9" as const, difficulty: "D4" as const,
    stimulus: "Explain the role of the Liberian Senate in the government.",
    itemType: "FR" as const,
    answerKey: { correct: "The Senate is the upper house of the Legislature. It has 30 members (2 per county), makes laws, confirms presidential appointments, and ratifies treaties." },
    hints: ["The Senate is part of the Legislature", "Each county sends 2 senators"],
  },

  // ── COMPUTER_SCIENCE (4 items) ──
  {
    subject: "COMPUTER_SCIENCE" as const, band: "G7_9" as const, difficulty: "D2" as const,
    stimulus: "What does CPU stand for?",
    itemType: "MCQ" as const,
    answerKey: { correct: "A", options: ["A) Central Processing Unit", "B) Computer Personal Unit", "C) Central Program Utility", "D) Computer Processing Utility"] },
    hints: ["It is the 'brain' of the computer", "Each word starts with C, P, U"],
  },
  {
    subject: "COMPUTER_SCIENCE" as const, band: "G7_9" as const, difficulty: "D3" as const,
    stimulus: "In programming, what is a 'loop' used for?",
    itemType: "MCQ" as const,
    answerKey: { correct: "B", options: ["A) To stop a program", "B) To repeat a set of instructions", "C) To store data", "D) To connect to the internet"] },
    hints: ["Think about doing something over and over", "It repeats code multiple times"],
  },
  {
    subject: "COMPUTER_SCIENCE" as const, band: "G10_12" as const, difficulty: "D4" as const,
    stimulus: "What is the difference between an array and a linked list?",
    itemType: "FR" as const,
    answerKey: { correct: "An array stores elements in contiguous memory with O(1) access by index. A linked list stores elements in nodes with pointers, allowing O(1) insertion/deletion but O(n) access." },
    hints: ["Think about how data is stored in memory", "Consider access time vs insertion time"],
  },
  {
    subject: "COMPUTER_SCIENCE" as const, band: "G10_12" as const, difficulty: "D4" as const,
    stimulus: "Write a SQL query to select all students with a score above 80 from a table called 'results'.",
    itemType: "FR" as const,
    answerKey: { correct: "SELECT * FROM results WHERE score > 80;" },
    hints: ["Use SELECT, FROM, and WHERE", "The condition is score > 80"],
  },
];

async function main() {
  console.log(`Seeding ${ITEMS.length} placement items...`);

  for (const item of ITEMS) {
    const skillId = `placement-skill-${item.subject}-${item.band}`;

    // Upsert the skill
    await prisma.skill.upsert({
      where: { id: skillId },
      update: {},
      create: {
        id: skillId,
        subject: item.subject,
        band: item.band,
        descriptor: `Placement skill for ${item.subject} ${item.band}`,
      },
    });

    // Create the practice item
    await prisma.practiceItem.create({
      data: {
        skillId,
        stimulus: item.stimulus,
        itemType: item.itemType,
        difficulty: item.difficulty,
        answerKey: item.answerKey as any,
        hints: item.hints as any,
      },
    });
  }

  console.log(`Done. ${ITEMS.length} placement items created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
