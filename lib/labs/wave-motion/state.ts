export type WaveMotionState = {
  frequency: number;
  amplitude: number;
  waveSpeed: number;
  wavelength: number;
  waveType: "transverse" | "longitudinal";
  time: number;
  paused: boolean;
};

export const WAVE_INITIAL_STATE: WaveMotionState = {
  frequency: 2,
  amplitude: 2,
  waveSpeed: 10,
  wavelength: 5,
  waveType: "transverse",
  time: 0,
  paused: false,
};
