import type { LabAction } from "@/lib/labs/types";
import type { ChemicalReactionAction } from "@/lib/labs/chemical-reaction/actions";
import {
  REACTION_INITIAL_STATE,
  type ChemicalReactionState,
} from "@/lib/labs/chemical-reaction/state";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateReactionRate(
  temperature: number,
  reactantA: number,
  reactantB: number,
  catalyst: boolean
): number {
  const Ea = catalyst ? 30 : 80;
  const R = 8.314;
  const T = temperature + 273.15;
  const k = Math.exp(-Ea / (R * T)) * 1000;
  return k * (reactantA / 100) * (reactantB / 100);
}

function withRate(state: ChemicalReactionState): ChemicalReactionState {
  return {
    ...state,
    reactionRate: calculateReactionRate(
      state.temperature,
      state.reactantA,
      state.reactantB,
      state.catalyst
    ),
  };
}

function stepReaction(state: ChemicalReactionState): ChemicalReactionState {
  if (!state.reactionStarted || state.paused) {
    return state;
  }

  const dt = 0.1;
  const rate = calculateReactionRate(
    state.temperature,
    state.reactantA,
    state.reactantB,
    state.catalyst
  );
  let consumed = Math.min(rate * dt * 5, state.reactantA, state.reactantB);
  if (consumed < 0.001) consumed = 0;

  const reactantA = Math.max(0, state.reactantA - consumed);
  const reactantB = Math.max(0, state.reactantB - consumed);
  const productC = state.productC + consumed;
  const temperature =
    state.energyType === "exothermic"
      ? Math.min(500, state.temperature + consumed * 2)
      : Math.max(0, state.temperature - consumed * 2);

  return {
    ...state,
    reactantA,
    reactantB,
    productC,
    temperature,
    reactionRate: rate,
    time: state.time + dt,
  };
}

export function applyChemicalReactionAction(
  state: ChemicalReactionState,
  action: ChemicalReactionAction
): ChemicalReactionState {
  switch (action.type) {
    case "SET_REACTANT_A":
      return withRate({ ...state, reactantA: clamp(action.value, 0, 100) });
    case "SET_REACTANT_B":
      return withRate({ ...state, reactantB: clamp(action.value, 0, 100) });
    case "SET_TEMPERATURE":
      return withRate({ ...state, temperature: clamp(action.value, 0, 500) });
    case "ADD_CATALYST":
      return withRate({ ...state, catalyst: true });
    case "REMOVE_CATALYST":
      return withRate({ ...state, catalyst: false });
    case "SET_ENERGY_TYPE":
      return { ...state, energyType: action.value };
    case "START_REACTION":
      return withRate({ ...state, reactionStarted: true, paused: false });
    case "STEP":
      return stepReaction(state);
    case "RESET":
      return REACTION_INITIAL_STATE;
    default:
      return state;
  }
}

export function isChemicalReactionState(state: unknown): state is ChemicalReactionState {
  return (
    Boolean(state) &&
    typeof state === "object" &&
    typeof (state as ChemicalReactionState).reactantA === "number" &&
    typeof (state as ChemicalReactionState).reactantB === "number" &&
    typeof (state as ChemicalReactionState).productC === "number" &&
    typeof (state as ChemicalReactionState).temperature === "number" &&
    typeof (state as ChemicalReactionState).catalyst === "boolean" &&
    typeof (state as ChemicalReactionState).reactionRate === "number" &&
    typeof (state as ChemicalReactionState).reactionStarted === "boolean"
  );
}

export function applyChemicalReactionLabAction(
  state: ChemicalReactionState,
  action: LabAction
): ChemicalReactionState {
  return applyChemicalReactionAction(state, action as ChemicalReactionAction);
}
