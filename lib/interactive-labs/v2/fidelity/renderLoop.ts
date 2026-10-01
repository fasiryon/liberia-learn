/** Return true when the WebGL scene has visible animation or an authored review clock to paint. */
export function shouldScheduleWebGLFrame(state: {
  reviewClockActive: boolean;
  reducedMotion: boolean;
  fidelityMoving: boolean;
  cameraMoving: boolean;
  flowMoving: boolean;
  spinMoving: boolean;
  pulseMoving: boolean;
}): boolean {
  return state.reviewClockActive || (!state.reducedMotion && (state.fidelityMoving || state.cameraMoving || state.flowMoving || state.spinMoving || state.pulseMoving));
}
