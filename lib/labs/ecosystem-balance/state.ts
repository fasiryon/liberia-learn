export type EcosystemHistoryEntry = {
  plants: number;
  herbivores: number;
  carnivores: number;
};

export type EcosystemBalanceState = {
  plantCount: number;
  herbivoreCount: number;
  carnivoreCount: number;
  droughtActive: boolean;
  time: number;
  paused: boolean;
  history: EcosystemHistoryEntry[];
};

export const ECOSYSTEM_INITIAL_STATE: EcosystemBalanceState = {
  plantCount: 500,
  herbivoreCount: 100,
  carnivoreCount: 20,
  droughtActive: false,
  time: 0,
  paused: true,
  history: [],
};
