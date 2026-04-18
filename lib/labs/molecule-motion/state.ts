export type MoleculeMotionState = {
  temperature: number;
  particleCount: number;
  pressure: number;
  phase: "solid" | "liquid" | "gas";
  paused: boolean;
  time: number;
};

export const MOLECULE_INITIAL_STATE: MoleculeMotionState = {
  temperature: 300,
  particleCount: 50,
  pressure: 15,
  phase: "gas",
  paused: true,
  time: 0,
};
