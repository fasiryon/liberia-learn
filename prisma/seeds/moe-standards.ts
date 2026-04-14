// prisma/seeds/moe-standards.ts
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "url";

const prisma = new PrismaClient();

export const MOE_STANDARDS = [
  // ── MATH G1_3 ──
  { code: "LR-MATH-G1_3-01", description: "Count, read, and write whole numbers up to 1,000; understand place value to hundreds", subject: "MATH" as const, band: "G1_3" as const },
  { code: "LR-MATH-G1_3-02", description: "Add and subtract whole numbers up to 100 with and without regrouping", subject: "MATH" as const, band: "G1_3" as const },
  { code: "LR-MATH-G1_3-03", description: "Identify and describe basic geometric shapes (circle, square, triangle, rectangle)", subject: "MATH" as const, band: "G1_3" as const },
  { code: "LR-MATH-G1_3-04", description: "Measure length using non-standard and standard units (centimeters, meters)", subject: "MATH" as const, band: "G1_3" as const },
  { code: "LR-MATH-G1_3-05", description: "Tell time to the hour and half-hour; identify days of the week and months", subject: "MATH" as const, band: "G1_3" as const },

  // ── MATH G4_6 ──
  { code: "LR-MATH-G4_6-01", description: "Multiply and divide multi-digit whole numbers; understand factors and multiples", subject: "MATH" as const, band: "G4_6" as const },
  { code: "LR-MATH-G4_6-02", description: "Add, subtract, and compare fractions and decimals", subject: "MATH" as const, band: "G4_6" as const },
  { code: "LR-MATH-G4_6-03", description: "Calculate perimeter and area of rectangles and triangles", subject: "MATH" as const, band: "G4_6" as const },
  { code: "LR-MATH-G4_6-04", description: "Interpret and create bar graphs, line graphs, and pictographs using local data", subject: "MATH" as const, band: "G4_6" as const },
  { code: "LR-MATH-G4_6-05", description: "Solve word problems involving money (Liberian dollars) and everyday transactions", subject: "MATH" as const, band: "G4_6" as const },

  // ── MATH G7_9 ──
  { code: "LR-MATH-G7_9-01", description: "Solve linear equations and inequalities in one variable", subject: "MATH" as const, band: "G7_9" as const },
  { code: "LR-MATH-G7_9-02", description: "Understand and apply ratios, proportions, and percentages in real-world contexts", subject: "MATH" as const, band: "G7_9" as const },
  { code: "LR-MATH-G7_9-03", description: "Calculate surface area and volume of prisms, cylinders, and cones", subject: "MATH" as const, band: "G7_9" as const },
  { code: "LR-MATH-G7_9-04", description: "Apply the Pythagorean theorem and basic trigonometric ratios", subject: "MATH" as const, band: "G7_9" as const },
  { code: "LR-MATH-G7_9-05", description: "Collect, organize, and interpret statistical data; calculate mean, median, and mode", subject: "MATH" as const, band: "G7_9" as const },

  // ── MATH G10_12 ──
  { code: "LR-MATH-G10_12-01", description: "Solve quadratic equations by factoring, completing the square, and the quadratic formula", subject: "MATH" as const, band: "G10_12" as const },
  { code: "LR-MATH-G10_12-02", description: "Analyze functions (linear, quadratic, exponential) and their graphs", subject: "MATH" as const, band: "G10_12" as const },
  { code: "LR-MATH-G10_12-03", description: "Apply probability concepts to real-world situations including compound events", subject: "MATH" as const, band: "G10_12" as const },
  { code: "LR-MATH-G10_12-04", description: "Understand sequences, series, and basic financial mathematics (interest, loans)", subject: "MATH" as const, band: "G10_12" as const },
  { code: "LR-MATH-G10_12-05", description: "Use matrices and vectors for solving systems of equations", subject: "MATH" as const, band: "G10_12" as const },

  // ── SCIENCE G1_3 ──
  { code: "LR-SCI-G1_3-01", description: "Identify living and non-living things in the local environment", subject: "SCIENCE" as const, band: "G1_3" as const },
  { code: "LR-SCI-G1_3-02", description: "Describe the basic needs of plants and animals (water, food, shelter, air)", subject: "SCIENCE" as const, band: "G1_3" as const },
  { code: "LR-SCI-G1_3-03", description: "Observe and describe weather patterns and seasonal changes in Liberia", subject: "SCIENCE" as const, band: "G1_3" as const },

  // ── SCIENCE G4_6 ──
  { code: "LR-SCI-G4_6-01", description: "Explain the water cycle and its importance to Liberian agriculture", subject: "SCIENCE" as const, band: "G4_6" as const },
  { code: "LR-SCI-G4_6-02", description: "Describe the structure and function of major human body systems", subject: "SCIENCE" as const, band: "G4_6" as const },
  { code: "LR-SCI-G4_6-03", description: "Identify simple machines and explain how they make work easier", subject: "SCIENCE" as const, band: "G4_6" as const },

  // ── SCIENCE G7_9 ──
  { code: "LR-SCI-G7_9-01", description: "Explain chemical reactions, acids, bases, and the pH scale", subject: "SCIENCE" as const, band: "G7_9" as const },
  { code: "LR-SCI-G7_9-02", description: "Describe cell structure, cell division, and basic genetics", subject: "SCIENCE" as const, band: "G7_9" as const },
  { code: "LR-SCI-G7_9-03", description: "Understand forces, motion, and Newton's laws of motion", subject: "SCIENCE" as const, band: "G7_9" as const },

  // ── SCIENCE G10_12 ──
  { code: "LR-SCI-G10_12-01", description: "Analyze ecosystem dynamics, biodiversity, and conservation in Liberia's rainforests", subject: "SCIENCE" as const, band: "G10_12" as const },
  { code: "LR-SCI-G10_12-02", description: "Apply principles of electricity, magnetism, and electromagnetic waves", subject: "SCIENCE" as const, band: "G10_12" as const },

  // ── LITERACY G1_3 ──
  { code: "LR-LIT-G1_3-01", description: "Recognize and produce letter sounds (phonemic awareness) in English", subject: "LITERACY" as const, band: "G1_3" as const },
  { code: "LR-LIT-G1_3-02", description: "Read and comprehend grade-level texts with fluency", subject: "LITERACY" as const, band: "G1_3" as const },
  { code: "LR-LIT-G1_3-03", description: "Write simple sentences and short paragraphs using correct grammar", subject: "LITERACY" as const, band: "G1_3" as const },

  // ── LITERACY G4_6 ──
  { code: "LR-LIT-G4_6-01", description: "Read and summarize fiction and non-fiction texts; identify main idea and details", subject: "LITERACY" as const, band: "G4_6" as const },
  { code: "LR-LIT-G4_6-02", description: "Write organized multi-paragraph essays with introduction, body, and conclusion", subject: "LITERACY" as const, band: "G4_6" as const },
  { code: "LR-LIT-G4_6-03", description: "Use context clues and dictionaries to determine word meanings", subject: "LITERACY" as const, band: "G4_6" as const },

  // ── LITERACY G7_9 ──
  { code: "LR-LIT-G7_9-01", description: "Analyze literary devices (metaphor, simile, imagery) in African and world literature", subject: "LITERACY" as const, band: "G7_9" as const },
  { code: "LR-LIT-G7_9-02", description: "Write persuasive and argumentative essays with evidence and reasoning", subject: "LITERACY" as const, band: "G7_9" as const },
  { code: "LR-LIT-G7_9-03", description: "Conduct research using multiple sources and cite references properly", subject: "LITERACY" as const, band: "G7_9" as const },

  // ── LITERACY G10_12 ──
  { code: "LR-LIT-G10_12-01", description: "Critically analyze complex texts including Liberian and West African literature", subject: "LITERACY" as const, band: "G10_12" as const },
  { code: "LR-LIT-G10_12-02", description: "Write research papers and formal reports following academic conventions", subject: "LITERACY" as const, band: "G10_12" as const },

  // ── CIVICS G1_3 ──
  { code: "LR-CIV-G1_3-01", description: "Identify national symbols of Liberia (flag, seal, anthem) and their meanings", subject: "CIVICS" as const, band: "G1_3" as const },

  // ── CIVICS G4_6 ──
  { code: "LR-CIV-G4_6-01", description: "Explain the three branches of Liberia's government and their functions", subject: "CIVICS" as const, band: "G4_6" as const },
  { code: "LR-CIV-G4_6-02", description: "Describe the rights and responsibilities of Liberian citizens", subject: "CIVICS" as const, band: "G4_6" as const },

  // ── CIVICS G7_9 ──
  { code: "LR-CIV-G7_9-01", description: "Analyze the history of Liberia from founding through the civil wars to present", subject: "CIVICS" as const, band: "G7_9" as const },
  { code: "LR-CIV-G7_9-02", description: "Compare Liberia's constitution with other democratic constitutions", subject: "CIVICS" as const, band: "G7_9" as const },

  // ── CIVICS G10_12 ──
  { code: "LR-CIV-G10_12-01", description: "Evaluate Liberia's role in ECOWAS, the African Union, and the United Nations", subject: "CIVICS" as const, band: "G10_12" as const },

  // ── COMPUTER_SCIENCE G4_6 ──
  { code: "LR-CS-G4_6-01", description: "Identify basic computer components (CPU, RAM, storage) and their functions", subject: "COMPUTER_SCIENCE" as const, band: "G4_6" as const },

  // ── COMPUTER_SCIENCE G7_9 ──
  { code: "LR-CS-G7_9-01", description: "Write simple programs using variables, loops, and conditionals", subject: "COMPUTER_SCIENCE" as const, band: "G7_9" as const },
  { code: "LR-CS-G7_9-02", description: "Understand the internet, web browsers, and responsible digital citizenship", subject: "COMPUTER_SCIENCE" as const, band: "G7_9" as const },

  // ── COMPUTER_SCIENCE G10_12 ──
  { code: "LR-CS-G10_12-01", description: "Design and implement algorithms using functions, arrays, and basic data structures", subject: "COMPUTER_SCIENCE" as const, band: "G10_12" as const },
  { code: "LR-CS-G10_12-02", description: "Understand databases, SQL basics, and data management principles", subject: "COMPUTER_SCIENCE" as const, band: "G10_12" as const },

  // ── COMPUTER_SCIENCE G1_3 (ACTION-4) ──
  { code: "LR-CS-G1_3-01", description: "Use digital devices safely; understand that computers follow instructions and can solve problems", subject: "COMPUTER_SCIENCE" as const, band: "G1_3" as const },

  // ── COMPUTER_SCIENCE G4_6 hardware strand (ACTION-5) ──
  { code: "LR-CS-G4_6-02", description: "Connect and use input/output devices; understand how hardware and software work together", subject: "COMPUTER_SCIENCE" as const, band: "G4_6" as const },

  // ── ENGINEERING G1_3 (ACTION-2) ──
  { code: "LR-ENG-G1_3-01", description: "Identify common tools and their safe use; explore how simple structures are built", subject: "ENGINEERING" as const, band: "G1_3" as const },
  { code: "LR-ENG-G1_3-02", description: "Investigate properties of everyday materials (strength, flexibility, waterproofing) found in Liberia", subject: "ENGINEERING" as const, band: "G1_3" as const },

  // ── ENGINEERING G4_6 (ACTION-2) ──
  { code: "LR-ENG-G4_6-01", description: "Follow the engineering design process (define, design, build, test, improve) to solve simple problems", subject: "ENGINEERING" as const, band: "G4_6" as const },
  { code: "LR-ENG-G4_6-02", description: "Investigate forces, levers, and pulleys; explain how they reduce the effort needed to do work", subject: "ENGINEERING" as const, band: "G4_6" as const },

  // ── ENGINEERING G7_9 (ACTION-2) ──
  { code: "LR-ENG-G7_9-01", description: "Apply the engineering design process to address a practical community need in Liberia", subject: "ENGINEERING" as const, band: "G7_9" as const },
  { code: "LR-ENG-G7_9-02", description: "Design, build, and test simple electrical circuits; understand voltage, current, and resistance", subject: "ENGINEERING" as const, band: "G7_9" as const },

  // ── ENGINEERING G10_12 (ACTION-2) ──
  { code: "LR-ENG-G10_12-01", description: "Design and prototype solutions using locally available materials; evaluate against safety and cost criteria", subject: "ENGINEERING" as const, band: "G10_12" as const },
  { code: "LR-ENG-G10_12-02", description: "Apply principles of structural engineering and construction safety to real-world Liberian infrastructure challenges", subject: "ENGINEERING" as const, band: "G10_12" as const },
];

async function main() {
  console.log(`Seeding ${MOE_STANDARDS.length} MOE standards...`);

  for (const std of MOE_STANDARDS) {
    await prisma.standard.upsert({
      where: { code: std.code },
      update: {
        description: std.description,
        subject: std.subject,
        band: std.band,
      },
      create: {
        code: std.code,
        description: std.description,
        subject: std.subject,
        band: std.band,
      },
    });
  }

  console.log(`Done. ${MOE_STANDARDS.length} standards upserted.`);
}

const isDirectExecution =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
