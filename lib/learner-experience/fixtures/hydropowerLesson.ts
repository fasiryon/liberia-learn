/**
 * PROTOTYPE FIXTURE — Product Redesign V1 / Phase A vertical prototype.
 *
 * A native scene-based lesson on hydroelectric power linked to the Mount Coffee
 * immersive lab. It exists to prove the Lesson Player V2 architecture. It is
 * not curriculum content, not MOE-approved, and not reachable by real
 * students: its authority is PROTOTYPE_FIXTURE and its lab link is
 * PROTOTYPE_INTERNAL. Facts follow docs/labs/mount-coffee-hydropower/COMMISSION.md;
 * MW figures in the lab are model numbers.
 */
import { HYDROPOWER_LAB_ID } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { LEARNING_EXPERIENCE_LINK_VERSION, type LearningExperienceLink } from "../links";
import { LESSON_EXPERIENCE_CONTRACT_VERSION, type LessonExperience, type Scene } from "../types";

export const HYDROPOWER_EXPERIENCE_ID = "proto-g8-hydroelectric-power";
export const HYDROPOWER_EXPERIENCE_VERSION = "0.1.0";
export const HYDROPOWER_LAB_LINK_ID = "proto-link-hydro-mount-coffee";

/** The lab's own fixture objective (lib/interactive-labs/v2/definitions/hydropower.ts). Not an MOE objective id. */
const OBJ_ENERGY_CHAIN = "hydropower-cause-and-effect";
const OBJ_SUPPLY_DEMAND = "proto-hydropower-supply-demand";
const CONCEPT = "hydropower-energy-chain";

const NO_TOOLS = { allowed: [], prohibited: [] } as const;
const FULL_OFFLINE = { mode: "FULL", fallback: "Works from the saved lesson." } as const;

