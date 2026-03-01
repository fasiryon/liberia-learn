/**
 * Virtual Labs Seed — Integrated Delivery Engine (Part 7)
 *
 * Seeds the VirtualLab table with 6 starter labs covering:
 *   MATH G7 (quadratic), SCIENCE G8 (water filtration), MATH G4 (fractions),
 *   SCIENCE G10 (titration), MATH G9 (coordinate geometry), SCIENCE G5 (plant growth)
 *
 * Design principles:
 * - Idempotent: uses upsert with labId as the natural key.
 * - update: {} — existing records are never overwritten (safe to re-run).
 * - schoolId: null — platform-wide labs available to all schools.
 * - MOE standard codes sourced from prisma/seeds/moe-standards.ts catalog.
 *
 * Run via: ts-node prisma/seed.ts (called from main seed orchestrator)
 */

import { prisma } from "@/lib/db";

type LabPayloadStep = {
  id: string;
  title: string;
  instructions: string;
  interactionType: "read" | "input" | "slider" | "observe" | "calculate" | "drag_drop";
};

type LabPayload = {
  steps: LabPayloadStep[];
  learningObjectives?: string[];
  completionCriteria?: string;
};

type VirtualLabSeed = {
  labId: string;
  title: string;
  description: string;
  subject: string;
  grade: number;
  gradeBand: string;
  labType: string;
  moeStandardCodes: string[];
  primaryContentIds: string[];
  triggerStandardCodes: string[];
  estimatedMinutes: number;
  difficulty: string;
  equipmentList: string[];
  safetyNotes: string | null;
  payload: LabPayload;
  status: string;
  schoolId: string | null;
};

