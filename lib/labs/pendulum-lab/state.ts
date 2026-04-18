export type PendulumLabState = {
  length: number;
  angle: number;
  angularVelocity: number;
  damping: number;
  time: number;
  paused: boolean;
};

export const PENDULUM_INITIAL_STATE: PendulumLabState = {
  length: 1,
  angle: 30,
  angularVelocity: 0,
  damping: 0.1,
  time: 0,
  paused: true,
};