const scenes: Scene[] = [
  {
    id: "intro", type: "INTRO", title: "Where does Monrovia's electricity come from?", objectiveIds: [OBJ_ENERGY_CHAIN],
    content: {
      body: "About 30 km northeast of Monrovia, the Saint Paul River flows past **Mount Coffee**. A hydroelectric plant there turns the energy of moving river water into electricity for homes, shops and hospitals.\n\nIn this lesson you will follow the water from the river to the lights — and find out why the plant sometimes cannot supply everyone.",
    },
    interaction: { kind: "NONE" }, tools: NO_TOOLS,
    accessibility: { textAlternative: "Introduction: the Mount Coffee hydroelectric plant on the Saint Paul River supplies electricity to Monrovia.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" },
  },
  {
    id: "objective", type: "OBJECTIVE", title: "What you will be able to do", objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND],
    content: {
      body: "By the end of this lesson you will be able to:",
      keyPoints: [
        "Explain how moving water is converted into electrical energy.",
        "Explain why a power plant trips when demand is greater than the electricity it can make, and what must change before it can be reset.",
      ],
    },
    interaction: { kind: "NONE" }, tools: NO_TOOLS,
    accessibility: { textAlternative: "Lesson objectives: explain the energy chain in a hydroelectric plant; explain why overload trips a plant and what must change before reset.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" },
  },
  {
    id: "explain", type: "EXPLANATION", title: "Water that is high up stores energy", objectiveIds: [OBJ_ENERGY_CHAIN],
    content: {
      body: "A dam holds river water in a **headpond**. Water held high up has **gravitational potential energy**.\n\nWhen the water flows down a large pipe called a **penstock**, that energy becomes **kinetic energy** — the energy of movement.\n\nThe fast water pushes the blades of a **turbine runner**, which turns a **shaft**. The shaft turns a **generator**, and the generator produces **electrical energy**.\n\nTwo things decide how much electricity the plant can make: **how much water flows each second** and **how far it falls**.",
      keyPoints: ["Height stores energy (gravitational potential).", "Falling water moves (kinetic).", "Turbine and shaft rotate.", "The generator makes electricity."],
      ageVariants: {
        UPPER_PRIMARY: {
          body: "The dam keeps river water up high. When the water rushes down a big pipe, it spins a wheel with blades called a **turbine**. The turbine turns a **generator**, and the generator makes electricity. More water rushing down means more electricity.",
        },
      },
    },
    interaction: { kind: "NONE" }, tools: { allowed: ["dictionary"], prohibited: [] },
    accessibility: { textAlternative: "Water held high has gravitational potential energy; flowing down the penstock it gains kinetic energy; it turns the turbine runner and shaft; the generator makes electrical energy. Flow per second and height of fall decide the output.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" },
  },
  {
    id: "energy-chain", type: "INTERACTIVE_DIAGRAM", title: "Follow the energy chain", objectiveIds: [OBJ_ENERGY_CHAIN],
    content: { body: "Open each stage in order to follow the energy from the headpond to the city." },
    interaction: {
      kind: "DIAGRAM_REVEAL", diagramId: "hydro-energy-chain",
      steps: [
        { id: "headpond", label: "Headpond", description: "Water held behind the dam has gravitational potential energy." },
        { id: "penstock", label: "Penstock", description: "Water falls through the pipe and gains kinetic energy." },
        { id: "turbine", label: "Turbine and shaft", description: "Moving water pushes the runner's blades; the runner and shaft rotate." },
        { id: "generator", label: "Generator", description: "The rotating shaft turns the generator, which produces electrical energy." },
        { id: "city", label: "Grid and city", description: "Power lines carry electricity to homes, shops and the hospital, where it becomes light and heat." },
      ],
    },
    media: [{ kind: "DIAGRAM", ref: "inline:hydro-energy-chain", alt: "A five-stage chain: headpond, penstock, turbine and shaft, generator, grid and city." }],
    tools: NO_TOOLS,
    accessibility: { textAlternative: "Energy chain: headpond (gravitational potential energy) → penstock (kinetic energy) → turbine and shaft (rotation) → generator (electrical energy) → grid and city (light and heat).", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "NONE" }, completion: { kind: "ALL_STEPS_REVEALED" },
  },
  {
    id: "quick-check", type: "CHECK_UNDERSTANDING", title: "Quick check", objectiveIds: [OBJ_ENERGY_CHAIN],
    content: { body: "Choose an answer for each question. You will see feedback straight away." },
    interaction: {
      kind: "MULTIPLE_CHOICE",
      items: [
        { id: "qc-generator", prompt: "Which part changes the rotation of the shaft into electrical energy?", options: ["The penstock", "The generator", "The headpond", "The spillway"], correctIndex: 1, feedback: { correct: "Yes. The generator turns rotation into electrical energy.", incorrect: "Not quite. Look at the energy chain again: which stage comes after the turbine and shaft?" } },
        { id: "qc-dry-season", prompt: "In the dry season, much less water reaches the plant each second. What happens to the electricity the plant can make?", options: ["It goes up", "It stays the same", "It goes down"], correctIndex: 2, feedback: { correct: "Right. Less water flowing each second means less energy reaches the turbines.", incorrect: "Think about it: the amount of water flowing each second is one of the two things that decide the output." } },
      ],
    },
    tools: NO_TOOLS,
    accessibility: { textAlternative: "Two multiple-choice questions about the generator and the dry season.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "FORMATIVE_OBSERVATION", evidenceType: "PRACTICE", objectiveIds: [OBJ_ENERGY_CHAIN] }, completion: { kind: "ALL_ANSWERED" },
  },
  {
    id: "lab", type: "LAB", title: "Explore in the lab: run Mount Coffee", objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND],
    content: {
      body: "Now run the plant yourself. In the lab:",
      keyPoints: [
        "Trace the water from the headpond, through a turbine, back to the river.",
        "Add shops blocks one at a time until the plant **trips**.",
        "Find out what has to change before **Reset plant** works.",
      ],
    },
    interaction: { kind: "LAB_LAUNCH", linkId: HYDROPOWER_LAB_LINK_ID },
    tools: { allowed: ["scientific-calculator"], prohibited: [] },
    accessibility: { textAlternative: "If the lab cannot open: the plant trips when the city asks for more power than the plant can make. Supply stops for everyone. Reset only works after demand is reduced (or more generation is available) so that demand fits.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: { mode: "DEGRADED", fallback: "The lab runs offline once saved; otherwise it degrades to lighter graphics, then a 2D view, then the text walkthrough on this page." },
    evidence: { kind: "LAB_OBSERVATION", evidenceType: "LAB", objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND] }, completion: { kind: "LAB_RETURNED_OR_FALLBACK" },
  },
  {
    id: "reflection", type: "REFLECTION", title: "Think about what happened", objectiveIds: [OBJ_SUPPLY_DEMAND],
    content: { body: "Write a short answer in your own words. There is no single right wording." },
    interaction: {
      kind: "FREE_RESPONSE",
      prompts: [
        { id: "why-trip", prompt: "What caused the plant to trip?", minLength: 15 },
        { id: "before-reset", prompt: "What had to change before the plant could be reset?", minLength: 15 },
      ],
    },
    tools: NO_TOOLS,
    accessibility: { textAlternative: "Two written reflection questions: what caused the trip, and what had to change before reset.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "REFLECTION", evidenceType: "PRACTICE", objectiveIds: [OBJ_SUPPLY_DEMAND] }, completion: { kind: "ALL_RESPONSES_WRITTEN" },
  },
  {
    id: "review", type: "REVIEW", title: "Key ideas", objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND],
    content: {
      body: "Before the final check, review the big ideas.",
      keyPoints: [
        "Moving water's energy becomes rotation in the turbine, then electrical energy in the generator.",
        "Less water flowing each second (the dry season) means less electricity can be made.",
        "If the city asks for more power than the plant can make, protection trips the plant and supply stops.",
        "Reset only works once demand fits what the plant can make — for example by switching some load off.",
      ],
    },
    interaction: { kind: "NONE" }, tools: NO_TOOLS,
    accessibility: { textAlternative: "Review of four key ideas: energy chain, dry season output, overload trip, reset after demand fits.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: FULL_OFFLINE, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" },
  },
  {
    id: "mastery", type: "MASTERY_CHECK", title: "Show what you know", objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND],
    content: { body: "Answer each question. Your answers are checked by the school's learning system, not on this device." },
    interaction: {
      kind: "ASSESSMENT_HANDOFF",
      assessment: {
        assessmentId: "proto-assess-g8-hydro", assessmentVersion: "0.1.0", player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY",
        objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND],
        items: [
          { itemId: "proto-hydro-m1", itemVersion: "0.1.0", prompt: "Which order shows the energy changes in a hydroelectric plant?", options: ["Electrical → kinetic → potential", "Gravitational potential → kinetic → rotation → electrical", "Kinetic → electrical → potential", "Heat → rotation → potential"] },
          { itemId: "proto-hydro-m2", itemVersion: "0.1.0", prompt: "The plant can make 40 MW. The city asks for 52 MW. What happens?", options: ["The plant makes 52 MW anyway", "Protection trips the plant and supply stops", "Only the hospital goes dark", "The river flows faster"] },
          { itemId: "proto-hydro-m3", itemVersion: "0.1.0", prompt: "After a trip, what must happen before the plant can be reset?", options: ["Nothing; it resets itself", "Demand must be brought down to fit what the plant can make", "The dam must be opened fully", "All four units must be switched off"] },
        ],
      },
    },
    tools: { allowed: [], prohibited: ["scientific-calculator"] },
    accessibility: { textAlternative: "Three multiple-choice mastery questions about the energy chain, overload, and reset.", keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false },
    offline: { mode: "DEGRADED", fallback: "Answers are kept on this device and submitted when you reconnect; nothing is scored offline." },
    evidence: { kind: "MASTERY_RESPONSE", evidenceType: "QUIZ", objectiveIds: [OBJ_ENERGY_CHAIN, OBJ_SUPPLY_DEMAND] }, completion: { kind: "ALL_ANSWERED" },
  },
];

