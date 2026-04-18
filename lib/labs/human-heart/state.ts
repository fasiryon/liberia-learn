export type HumanHeartState = {
  heartRate: number;
  oxygenLevel: number;
  exerciseLevel: number;
  blockage: boolean;
  strokeVolume: number;
  cardiacOutput: number;
  paused: boolean;
  time: number;
};

export const HEART_INITIAL_STATE: HumanHeartState = {
  heartRate: 72,
  oxygenLevel: 98,
  exerciseLevel: 0,
  blockage: false,
  strokeVolume: 70,
  cardiacOutput: 5.04,
  paused: true,
  time: 0,
};