const VIRTUAL_LABS: VirtualLabSeed[] = [
  // ── Lab 1: MATH G7 — Quadratic Parabola Explorer ────────────────────────────
  {
    labId: "lab-quadratic-explorer",
    title: "Quadratic Parabola Explorer",
    description:
      "An interactive 2D simulation where students manipulate the coefficients a, b, and c in the standard form y = ax² + bx + c and observe how the parabola shifts, stretches, and flips in real time. Builds intuition for vertex form, axis of symmetry, and roots before formal algebraic methods.",
    subject: "MATH",
    grade: 7,
    gradeBand: "G7_9",
    labType: "2d_simulation",
    moeStandardCodes: ["LR-MATH-G7_9-01", "LR-MATH-G7_9-02"],
    primaryContentIds: [],
    triggerStandardCodes: ["LR-MATH-G7_9-01"],
    estimatedMinutes: 30,
    difficulty: "standard",
    equipmentList: [],
    safetyNotes: null,
    payload: {
      learningObjectives: [
        "Identify how each coefficient (a, b, c) affects the shape and position of the parabola",
        "Locate the vertex and axis of symmetry from the graph",
        "Predict whether a parabola opens upward or downward given the sign of a",
      ],
      completionCriteria: "Student correctly predicts 3 out of 3 parabola transformations and records vertex coordinates",
      steps: [
        {
          id: "step-1",
          title: "Set the Scene",
          instructions:
            "Read the on-screen introduction. A coordinate plane is displayed with the parabola y = x². Notice the vertex sits at the origin (0, 0) and the curve opens upward. Record the current vertex in your notebook.",
          interactionType: "read",
        },
        {
          id: "step-2",
          title: "Change the Leading Coefficient (a)",
          instructions:
            "Use the slider labelled 'a' to change its value from 1 to −1. Watch the parabola flip. Then set a = 2 and a = 0.5. In your notebook, write a rule: when a is positive the parabola opens ___; when a is negative it opens ___; a larger |a| makes the parabola ___.",
          interactionType: "slider",
        },
        {
          id: "step-3",
          title: "Shift Along the Vertical Axis (c)",
          instructions:
            "Reset a = 1. Move the slider labelled 'c' from 0 to 4 and then to −3. Record the vertex each time. Complete the sentence: The value of c moves the entire parabola ___ without changing its shape.",
          interactionType: "slider",
        },
        {
          id: "step-4",
          title: "Find the Roots",
          instructions:
            "Set a = 1, b = 0, c = −4. The simulation highlights where the parabola crosses the x-axis. Enter the x-values of both crossing points (roots) in the input boxes below the graph. Check your answer against the simulation feedback.",
          interactionType: "input",
        },
        {
          id: "step-5",
          title: "Challenge: Match the Target Parabola",
          instructions:
            "A dashed target parabola is shown. Adjust sliders a, b, and c until your red curve matches the dashed target. When the overlap score reaches 95% or higher, click 'Submit Match'. Record the final values of a, b, and c.",
          interactionType: "input",
        },
      ],
    },
    status: "published",
    schoolId: null,
  },

  // ── Lab 2: SCIENCE G8 — Water Filtration Walkthrough ────────────────────────
  {
    labId: "lab-water-filtration",
    title: "Water Filtration Walkthrough",
    description:
      "A guided virtual walkthrough that simulates the construction and testing of a multi-stage water filter using locally available materials (sand, gravel, activated charcoal, cloth). Tied to Liberia's water quality challenges and the water cycle standard. Students design, build, and evaluate filter effectiveness using turbidity readings.",
    subject: "SCIENCE",
    grade: 8,
    gradeBand: "G7_9",
    labType: "guided_walkthrough",
    moeStandardCodes: ["LR-SCI-G7_9-01", "LR-SCI-G4_6-01"],
    primaryContentIds: [],
    triggerStandardCodes: ["LR-SCI-G7_9-01"],
    estimatedMinutes: 40,
    difficulty: "standard",
    equipmentList: [
      "Plastic bottle (cut in half)",
      "Coarse gravel",
      "Fine sand",
      "Activated charcoal",
      "Cotton cloth or coffee filter",
      "Muddy water sample",
      "Clear collection container",
      "Turbidity chart",
    ],
    safetyNotes:
      "Do not drink filtered water from this experiment — it removes particles but does not sterilize. Wash hands after handling soil materials.",
    payload: {
      learningObjectives: [
        "Explain the role of each filtration layer (gravel, sand, charcoal, cloth)",
        "Measure and compare turbidity before and after filtration",
        "Connect filtration principles to Liberia's community water treatment efforts",
      ],
      completionCriteria: "Student achieves a post-filter turbidity reading of 5 NTU or lower and explains why each layer was ordered as it was",
      steps: [
        {
          id: "step-1",
          title: "Examine the Contaminated Sample",
          instructions:
            "Click on the muddy water flask. Observe its color and turbidity rating shown on the right panel (typically 45–60 NTU). Record the starting turbidity. Read the background note on why water in the Lofa and Grand Cape Mount counties can appear this way during rainy season.",
          interactionType: "observe",
        },
        {
          id: "step-2",
          title: "Design Your Filter Layers",
          instructions:
            "Drag and drop the four materials (gravel, sand, charcoal, cloth) into the filter bottle in the order you think works best. The simulation shows a cross-section. Once happy with your order, click 'Lock in Design' and write a one-sentence justification for your layer order.",
          interactionType: "drag_drop",
        },
        {
          id: "step-3",
          title: "Run the Filtration",
          instructions:
            "Click 'Pour Water' and watch the animation showing water passing through each layer. Flow-rate bars indicate how fast water moves through each material. Observe which layer reduces the most visible particles. Pause at each layer and record your observation.",
          interactionType: "observe",
        },
        {
          id: "step-4",
          title: "Read and Record Turbidity",
          instructions:
            "The filtered water collects in the bottom container. Match its color to the turbidity chart and enter the post-filter turbidity (NTU) in the input field. Enter the percentage improvement compared to your starting value: ((start − end) / start) × 100.",
          interactionType: "calculate",
        },
        {
          id: "step-5",
          title: "Redesign Challenge",
          instructions:
            "The simulation shows the optimal layer order for lowest turbidity. If your design differed, drag the layers into the optimal order and re-run the simulation. Compare both turbidity outcomes and write two sentences explaining why the optimal order works better.",
          interactionType: "input",
        },
      ],
    },
    status: "published",
    schoolId: null,
  },

  // ── Lab 3: MATH G4 — Fraction Multiplication Visualizer ────────────────────
  {
    labId: "lab-fraction-multiplication",
    title: "Fraction Multiplication Visualizer",
    description:
      "A 2D area-model simulation that helps Grade 4 students build conceptual understanding of multiplying fractions before learning the algorithm. Students shade regions of a rectangle to represent each fraction, observe the overlapping area as the product, and connect the picture to the numeric result.",
    subject: "MATH",
    grade: 4,
    gradeBand: "G4_6",
    labType: "2d_simulation",
    moeStandardCodes: ["LR-MATH-G4_6-02", "LR-MATH-G4_6-01"],
    primaryContentIds: [],
    triggerStandardCodes: ["LR-MATH-G4_6-02"],
    estimatedMinutes: 25,
    difficulty: "standard",
    equipmentList: [],
    safetyNotes: null,
    payload: {
      learningObjectives: [
        "Represent a fraction of a fraction using an area model",
        "Connect the shaded overlap region to the numerical product",
        "State the multiplication rule for fractions (multiply numerators, multiply denominators)",
      ],
      completionCriteria: "Student correctly predicts the product for 4 fraction pairs and explains the pattern in their own words",
      steps: [
        {
          id: "step-1",
          title: "Build the First Fraction",
          instructions:
            "A 1×1 square is displayed. Use the top slider to split the square into equal columns. Set the denominator to 3 (three columns). Click to shade 2 of the 3 columns blue. You have modelled the fraction 2/3. Record it in your notebook.",
          interactionType: "slider",
        },
        {
          id: "step-2",
          title: "Build the Second Fraction",
          instructions:
            "Now use the side slider to split the square into equal rows. Set the denominator to 4 (four rows). Click to shade 1 of the 4 rows yellow. The yellow shading cuts across the whole square, including the blue columns.",
          interactionType: "slider",
        },
        {
          id: "step-3",
          title: "Observe the Overlap",
          instructions:
            "Look at the region that is shaded BOTH blue and yellow — it appears green. Count how many small rectangles are in the green region. Count the total small rectangles in the whole square. Enter those two numbers in the boxes below. The simulation will display your fraction.",
          interactionType: "input",
        },
        {
          id: "step-4",
          title: "Confirm with the Algorithm",
          instructions:
            "The simulation shows: 2/3 × 1/4. Multiply the numerators: 2 × 1 = ___. Multiply the denominators: 3 × 4 = ___. Type the resulting fraction. Does it match the area you shaded? Click 'Check' to confirm.",
          interactionType: "calculate",
        },
        {
          id: "step-5",
          title: "Practise Two More Problems",
          instructions:
            "The simulation gives you two new fraction pairs: (a) 3/4 × 2/5 and (b) 1/2 × 3/3. For each, predict the product before building the model, then build the model to check. Record whether your prediction matched and write the rule for multiplying fractions in one sentence.",
          interactionType: "input",
        },
      ],
    },
    status: "published",
    schoolId: null,
  },

  // ── Lab 4: SCIENCE G10 — Titration Simulation ───────────────────────────────
  {
    labId: "lab-titration-simulation",
    title: "Acid-Base Titration Simulation",
    description:
      "An advanced 2D simulation of a standard acid-base titration experiment. Students add sodium hydroxide (NaOH) from a burette to hydrochloric acid (HCl), track pH change with each addition, plot the titration curve, and determine the equivalence point. Aligned to LR-SCI-G10_12 chemistry objectives on acids, bases, and chemical reactions.",
    subject: "SCIENCE",
    grade: 10,
    gradeBand: "G10_12",
    labType: "2d_simulation",
    moeStandardCodes: ["LR-SCI-G7_9-01", "LR-SCI-G10_12-01"],
    primaryContentIds: [],
    triggerStandardCodes: ["LR-SCI-G7_9-01", "LR-SCI-G10_12-01"],
    estimatedMinutes: 50,
    difficulty: "advanced",
    equipmentList: [
      "Burette (50 mL, simulated)",
      "Conical flask (250 mL, simulated)",
      "Phenolphthalein indicator",
      "0.1 M NaOH solution",
      "0.1 M HCl solution",
      "pH meter (simulated)",
      "Graph paper or spreadsheet",
    ],
    safetyNotes:
      "In a real lab: wear goggles and gloves; NaOH causes skin irritation; HCl vapours are harmful — work in a ventilated area. This simulation removes chemical risk but students should know real-lab precautions.",
    payload: {
      learningObjectives: [
        "Explain the principle of neutralisation: acid + base → salt + water",
        "Predict the pH at the equivalence point for a strong acid–strong base titration",
        "Plot and interpret a titration curve, identifying the sharp inflection point",
        "Calculate the concentration of an unknown acid from titration data",
      ],
      completionCriteria: "Student correctly identifies the equivalence point volume (±0.5 mL) and calculates the unknown concentration with less than 5% error",
      steps: [
        {
          id: "step-1",
          title: "Set Up the Apparatus",
          instructions:
            "Click 'Fill Burette' to load 50 mL of 0.1 M NaOH. The conical flask already contains 25 mL of 0.1 M HCl with three drops of phenolphthalein indicator (colourless in acid). Record the initial burette reading: 0.00 mL. Note the starting pH displayed on the pH meter: approximately 1.0.",
          interactionType: "observe",
        },
        {
          id: "step-2",
          title: "Coarse Addition Phase",
          instructions:
            "Click 'Add 5 mL' repeatedly until you have added 20 mL total. After each addition, record the burette reading and the pH in the data table below. You should notice the pH rising slowly. The flask solution should remain colourless. Enter all 4 readings now.",
          interactionType: "input",
        },
        {
          id: "step-3",
          title: "Fine Addition Near the Endpoint",
          instructions:
            "Switch to the 'Add 0.5 mL' button. Continue adding NaOH from 20 mL up to 30 mL, recording pH after each drop. The pH should rise steeply around 25 mL. Watch for the pink flash in the flask — that indicates you are very close to the equivalence point. Record the exact volume at first permanent pink colour.",
          interactionType: "observe",
        },
        {
          id: "step-4",
          title: "Plot the Titration Curve",
          instructions:
            "Using your data table, plot Volume of NaOH (x-axis) vs pH (y-axis) in the graph area provided. Click 'Auto-plot' if you prefer the simulation to draw points from your entries. Draw a tangent at the steepest point of the curve. Enter the equivalence point volume in mL.",
          interactionType: "calculate",
        },
        {
          id: "step-5",
          title: "Calculate Unknown Concentration",
          instructions:
            "A second trial is shown with an unknown HCl concentration. The equivalence point is reached at 28.4 mL of 0.1 M NaOH for 25 mL of HCl. Use n(NaOH) = C × V and n(HCl) = n(NaOH) at equivalence to calculate the HCl concentration. Enter your answer in mol/L and record the equation you used.",
          interactionType: "calculate",
        },
      ],
    },
    status: "published",
    schoolId: null,
  },

  // ── Lab 5: MATH G9 — Coordinate Geometry Explorer ───────────────────────────
  {
    labId: "lab-coordinate-geometry",
    title: "Coordinate Geometry Explorer",
    description:
      "An interactive 2D simulation covering distance, midpoint, and gradient between two points on the Cartesian plane. Grade 9 students drag points across the grid, see the calculations update live, and build geometric intuition supporting the Pythagorean theorem application and linear function analysis.",
    subject: "MATH",
    grade: 9,
    gradeBand: "G7_9",
    labType: "2d_simulation",
    moeStandardCodes: ["LR-MATH-G7_9-04", "LR-MATH-G7_9-03", "LR-MATH-G7_9-01"],
    primaryContentIds: [],
    triggerStandardCodes: ["LR-MATH-G7_9-04"],
    estimatedMinutes: 35,
    difficulty: "standard",
    equipmentList: [],
    safetyNotes: null,
    payload: {
      learningObjectives: [
        "Apply the distance formula d = √((x₂−x₁)² + (y₂−y₁)²) to find the length of a segment",
        "Calculate the midpoint of a segment using M = ((x₁+x₂)/2, (y₁+y₂)/2)",
        "Determine the gradient of a line through two points and interpret its meaning",
      ],
      completionCriteria: "Student correctly calculates distance, midpoint, and gradient for 3 point pairs with less than 5% rounding error",
      steps: [
        {
          id: "step-1",
          title: "Place Two Points",
          instructions:
            "Drag point A to coordinates (1, 2) and point B to coordinates (5, 5). The simulation draws segment AB. A right-angled triangle is overlaid showing the horizontal run (Δx) and vertical rise (Δy). Record Δx and Δy in your notebook.",
          interactionType: "drag_drop",
        },
        {
          id: "step-2",
          title: "Calculate the Distance",
          instructions:
            "Using the Pythagorean theorem, compute the length of AB: d = √(Δx² + Δy²). Show your working in the input box. The simulation will confirm your answer. Round to 2 decimal places.",
          interactionType: "calculate",
        },
        {
          id: "step-3",
          title: "Find the Midpoint",
          instructions:
            "Calculate the midpoint M of segment AB using the midpoint formula. Enter the x-coordinate and y-coordinate of M separately. Drag the midpoint marker on screen to your calculated position — the simulation snaps it to the nearest 0.5 unit and reports whether you are correct.",
          interactionType: "input",
        },
        {
          id: "step-4",
          title: "Calculate the Gradient",
          instructions:
            "Calculate the gradient (slope) of line AB using m = (y₂ − y₁) / (x₂ − x₁). Enter your result. Then move point B to (5, 2) — the same height as A. What is the gradient now? Move B to (1, 5) — directly above A. What is the gradient now? Record all three gradients and describe in one sentence what a zero gradient and an undefined gradient mean.",
          interactionType: "calculate",
        },
        {
          id: "step-5",
          title: "Real-World Application",
          instructions:
            "The simulation overlays a map of a Liberian town. Points P and Q represent two community wells. The scale is 1 unit = 50 metres. Drag P and Q to the labelled well icons on the map. Calculate: (a) the straight-line distance between the wells in metres, (b) the midpoint — this is the optimal location for a water tank. Record both answers and explain your reasoning in two sentences.",
          interactionType: "input",
        },
      ],
    },
    status: "published",
    schoolId: null,
  },

  // ── Lab 6: SCIENCE G5 — Plant Growth Observation ────────────────────────────
  {
    labId: "lab-plant-growth-observation",
    title: "Plant Growth Observation Lab",
    description:
      "A time-lapse guided walkthrough simulating a 4-week bean plant growth experiment. Grade 5 students vary one factor (sunlight, water, or soil type) while holding others constant, observe weekly growth measurements, and draw conclusions about plant needs. Contextualised for Liberian subsistence farming crops.",
    subject: "SCIENCE",
    grade: 5,
    gradeBand: "G4_6",
    labType: "guided_walkthrough",
    moeStandardCodes: ["LR-SCI-G4_6-01", "LR-SCI-G1_3-02"],
    primaryContentIds: [],
    triggerStandardCodes: ["LR-SCI-G4_6-01"],
    estimatedMinutes: 35,
    difficulty: "standard",
    equipmentList: [
      "Bean seeds (e.g., cowpea or soya — common in Liberia)",
      "Three small pots or cups",
      "Sandy soil, clay soil, and potting mix (one per pot)",
      "Ruler (cm)",
      "Watering can",
      "Notebook for data recording",
      "Sunny windowsill or outdoor space",
    ],
    safetyNotes:
      "Wash hands after handling soil. Do not ingest seeds or soil materials. Supervise students around water containers.",
    payload: {
      learningObjectives: [
        "Identify the variables in a controlled experiment (independent, dependent, controlled)",
        "Record quantitative observations (height in cm) over time and display in a table",
        "Draw a conclusion linking the changed variable to the observed plant growth",
        "Connect findings to the importance of soil and water conditions for Liberian farmers",
      ],
      completionCriteria: "Student records 4 weeks of simulated growth data, correctly identifies the fastest-growing plant, and writes a one-paragraph conclusion explaining why",
      steps: [
        {
          id: "step-1",
          title: "Design the Experiment",
          instructions:
            "You are testing which soil type (sandy, clay, or potting mix) produces the tallest bean plant in 4 weeks. All other variables — water amount (50 mL per day), sunlight (6 hours), and seed type — are kept the same. Click on each pot and label it with its soil type. Write a hypothesis: 'I think the ___ soil will grow the tallest plant because ___.'",
          interactionType: "input",
        },
        {
          id: "step-2",
          title: "Week 1 — Germination",
          instructions:
            "Click 'Advance 1 Week'. The simulation shows each seed sprouting (or not). A small green shoot appears in the potting mix pot after 5 days; the sandy-soil pot shows a shoot after 6 days; the clay-soil pot shows a shoot after 7 days. Record the height of each shoot at the end of Week 1 (in cm) in your data table.",
          interactionType: "observe",
        },
        {
          id: "step-3",
          title: "Weeks 2 and 3 — Growth Phase",
          instructions:
            "Click 'Advance 1 Week' twice. After each week, record the height of each plant in the data table below. You should see different growth rates. Use the ruler tool by clicking on each plant stem to get the exact cm reading. Note any observations (e.g., leaf colour, drooping stems) in the Observations column.",
          interactionType: "input",
        },
        {
          id: "step-4",
          title: "Week 4 — Final Measurements",
          instructions:
            "Click 'Advance 1 Week' for the final time. Record the Week 4 heights. Now plot a line graph: x-axis = Week (1–4), y-axis = Height (cm), one line per soil type. Use the graph tool or draw it in your notebook. Identify which line is steepest — that soil produced the fastest growth.",
          interactionType: "calculate",
        },
        {
          id: "step-5",
          title: "Write Your Conclusion",
          instructions:
            "Answer these questions in the text box: (1) Which soil type produced the tallest plant? (2) Does this support or contradict your hypothesis? (3) Why might potting mix outperform local soils? (4) What advice would you give to a farmer in your community based on this experiment? Write at least 4 sentences.",
          interactionType: "input",
        },
      ],
    },
    status: "published",
    schoolId: null,
  },
];

export async function seedVirtualLabs(): Promise<void> {
  for (const lab of VIRTUAL_LABS) {
    await prisma.virtualLab.upsert({
      where: { labId: lab.labId },
      update: {},
      create: lab,
    });
  }

  console.log(`Seeded ${VIRTUAL_LABS.length} virtual labs`);
}
