export type GravityLabState = {
  gravity: number;
  mass: number;
  height: number;
  velocity: number;
  time: number;
  paused: boolean;
};

export const GRAVITY_INITIAL_STATE: GravityLabState = {
  gravity: 9.81,
  mass: 1,
  height: 10,
  velocity: 0,
  time: 0,
  paused: true,
};
