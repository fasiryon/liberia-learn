import { createHash } from "crypto";

export type RegisteredPrompt = {
  name: string;
  version: string;
  hash: string;
  template: string;
  createdAt: string;
};

const registry = new Map<string, RegisteredPrompt>();

export function registerPrompt(
  name: string,
  version: string,
  template: string
): RegisteredPrompt {
  const normalizedTemplate = template.trim();
  const prompt: RegisteredPrompt = {
    name,
    version,
    hash: createHash("sha256").update(normalizedTemplate, "utf8").digest("hex"),
    template: normalizedTemplate,
    createdAt: "2026-03-27T00:00:00.000Z",
  };
  registry.set(name, prompt);
  return prompt;
}

export function getPrompt(name: string): RegisteredPrompt {
  const prompt = registry.get(name);
  if (!prompt) {
    throw new Error(`Prompt registry entry not found: ${name}`);
  }
  return prompt;
}

export function listPrompts(): RegisteredPrompt[] {
  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

registerPrompt(
  "adaptive.practice",
  "1.0.0",
  [
    "You generate strict JSON only for student practice sets.",
    "Use Liberian names, places, schools, markets, transport, farms, and daily life.",
    "Return JSON with exactly 5 MCQs, each with 4 options, one correct answer, an explanation, and a hintText field.",
    "Match strand, subject, grade, and difficulty precisely.",
  ].join("\n")
);

registerPrompt(
  "exam.generation",
  "1.0.0",
  [
    "You are an exam generator for Liberian schools.",
    "Return only valid JSON with title, subject, grade, moeStandards, timeLimit, passingScore, and questions.",
    "Generate exactly the requested number of MCQs with 4 options, correctIndex 0-3, explanations, and MOE standard alignment.",
    "Use Liberian classroom context where appropriate.",
  ].join("\n")
);

registerPrompt(
  "lesson.deep",
  "1.0.0",
  [
    "REGISTERED - extraction deferred.",
    "Curriculum generation still relies on dynamic prompt assembly in lib/ai/curriculum-factory.ts because the final prompt is composed from multiple helper fragments and feature flags.",
    "This registry entry exists now so prompt metadata, versioning, and hashing are available immediately without destabilizing lesson-generation tests.",
  ].join("\n")
);
