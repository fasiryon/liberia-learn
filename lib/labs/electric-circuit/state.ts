export type ElectricCircuitState = {
  voltage: number;
  resistance1: number;
  resistance2: number;
  circuitType: "series" | "parallel";
  current: number;
  power: number;
  totalResistance: number;
  paused: boolean;
};

export const CIRCUIT_INITIAL_STATE: ElectricCircuitState = {
  voltage: 9,
  resistance1: 100,
  resistance2: 200,
  circuitType: "series",
  current: 0.03,
  power: 0.27,
  totalResistance: 300,
  paused: false,
};
