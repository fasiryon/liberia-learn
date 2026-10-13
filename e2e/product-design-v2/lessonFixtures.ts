/**
 * Lesson Experience V2 runtime fixtures for unit tests and the browser harness. These SIMULATE what the
 * server learner projection would return for a released native lesson; they are not released content,
 * never ship to a student route and certify nothing about server authorization (the server tests do).
 */
import type { LessonRouteTarget } from "../../lib/learner-experience/lessonRoute";
import { LESSON_EXPERIENCE_CONTRACT_VERSION, type AgeBand, type LessonExperience, type Scene } from "../../lib/learner-experience/types";

export const FIXTURE_LAB_LINK_ID = "fixture-lever-link";
export const FIXTURE_LAB_ID = "fixture-lever";

const OBJ_A = "fixture-obj-levers";
const OBJ_B = "fixture-obj-balance";
const NO_TOOLS = { allowed: [], prohibited: [] } as const;
const FULL = { mode: "FULL", fallback: "Everything in this scene works from the saved lesson." } as const;
const A11Y = (text: string) => ({ textAlternative: text, keyboardOperable: true, reducedMotionSafe: true, captionsRequired: false });

const LONG_BODY = Array.from({ length: 6 }, (_, index) =>
  `Paragraph ${index + 1}. A lever is a stiff bar that turns around a fixed point called the fulcrum. When you push down on one end, the other end lifts. Moving the fulcrum closer to the load means a small push can lift something heavy, but your end has to move further.`).join("\n\n");

