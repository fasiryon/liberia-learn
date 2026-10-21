/**
 * Interactive Learning V4 — the particle model of water used by the states-of-matter simulation.
 *
 * Pedagogical simplification (stated to learners): pure water at sea-level air pressure, melting at 0 °C and
 * boiling at 100 °C; during melting or boiling the temperature holds while energy changes the arrangement.
 * Particles are drawn as circles: the model shows arrangement and motion, not real particle size or shape.
 */

export type MatterState = "SOLID" | "LIQUID" | "GAS";

export const WATER = Object.freeze({ meltingPointC: 0, boilingPointC: 100 });

export function stateOfWater(temperatureC: number): MatterState {
  if (temperatureC < WATER.meltingPointC) return "SOLID";
  if (temperatureC < WATER.boilingPointC) return "LIQUID";
  return "GAS";
}

export type ParticleBehaviour = Readonly<{ state: MatterState; arrangement: string; motion: string; shape: string; volume: string; spacing: number; speed: number }>;

/** What the model draws and says for a temperature: spacing (relative gap) and speed (relative jiggle). */
export function particleBehaviour(temperatureC: number): ParticleBehaviour {
  const state = stateOfWater(temperatureC);
  const warmth = Math.max(0, Math.min(1, (temperatureC + 30) / 160));
  switch (state) {
    case "SOLID": return { state, arrangement: "packed closely in a regular pattern", motion: "vibrate in fixed places", shape: "keeps its own shape", volume: "keeps its own volume", spacing: 0.05, speed: 0.15 + warmth * 0.3 };
    case "LIQUID": return { state, arrangement: "close together but not in a fixed pattern", motion: "slide past one another", shape: "takes the shape of its container", volume: "keeps its own volume", spacing: 0.18, speed: 0.4 + warmth * 0.5 };
    case "GAS": return { state, arrangement: "far apart", motion: "move quickly in all directions", shape: "spreads to fill its container", volume: "fills the whole container", spacing: 1, speed: 1 + warmth };
  }
}

export const STATE_LABEL: Record<MatterState, string> = { SOLID: "Solid (ice)", LIQUID: "Liquid (water)", GAS: "Gas (water vapour)" };

/** Deterministic pseudo-random sequence so the same temperature always draws the same picture (tests, captures). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}
