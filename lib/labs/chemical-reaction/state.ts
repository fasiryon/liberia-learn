export type ChemicalReactionState = {
  reactantA: number;
  reactantB: number;
  productC: number;
  temperature: number;
  catalyst: boolean;
  reactionRate: number;
  energyType: "exothermic" | "endothermic";
  reactionStarted: boolean;
  paused: boolean;
  time: number;
};

export const REACTION_INITIAL_STATE: ChemicalReactionState = {
  reactantA: 80,
  reactantB: 80,
  productC: 0,
  temperature: 25,
  catalyst: false,
  reactionRate: 0,
  energyType: "exothermic",
  reactionStarted: false,
  paused: true,
  time: 0,
};