function scenes(young: boolean): Scene[] {
  const easy = (body: string, simpler: string) => (young ? { body, ageVariants: { EARLY_PRIMARY: { body: simpler } } } : { body });
  return [
    { id: "intro", type: "INTRO", title: "Lifting heavy things", objectiveIds: [OBJ_A], content: easy("People in Monrovia lift heavy rice bags every day. A simple tool can make it easier.", "Rice bags are heavy. A simple tool can help."), interaction: { kind: "NONE" }, tools: NO_TOOLS, accessibility: A11Y("A picture of a market porter lifting a rice bag."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" } },
    { id: "goal", type: "OBJECTIVE", title: "What you will learn", objectiveIds: [OBJ_A, OBJ_B], content: { body: "By the end you can explain how a lever helps lift a load.", keyPoints: ["Find the fulcrum, the load and the effort.", "Say how moving the fulcrum changes the push you need."] }, interaction: { kind: "NONE" }, tools: NO_TOOLS, accessibility: A11Y("The two goals of this lesson."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" } },
    { id: "explain", type: "EXPLANATION", title: "Parts of a lever", objectiveIds: [OBJ_A], content: { body: LONG_BODY, keyPoints: ["Fulcrum: the point it turns on.", "Load: what you lift.", "Effort: your push."] }, interaction: { kind: "NONE" }, tools: NO_TOOLS, accessibility: A11Y("Text explanation of the three parts of a lever."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" } },
    { id: "watch", type: "MEDIA", title: "See a lever at work", objectiveIds: [OBJ_A], content: { body: "Look at the picture and read what it shows." }, media: [{ kind: "IMAGE", ref: "fixture://lever-photo", alt: "A plank resting on a log, with a stone on one end and a child pressing the other end." }, { kind: "AUDIO", ref: "fixture://lever-audio", alt: "A short spoken explanation.", transcript: "The child pushes down a little, and the heavy stone goes up." }], interaction: { kind: "NONE" }, tools: NO_TOOLS, accessibility: A11Y("A plank on a log lifts a stone when one end is pressed."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" } },
    { id: "diagram", type: "INTERACTIVE_DIAGRAM", title: "Follow the push", objectiveIds: [OBJ_A], content: { body: "Open each part in order." }, interaction: { kind: "DIAGRAM_REVEAL", diagramId: "fixture-lever-diagram", steps: [{ id: "effort", label: "Effort", description: "You push down here." }, { id: "fulcrum", label: "Fulcrum", description: "The bar turns here." }, { id: "load", label: "Load", description: "The stone goes up here." }] }, tools: NO_TOOLS, accessibility: A11Y("Effort, then fulcrum, then load."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "ALL_STEPS_REVEALED" } },
    { id: "worked", type: "GUIDED_EXAMPLE", title: "Worked example", objectiveIds: [OBJ_B], content: { body: "Musu moves the log closer to the stone. Now her push can be smaller, but she must push her end further down." }, interaction: { kind: "NONE" }, tools: { allowed: ["digital-ruler"], prohibited: [] }, accessibility: A11Y("A worked example about moving the fulcrum."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" } },
    { id: "practice", type: "PRACTICE", title: "Try it", objectiveIds: [OBJ_B], content: { body: "Choose the best idea." }, interaction: { kind: "MULTIPLE_CHOICE", items: [{ id: "p1", prompt: "To lift a heavy load with less push, move the fulcrum…", options: ["closer to the load", "further from the load"], correctIndex: 0, feedback: { correct: "Yes. Closer to the load means less push.", incorrect: "Look again at Musu's example." } }] }, tools: NO_TOOLS, accessibility: A11Y("One practice question about the fulcrum."), offline: FULL, evidence: { kind: "FORMATIVE_OBSERVATION", evidenceType: "PRACTICE", objectiveIds: [OBJ_B] }, completion: { kind: "ALL_ANSWERED" } },
    { id: "check", type: "CHECK_UNDERSTANDING", title: "Quick check", objectiveIds: [OBJ_A], content: { body: "One question." }, interaction: { kind: "MULTIPLE_CHOICE", items: [{ id: "c1", prompt: "What is the point a lever turns on called?", options: ["The load", "The fulcrum", "The effort"], correctIndex: 1, feedback: { correct: "Right, the fulcrum.", incorrect: "It has a special name. Look at the diagram again." } }] }, tools: NO_TOOLS, accessibility: A11Y("One check question."), offline: FULL, evidence: { kind: "FORMATIVE_OBSERVATION", evidenceType: "PRACTICE", objectiveIds: [OBJ_A] }, completion: { kind: "ALL_ANSWERED" } },
    { id: "lab", type: "LAB", title: "Explore in the lab", objectiveIds: [OBJ_A, OBJ_B], content: { body: "Move the fulcrum in the lab and watch how the push changes." }, interaction: { kind: "LAB_LAUNCH", linkId: FIXTURE_LAB_LINK_ID }, tools: NO_TOOLS, accessibility: A11Y("Without the lab: picture a plank on a log. Slide the log toward the stone, and pressing the far end gets easier."), offline: { mode: "DEGRADED", fallback: "Use the text walkthrough." }, evidence: { kind: "LAB_OBSERVATION", evidenceType: "LAB", objectiveIds: [OBJ_A, OBJ_B] }, completion: { kind: "LAB_RETURNED_OR_FALLBACK" } },
    { id: "reflect", type: "REFLECTION", title: "Think about it", objectiveIds: [OBJ_B], content: { body: "Write in your own words." }, interaction: { kind: "FREE_RESPONSE", prompts: [{ id: "r1", prompt: "Where would you put the fulcrum to lift a heavy bag?", minLength: 5 }] }, tools: NO_TOOLS, accessibility: A11Y("A writing prompt."), offline: FULL, evidence: { kind: "REFLECTION", evidenceType: "PRACTICE", objectiveIds: [OBJ_B] }, completion: { kind: "ALL_RESPONSES_WRITTEN" } },
    { id: "review", type: "REVIEW", title: "Key ideas", objectiveIds: [OBJ_A, OBJ_B], content: { body: "A lever has a fulcrum, a load and an effort.", keyPoints: ["Closer fulcrum, smaller push."] }, interaction: { kind: "NONE" }, tools: NO_TOOLS, accessibility: A11Y("Summary of the lesson."), offline: FULL, evidence: { kind: "NONE" }, completion: { kind: "VIEWED" } },
    { id: "final", type: "MASTERY_CHECK", title: "Show what you know", objectiveIds: [OBJ_A, OBJ_B], content: { body: "Answer both questions." }, interaction: { kind: "ASSESSMENT_HANDOFF", assessment: { assessmentId: "fixture-levers-final", assessmentVersion: "1.0.0", player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", objectiveIds: [OBJ_A, OBJ_B], items: [{ itemId: "m1", itemVersion: "1", prompt: "Which part of a lever do you push on?", options: ["Effort", "Load", "Fulcrum"] }, { itemId: "m2", itemVersion: "1", prompt: "Moving the fulcrum closer to the load makes the push…", options: ["smaller", "bigger"] }] } }, tools: { allowed: [], prohibited: ["basic-calculator"] }, accessibility: A11Y("Two final questions."), offline: FULL, evidence: { kind: "MASTERY_RESPONSE", evidenceType: "QUIZ", objectiveIds: [OBJ_A, OBJ_B] }, completion: { kind: "ALL_ANSWERED" } },
  ] as Scene[];
}

export function runtimeLessonExperience(grade: 2 | 6, overrides: Partial<Pick<LessonExperience, "version">> & { status?: LessonExperience["authority"]["status"] } = {}): LessonExperience {
  const ageBand: AgeBand = grade <= 3 ? "EARLY_PRIMARY" : "UPPER_PRIMARY";
  return {
    contractVersion: LESSON_EXPERIENCE_CONTRACT_VERSION,
    id: `fixture-levers-g${grade}`,
    version: overrides.version ?? "1.0.0",
    title: "Levers help us lift",
    subject: "SCIENCE",
    grade,
    ageBand,
    authority: { status: overrides.status ?? "APPROVED_RELEASE", note: "Fixture: simulates a server-authorized learner projection.", candidateContentIds: [], releaseId: "fixture-release", releaseIdentity: "fixture-release-identity" },
    objectives: [
      { id: OBJ_A, statement: "Name the fulcrum, load and effort of a lever.", conceptId: "fixture-concept-lever", standardCodes: [], skillIds: [] },
      { id: OBJ_B, statement: "Explain how moving the fulcrum changes the push needed.", conceptId: "fixture-concept-balance", standardCodes: [], skillIds: [] },
    ],
    scenes: scenes(grade <= 3),
    offline: { packageable: true, requiredAssets: [] },
  };
}

/** A curriculum detail response (or its signed offline copy) carrying a learner projection with a native experience. */
export function runtimeLessonResponse(grade: 2 | 6, options: { status?: LessonExperience["authority"]["status"]; version?: string } = {}) {
  const lessonExperience = runtimeLessonExperience(grade, { status: options.status, version: options.version });
  return {
    metadata: { contentId: lessonExperience.id, grade, subject: "SCIENCE", version: lessonExperience.version },
    payload: { title: lessonExperience.title, grade, subject: "SCIENCE", lessonExperience, body: "", body_standard: "", body_block: "", objectives: lessonExperience.objectives.map((objective) => objective.statement), studentReady: true },
    audio: null,
    offlineManifest: null,
  };
}

/**
 * A `LessonExperienceDelivery` body as GET /api/student/lessons/:id/experience returns it for a released
 * native lesson (lib/lessons/lessonExperienceDelivery.ts): formative items arrive without keys, and a LAB
 * scene whose link is not authorized arrives as a plain viewed scene.
 */
export function runtimeLessonDelivery(grade: 2 | 6, options: { labAuthorized?: boolean; version?: string; releaseId?: string | null; compatibility?: string; routeTarget?: LessonRouteTarget; completedAt?: string } = {}) {
  const experience = runtimeLessonExperience(grade, { version: options.version });
  const scenes = experience.scenes.map((scene) => {
    if (scene.interaction.kind === "MULTIPLE_CHOICE") return { ...scene, interaction: { kind: "MULTIPLE_CHOICE", feedbackAuthority: "SERVER_REQUIRED", items: scene.interaction.items.map(({ id, prompt, options: choices }) => ({ id, prompt, options: choices })) } };
    if (scene.interaction.kind === "LAB_LAUNCH" && !options.labAuthorized) return { ...scene, interaction: { kind: "NONE" }, completion: { kind: "VIEWED" }, evidence: { kind: "NONE" } };
    return scene;
  });
  return {
    contractVersion: "lesson-experience-delivery/1.1.0",
    routeTarget: options.routeTarget ?? { kind: "CONTENT" as const, contentId: experience.id },
    serverCompletion: options.completedAt ? { completedAt: options.completedAt } : null,
    compatibility: options.compatibility ?? "NATIVE_V2",
    lessonId: experience.id, lessonVersion: experience.version,
    releaseId: options.releaseId === undefined ? "fixture-release" : options.releaseId, releaseIdentity: "fixture-release-identity", revisionId: "fixture-revision",
    title: experience.title, subject: experience.subject, grade: experience.grade, ageBand: experience.ageBand,
    objectives: experience.objectives, objectiveIds: experience.objectives.map((objective) => objective.id),
    scenes, sceneIds: scenes.map((scene) => scene.id),
    authorizedLabLinks: options.labAuthorized ? [{ linkId: FIXTURE_LAB_LINK_ID, labId: FIXTURE_LAB_ID, labVersion: "1.0.0", label: "Lever lab", sceneId: "lab", returnTarget: { route: options.routeTarget ?? { kind: "CONTENT" as const, contentId: experience.id }, sceneId: "lab" }, launchContext: { v: 1 as const, labId: FIXTURE_LAB_ID, labVersion: "1.0.0", linkId: FIXTURE_LAB_LINK_ID, origin: { experienceId: experience.id, experienceVersion: experience.version, sceneId: "lab", objectiveIds: [OBJ_A, OBJ_B], activityId: options.routeTarget?.kind === "SCHEDULED_WORK" ? options.routeTarget.scheduledWorkId : experience.id } }, authorization: "APPROVED_LINK_CERTIFIED_LAB" }] : [],
    assessmentRefs: [],
    legacyPayload: null,
    evidenceDisposition: { status: "OBSERVATION_ONLY", authoritativeSubmission: false, masteryMutation: false, nextActionAuthority: "LEARNING_ORCHESTRATOR", handoff: "EXISTING_GOVERNED_EVIDENCE_ADAPTER", submissionEndpoint: null },
    offlinePolicy: { presentation: "READ_ONLY_AFTER_AUTHORIZED_CACHE", authoritativeSubmission: false, reauthorizeOnReconnect: true, purgeOnAccessLoss: true, versionMismatch: "INCOMPATIBLE_VERSION", trust: "ONLINE_SERVER_RESOLUTION_REQUIRED" },
    provenance: { provenanceId: "fixture-provenance", revisionId: "fixture-revision", approvalId: "fixture-approval", releaseSourceRef: null },
  };
}