export const hydropowerLessonExperience: LessonExperience = Object.freeze<LessonExperience>({
  contractVersion: LESSON_EXPERIENCE_CONTRACT_VERSION,
  id: HYDROPOWER_EXPERIENCE_ID,
  version: HYDROPOWER_EXPERIENCE_VERSION,
  title: "Hydroelectric power: from river to light",
  subject: "SCIENCE",
  grade: 8,
  ageBand: "JUNIOR_SECONDARY",
  authority: {
    status: "PROTOTYPE_FIXTURE",
    note: "Product Redesign V1 Phase A prototype. Not curriculum content, not MOE-approved, never shown to real students.",
    // Repository records on related topics (curriculum-cleanup snapshot). Listed for Phase B review only; not approval.
    candidateContentIds: ["desert-engineering-g7-hydroelectric-power-potential-on-liberia-c8a506d1", "hero-engineering-g9-renewable-energy-solar-and-hydro-power-for-rural-liberia"],
    releaseId: null,
  },
  objectives: [
    { id: OBJ_ENERGY_CHAIN, statement: "Explain how moving water is converted into electrical energy.", conceptId: CONCEPT, standardCodes: [], skillIds: [] },
    { id: OBJ_SUPPLY_DEMAND, statement: "Explain why a plant trips when demand exceeds available generation, and what must change before reset.", conceptId: CONCEPT, standardCodes: [], skillIds: [] },
  ],
  scenes,
  offline: { packageable: true, requiredAssets: [] },
});

export const hydropowerLabLink: LearningExperienceLink = Object.freeze<LearningExperienceLink>({
  contractVersion: LEARNING_EXPERIENCE_LINK_VERSION,
  linkId: HYDROPOWER_LAB_LINK_ID,
  status: "PROTOTYPE_INTERNAL",
  authority: { basis: "Phase A prototype: the lab's own fixture objective matches the lesson objective. No curriculum authority.", approvedBy: null, approvedAt: null },
  lesson: { experienceId: HYDROPOWER_EXPERIENCE_ID, experienceVersion: HYDROPOWER_EXPERIENCE_VERSION },
  objectiveIds: [OBJ_ENERGY_CHAIN],
  experience: { kind: "INTERACTIVE_LAB", labId: HYDROPOWER_LAB_ID, labVersion: "1.1.0" },
  placement: { sceneId: "lab" },
  requirement: "RECOMMENDED",
  preLab: { sceneIds: ["energy-chain", "quick-check"] },
  postLab: { reflectionSceneId: "reflection", checkSceneId: "mastery" },
  evidenceMapping: ["trace-water", "find-generator", "dry-season-output", "dry-season-peak", "repair-unit-3"].map((labCheckId) => ({ labCheckId, objectiveId: OBJ_ENERGY_CHAIN, disposition: "RAW_OBSERVATION" as const })),
});

/** Registry of native lesson experiences. Phase A holds only the internal prototype. */
export const LESSON_EXPERIENCES: Readonly<Record<string, Readonly<{ experience: LessonExperience; links: readonly LearningExperienceLink[] }>>> = Object.freeze({
  [HYDROPOWER_EXPERIENCE_ID]: { experience: hydropowerLessonExperience, links: [hydropowerLabLink] },
});
