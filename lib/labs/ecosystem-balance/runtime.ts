import type { EcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import {
  ECOSYSTEM_INITIAL_STATE,
  type EcosystemBalanceState,
  type EcosystemHistoryEntry,
} from "@/lib/labs/ecosystem-balance/state";

const plantGrowthRate = 0.05;
const carryingCapacity = 1000;
const grazingRate = 0.0005;
const predationRate = 0.001;
const herbivoreEfficiency = 0.2;
const carnivoreEfficiency = 0.15;
const herbivoreDeathRate = 0.03;
const carnivoreDeathRate = 0.05;
const stepDt = 0.1;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizedHistory(history: EcosystemHistoryEntry[] | undefined): EcosystemHistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (entry) =>
        Number.isFinite(entry.plants) &&
        Number.isFinite(entry.herbivores) &&
        Number.isFinite(entry.carnivores)
    )
    .slice(-100);
}

function normalizeState(state: EcosystemBalanceState): EcosystemBalanceState {
  const herbivoreCount = clamp(state.herbivoreCount, 0, 500);
  const carnivoreCount = clamp(state.carnivoreCount, 0, 200);
  return {
    plantCount: clamp(state.plantCount, 0, 1000),
    herbivoreCount: herbivoreCount < 1 ? 0 : herbivoreCount,
    carnivoreCount: carnivoreCount < 1 ? 0 : carnivoreCount,
    droughtActive: Boolean(state.droughtActive),
    time: Math.max(0, Number.isFinite(state.time) ? state.time : 0),
    paused: Boolean(state.paused),
    history: normalizedHistory(state.history),
  };
}

function withHistory(state: EcosystemBalanceState): EcosystemBalanceState {
  return {
    ...state,
    history: [
      ...state.history,
      {
        plants: state.plantCount,
        herbivores: state.herbivoreCount,
        carnivores: state.carnivoreCount,
      },
    ].slice(-100),
  };
}

function stepEcosystem(state: EcosystemBalanceState): EcosystemBalanceState {
  const current = normalizeState(state);
  const plants = current.plantCount;
  const herbivores = current.herbivoreCount;
  const carnivores = current.carnivoreCount;
  const effectivePlantGrowth = current.droughtActive ? plantGrowthRate * 0.1 : plantGrowthRate;

  const dPlants =
    effectivePlantGrowth * plants * (1 - plants / carryingCapacity) -
    grazingRate * plants * herbivores;
  const dHerbivores =
    herbivoreEfficiency * grazingRate * plants * herbivores -
    predationRate * herbivores * carnivores -
    herbivoreDeathRate * herbivores;
  const dCarnivores =
    carnivoreEfficiency * predationRate * herbivores * carnivores -
    carnivoreDeathRate * carnivores;

  const nextHerbivores = clamp(herbivores + dHerbivores * stepDt, 0, 500);
  const nextCarnivores = clamp(carnivores + dCarnivores * stepDt, 0, 200);
  const nextState = {
    ...current,
    plantCount: clamp(plants + dPlants * stepDt, 0, 1000),
    herbivoreCount: nextHerbivores < 1 ? 0 : nextHerbivores,
    carnivoreCount: nextCarnivores < 1 ? 0 : nextCarnivores,
    time: current.time + stepDt,
  };

  return withHistory(nextState);
}

export function applyEcosystemBalanceAction(
  state: EcosystemBalanceState,
  action: EcosystemBalanceAction
): EcosystemBalanceState {
  const current = normalizeState(state);

  switch (action.type) {
    case "SET_PLANTS":
      return { ...current, plantCount: clamp(action.value, 0, 1000) };
    case "SET_HERBIVORES":
      return { ...current, herbivoreCount: clamp(action.value, 0, 500) };
    case "SET_CARNIVORES":
      return { ...current, carnivoreCount: clamp(action.value, 0, 200) };
    case "ADD_DROUGHT":
      return { ...current, droughtActive: true };
    case "REMOVE_DROUGHT":
      return { ...current, droughtActive: false };
    case "PLAY":
      return { ...current, paused: false };
    case "PAUSE":
      return { ...current, paused: true };
    case "RESET":
      return { ...ECOSYSTEM_INITIAL_STATE };
    case "STEP":
      return stepEcosystem(current);
  }
}

export function isEcosystemBalanceState(value: unknown): value is EcosystemBalanceState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<EcosystemBalanceState>;
  return (
    typeof state.plantCount === "number" &&
    typeof state.herbivoreCount === "number" &&
    typeof state.carnivoreCount === "number" &&
    typeof state.droughtActive === "boolean" &&
    typeof state.time === "number" &&
    typeof state.paused === "boolean" &&
    Array.isArray(state.history)
  );
}
