"use client";

import { useEffect, useRef } from "react";
import { SCENE_HEIGHT } from "./sceneLayout";
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import type { FidelityState } from "@/lib/interactive-labs/v2/fidelity/types";
import { buildRenderList, type RenderItem, type RenderList, type RenderMarker } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { dragParameter } from "@/lib/interactive-labs/v2/fidelity/controls";
import { approachCamera, constrainCamera, easeDisplayState, isSettled, spinMatrix, viewMatrix, type CameraPose } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { findPreset, framedPose } from "@/lib/interactive-labs/v2/fidelity/camera";
import { recordFrameSample, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { probeAllowsUpgrade } from "@/lib/interactive-labs/v2/capabilities";
import { downgradeFrameBudgetMs } from "@/lib/interactive-labs/v2/production/budgets";
import { fitHorizontalFieldOfView, IDENTITY, multiply, multiplyInto, perspective, transformPoint, type Mat4, type Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";
import { batchFlowGeometry, createFlowBatchStorage, createPointBatchStorage, writeMarkerPositions, type FlowVertexBatch } from "@/lib/interactive-labs/v2/fidelity/flowBatch";
import { shouldScheduleWebGLFrame } from "@/lib/interactive-labs/v2/fidelity/renderLoop";
import { browserVisibilityDeps, shouldDrawFrame, watchSceneVisibility } from "@/lib/interactive-labs/v2/fidelity/sceneActivity";
import { highlightBaseMix, HIGHLIGHT_COLOR, MARKER_COLOR } from "@/lib/interactive-labs/v2/fidelity/palette";
import { placeSceneLabels } from "@/lib/interactive-labs/v2/fidelity/labelLayout";
import { buildMesh } from "./meshes";
import { buildParametricGeometry } from "@/lib/interactive-labs/v2/fidelity/geometry/builders";
import { createLowBatchCache, MAX_LOW_BATCH_VERTICES, syncLowBatchCache } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
import { planLowFrame, type FramePlan } from "@/lib/interactive-labs/v2/fidelity/framePlan";
import { createLowBatchScratch, ensureLowBatchScratch, LOW_BATCH_COLOR_CHANGED, LOW_BATCH_EMISSIVE_CHANGED, syncLowBatchItemState, type LowBatchScratch, type LowBatchStateRange } from "@/lib/interactive-labs/v2/fidelity/lowBatchState";
import { publishFramePlan, type ReviewFrameProbe } from "@/lib/interactive-labs/v2/review/framePlanEvidence";
import { createSurfaceTriangleStorage, writeSurfaceTriangles } from "@/lib/interactive-labs/v2/fidelity/surfaces";
import type { MeshData } from "./meshes";
import { pickNearest, type ScenePick } from "./picking";
import { controlTargetElements } from "./controlTargets";
import { controlAffordanceElements, controlCursor, cueElements, statusBadgeElements } from "./sceneCues";

type Props = {
  definition: InteractiveLabDefinition<LabState>;
  state: LabState;
  profile: CapabilityProfile;
  reducedMotion: boolean;
  traceFlowId: string | null;
  dispatch: (action: LabAction) => void;
  onPick: (pick: ScenePick) => void;
  onDowngrade: (reason: "context" | "performance" | "creation") => void;
  onUpgradeReady?: () => void;
  allowProfileUpgrade?: boolean;
  allowPerformanceDowngrade?: boolean;
  /** Dev-only review harness: installs the frame-plan parity probe. */
  review?: boolean;
  /** Called once, after the first full frame (A9 data-lab-scene-ready; A17 lifts the 2D loading veil). */
  onReady?: () => void;
  /** RX-005d on LOW: rail legs are cuts, not eases. */
  railActive?: boolean;
  /** A16: bumping this returns the view to the current preset. */
  recenter?: number;
  /** A14: the control part whose confirm preview is pending (drawn highlighted). */
  pendingControlId?: string | null;
  /** A18: the view carried over from the renderer this one replaced, kept until the preset changes or Recentre. */
  initialPose?: { presetId: string; pose: CameraPose } | null;
  /** A14: a drag on a drag-variable control part, as the pointer's parameter along the part's axis. */
  onDragControl?: (componentId: string, t: number) => void;
};

const vertexShader = `attribute vec3 position; attribute vec3 normal; attribute vec3 vcolor; attribute float vemissive; uniform mat4 mvp; uniform mat4 model; uniform float pointSize; uniform float useVertexColor; uniform float useVertexEmissive; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vertexColor; varying float vertexEmissive;
void main(){ vec4 world = model * vec4(position, 1.0); vWorld = world.xyz; vNormal = mat3(model) * normal; vertexColor = mix(vec3(1.0), vcolor, useVertexColor); vertexEmissive = vemissive * useVertexEmissive; gl_Position = mvp * vec4(position, 1.0); gl_PointSize = pointSize; }`;
const fragmentShader = `precision mediump float; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vertexColor; varying float vertexEmissive; uniform vec3 color; uniform vec3 highlightColor; uniform float highlightMix; uniform float hasHighlight; uniform float alpha; uniform float emissive; uniform float lighting; uniform vec4 clipPlane; uniform float clipEnabled;
void main(){
  if (clipEnabled > 0.5 && dot(clipPlane.xyz, vWorld) > clipPlane.w) discard;
  vec3 n = normalize(vNormal); if (!gl_FrontFacing) n = -n;
  vec3 l = normalize(vec3(-0.35, 0.7, 1.0));
  float diffuse = max(dot(n, l), 0.0);
  float ambient = lighting > 2.5 ? 0.38 : 0.5;
  float shade = lighting < 0.5 ? 1.0 : ambient + (1.0 - ambient) * diffuse;
  float spec = lighting > 2.5 ? pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * 0.28 : 0.0;
  // State emission must brighten an item without washing the full surface to white.
  vec3 glow = (emissive + vertexEmissive) * vec3(0.22, 0.19, 0.10);
  vec3 base = color * vertexColor * shade + spec + glow;
  float rim = pow(1.0 - abs(dot(n, normalize(vec3(0.0, 0.0, 1.0)))), 3.0);
  vec3 highlighted = mix(base, highlightColor, clamp(highlightMix + rim * 0.55, 0.0, 0.9));
  gl_FragColor = vec4(mix(base, highlighted, hasHighlight), clamp(alpha + (emissive + vertexEmissive) * 0.4, 0.0, 1.0));
}`;
const LIGHTING = { full: 3, simplified: 2, minimal: 1, none: 0 } as const;

/** A11: at most 8 scene labels, highlighted parts first; the parts list carries the rest. */

/** Shared with ThreeScene's daylight ground plane. */
const GROUND_Y = -2.25;

const rgbCache = new Map<string, [number, number, number]>();
function rgb(value: string): [number, number, number] { let color = rgbCache.get(value); if (!color) { const n = Number.parseInt(value.replace("#", ""), 16); color = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; rgbCache.set(value, color); } return color; }

export function WebGLScene({ definition, state, profile, reducedMotion, traceFlowId, dispatch, onPick, onDowngrade, onUpgradeReady, allowProfileUpgrade = false, allowPerformanceDowngrade = true, review = false, onReady, railActive = false, recenter = 0, pendingControlId = null, onDragControl, initialPose = null }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Review evidence: identity, frames drawn and last-frame draw calls on the root (rendererIdentity.ts).
  const root = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const motionStatus = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; active: boolean; moved: number; control: RenderItem | null }>({ x: 0, y: 0, active: false, moved: 0, control: null });
  const stateRef = useRef(state);
  const pendingRef = useRef(pendingControlId);
  pendingRef.current = pendingControlId;
  const displayRef = useRef<FidelityState | undefined>(state.fidelity);
  const zoomRef = useRef(1);
  const carriedPose = useRef(initialPose);
  const controlTargets = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  const frameRef = useRef<{ list: RenderList | null; viewProj: Mat4; width: number; height: number }>({ list: null, viewProj: IDENTITY, width: 1, height: 1 });
  const callbacks = useRef({ onDowngrade, onUpgradeReady, reducedMotion, traceFlowId, onReady, railActive });
  const requestDrawRef = useRef<() => void>(() => {});
  const pendingContextLoss = useRef<number | null>(null);
  stateRef.current = state;
  callbacks.current = { onDowngrade, onUpgradeReady, reducedMotion, traceFlowId, onReady, railActive };

  useEffect(() => {
    if (pendingContextLoss.current !== null) {
      window.clearTimeout(pendingContextLoss.current);
      pendingContextLoss.current = null;
      // The previous instance's context is reused rather than lost; it no longer counts as a live renderer.
      if (review) { const reviewWindow = window as Window & { __labReviewLiveRenderers?: number }; reviewWindow.__labReviewLiveRenderers = (reviewWindow.__labReviewLiveRenderers ?? 1) - 1; }
    }
    const el = canvas.current; if (!el) return;
    let gl: WebGLRenderingContext | null = null;
    try { gl = el.getContext("webgl", { antialias: profile === "HIGH", alpha: true, premultipliedAlpha: false }); }
    catch { /* blocked WebGL is equivalent to an unavailable context */ }
    if (!gl) { callbacks.current.onDowngrade("context"); return; }
    let downgraded = false;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (downgraded) return;
      downgraded = true;
      callbacks.current.onDowngrade("context");
    };
    el.addEventListener("webglcontextlost", handleContextLost);
    const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      el.removeEventListener("webglcontextlost", handleContextLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      callbacks.current.onDowngrade("context");
      return;
    }
    gl.useProgram(program);
    const attr = { position: gl.getAttribLocation(program, "position"), normal: gl.getAttribLocation(program, "normal"), color: gl.getAttribLocation(program, "vcolor"), emissive: gl.getAttribLocation(program, "vemissive") };
    const uni = Object.fromEntries(["mvp", "model", "pointSize", "color", "highlightColor", "highlightMix", "hasHighlight", "useVertexColor", "useVertexEmissive", "alpha", "emissive", "lighting", "clipPlane", "clipEnabled"].map((name) => [name, gl.getUniformLocation(program, name)])) as Record<string, WebGLUniformLocation | null>;
    const spec = definition.fidelity;
    const low = profile === "LOW";
    const modelMatrixScratch = new Float32Array(16);
    const mvpScratch = new Float32Array(16);
    const batchMvpScratch = new Float32Array(16);
    const identityScratch = new Float32Array(IDENTITY);
    // Meshes are built once per geometry and profile, never per frame.
    const meshes = new Map<string, { position: WebGLBuffer; normal: WebGLBuffer; count: number }>();
    const cpuMeshes = new Map<string, MeshData>();
    // RX-006: one set of buffers per batch key, kept (with their identities) until the context is torn down; they grow
    // geometrically only during a rebuild, so state-only changes and in-capacity rebuilds never reallocate.
    const lowBatchBuffers = new Map<string, { position: WebGLBuffer; normal: WebGLBuffer; color: WebGLBuffer; emissive: WebGLBuffer; count: number; scratch: LowBatchScratch; itemRanges: Map<string, LowBatchStateRange & { first: number; count: number; matrix: Mat4 }> }>();
    const lowBatchCache = createLowBatchCache();
    let uploadedLowPlan: ReturnType<typeof syncLowBatchCache> | null = null;
    const dataFor = (item: RenderList["items"][number]): MeshData => {
      const key = item.parametricGeometry ? JSON.stringify(item.parametricGeometry) : item.geometry;
      const cached = cpuMeshes.get(key); if (cached) return cached;
      const data = item.parametricGeometry
        ? (() => { const built = buildParametricGeometry(item.parametricGeometry!, low ? "LOW" : profile === "STANDARD" ? "STANDARD" : "HIGH"); const positions = new Float32Array(built.indices.length * 3), normals = new Float32Array(built.indices.length * 3); built.indices.forEach((index, offset) => { positions.set(built.positions.subarray(index * 3, index * 3 + 3), offset * 3); normals.set(built.normals.subarray(index * 3, index * 3 + 3), offset * 3); }); return { positions, normals, count: built.indices.length }; })()
        : buildMesh(item.geometry, low);
      cpuMeshes.set(key, data); return data;
    };
    const meshFor = (item: RenderList["items"][number]) => {
      const key = item.parametricGeometry ? JSON.stringify(item.parametricGeometry) : item.geometry;
      let mesh = meshes.get(key);
      if (!mesh) {
        const data = dataFor(item);
        const position = gl.createBuffer()!, normal = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, normal); gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
        mesh = { position, normal, count: data.count }; meshes.set(key, mesh);
      }
      return mesh;
    };
    const lineBuffer = gl.createBuffer()!;
    const pointStorage = createPointBatchStorage();
    let pointGpuCapacity = 0;
    const flowStorage = createFlowBatchStorage();
    // RX-005b on LOW: all water surfaces in one flat two-tone triangle batch (A13).
    const surfaceStorage = createSurfaceTriangleStorage();
    const surfaceBuffers = { positions: gl.createBuffer()!, colors: gl.createBuffer()!, capacity: 0 };
    // A13 LOW floor: daylight labs get one flat ground quad (one draw) so the plant does not float on the backdrop.
    const groundBatch: FlowVertexBatch = { positions: new Float32Array([-40, GROUND_Y, -40, 40, GROUND_Y, -40, 40, GROUND_Y, 40, -40, GROUND_Y, -40, 40, GROUND_Y, 40, -40, GROUND_Y, 40]), colors: new Float32Array(Array.from({ length: 6 }, () => [0.79, 0.85, 0.77]).flat()), count: 6 };
    const groundBuffers = { positions: gl.createBuffer()!, colors: gl.createBuffer()!, capacity: 0 };
    const flowBuffers = Object.fromEntries(["casing", "core", "particles", "traceNodes"].map((key) => [key, { positions: gl.createBuffer()!, colors: gl.createBuffer()!, capacity: 0 }])) as Record<"casing" | "core" | "particles" | "traceNodes", { positions: WebGLBuffer; colors: WebGLBuffer; capacity: number; version?: number }>;
    const uploadBatch = (batch: FlowVertexBatch, gpu: { positions: WebGLBuffer; colors: WebGLBuffer; capacity: number; version?: number }) => {
      // A versioned batch (the static flow tubes) is uploaded only when it was rewritten (RX-006 test 6).
      if (batch.version !== undefined && gpu.version === batch.version) return;
      gpu.version = batch.version;
      if (gpu.capacity < batch.positions.length) {
        gpu.capacity = batch.positions.length;
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.positions); gl.bufferData(gl.ARRAY_BUFFER, gpu.capacity * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.colors); gl.bufferData(gl.ARRAY_BUFFER, gpu.capacity * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
      }
      if (gpu.capacity > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.positions); gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.positions);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.colors); gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.colors);
      }
    };
    const drawPoints = (markers: RenderMarker[], mode: number, color: string, alpha: number, size: number, viewProj: Mat4) => {
      if (markers.length === 0) return;
      writeMarkerPositions(markers, pointStorage);
      if (pointGpuCapacity < pointStorage.positions.byteLength) {
        pointGpuCapacity = pointStorage.positions.byteLength;
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer); gl.bufferData(gl.ARRAY_BUFFER, pointGpuCapacity, gl.DYNAMIC_DRAW);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pointStorage.positions);
      gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(attr.normal); gl.vertexAttrib3f(attr.normal, 0, 0, 1);
      gl.disableVertexAttribArray(attr.color); gl.vertexAttrib3f(attr.color, 1, 1, 1);
      gl.disableVertexAttribArray(attr.emissive); gl.vertexAttrib1f(attr.emissive, 0);
      gl.disableVertexAttribArray(attr.emissive); gl.vertexAttrib1f(attr.emissive, 0); gl.uniform1f(uni.useVertexEmissive, 0);
      batchMvpScratch.set(viewProj); gl.uniformMatrix4fv(uni.mvp, false, batchMvpScratch); gl.uniformMatrix4fv(uni.model, false, identityScratch);
      gl.uniform3fv(uni.color, rgb(color)); gl.uniform3fv(uni.highlightColor, rgb(HIGHLIGHT_COLOR)); gl.uniform1f(uni.highlightMix, 0); gl.uniform1f(uni.hasHighlight, 0); gl.uniform1f(uni.useVertexColor, 0); gl.uniform1f(uni.useVertexEmissive, 0);
      gl.uniform1f(uni.alpha, alpha); gl.uniform1f(uni.emissive, 0); gl.uniform1f(uni.lighting, 0); gl.uniform1f(uni.clipEnabled, 0); gl.uniform1f(uni.pointSize, size);
      gl.drawArrays(mode, 0, markers.length);
    };
    const drawBatch = (batch: FlowVertexBatch, gpu: { positions: WebGLBuffer; colors: WebGLBuffer; capacity: number; version?: number }, mode: number, alpha: number, size: number, viewProj: Mat4) => {
      if (!batch.count) return;
      uploadBatch(batch, gpu);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.positions); gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.colors); gl.enableVertexAttribArray(attr.color); gl.vertexAttribPointer(attr.color, 3, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(attr.normal); gl.vertexAttrib3f(attr.normal, 0, 0, 1);
      gl.disableVertexAttribArray(attr.emissive); gl.vertexAttrib1f(attr.emissive, 0);
      batchMvpScratch.set(viewProj); gl.uniformMatrix4fv(uni.mvp, false, batchMvpScratch); gl.uniformMatrix4fv(uni.model, false, identityScratch);
      gl.uniform3f(uni.color, 1, 1, 1); gl.uniform3fv(uni.highlightColor, rgb(HIGHLIGHT_COLOR)); gl.uniform1f(uni.highlightMix, 0); gl.uniform1f(uni.hasHighlight, 0); gl.uniform1f(uni.useVertexColor, 1); gl.uniform1f(uni.useVertexEmissive, 0);
      gl.uniform1f(uni.alpha, alpha); gl.uniform1f(uni.emissive, 0); gl.uniform1f(uni.lighting, 0); gl.uniform1f(uni.clipEnabled, 0); gl.uniform1f(uni.pointSize, size);
      gl.drawArrays(mode, 0, batch.count);
    };

    const fallbackPose: CameraPose = { target: [0, 0, 0], distance: 11, yaw: 0, pitch: 0 };
    let camera: CameraPose | null = null;
    let frame = 0, last = performance.now(), lastTick = last, lastDrawnAt = -Infinity, labelTick = 0, reviewClockSeen = false;
    // A6: paused while hidden or off-screen; ambient-only frames are capped at 30 fps. State changes and resizes force a frame.
    let active = true, ambientOnly = false, forceDraw = true;
    let lastReviewTime: number | undefined;
    let frameTimes: number[] = [];
    let upgradeNotified = false;
    let previousFrameScheduled = false;
    const scheduleDraw = () => { if (active && !frame) frame = requestAnimationFrame(draw); };
    const requestDraw = () => { forceDraw = true; scheduleDraw(); };
    // Count real draw calls per frame for review manifests (gl.drawArrays is the only draw entry point here).
    const nativeDrawArrays = gl.drawArrays.bind(gl);
    let frameDraws = 0, frameTriangles = 0, framesRendered = 0;
    let lastFrame: { draws: number; triangles: number; plan: FramePlan | null } = { draws: 0, triangles: 0, plan: null };
    gl.drawArrays = (mode: number, first: number, count: number) => { frameDraws += 1; if (mode === gl.TRIANGLES) frameTriangles += count / 3; nativeDrawArrays(mode, first, count); };
    // RX-006 test 1 review probe: the planner must equal what this pass counted for the same frame.
    const probe: ReviewFrameProbe = () => lastFrame.plan ? { renderer: "webgl-pass", planned: lastFrame.plan, measured: { drawCalls: lastFrame.draws, triangles: lastFrame.triangles, shadowDrawCalls: 0, shadowTriangles: 0 } } : null;
    const reviewWindow = window as Window & { __labReviewFrameProbe?: ReviewFrameProbe; __labReviewLiveRenderers?: number };
    if (review) { reviewWindow.__labReviewFrameProbe = probe; reviewWindow.__labReviewLiveRenderers = (reviewWindow.__labReviewLiveRenderers ?? 0) + 1; }
    const draw = (now: number) => {
      frame = 0;
      const followedScheduledFrame = previousFrameScheduled;
      previousFrameScheduled = false;
      const reviewTime = (window as Window & { __labReviewClockSeconds?: number }).__labReviewClockSeconds;
      // A4: one downgrade sample per scheduled animation frame (the display cadence), whether it draws or not.
      if (reviewTime === undefined) frameTimes = recordFrameSample(frameTimes, Math.min(100, now - lastTick), followedScheduledFrame);
      lastTick = now;
      if (reviewTime === undefined && !forceDraw && !shouldDrawFrame({ ambient: ambientOnly, eased: !ambientOnly }, now, lastDrawnAt)) {
        previousFrameScheduled = true; frame = requestAnimationFrame(draw); return;
      }
      forceDraw = false; lastDrawnAt = now;
      if (reviewTime !== undefined && !reviewClockSeen) { labelTick = Number.NEGATIVE_INFINITY; reviewClockSeen = true; }
      const dt = reviewTime === undefined
        ? Math.min(0.1, (now - last) / 1000)
        : lastReviewTime === undefined ? 0 : Math.min(0.1, Math.max(0, reviewTime - lastReviewTime));
      last = now;
      if (reviewTime !== undefined) lastReviewTime = reviewTime;
      if (allowPerformanceDowngrade && !downgraded && shouldDowngrade(frameTimes, downgradeFrameBudgetMs(profile))) { downgraded = true; callbacks.current.onDowngrade("performance"); }
      if (allowProfileUpgrade && !upgradeNotified && profile === "LOW" && probeAllowsUpgrade(frameTimes)) {
        upgradeNotified = true;
        callbacks.current.onUpgradeReady?.();
      }
      const current = stateRef.current, motionless = callbacks.current.reducedMotion;
      if (spec && current.fidelity) displayRef.current = easeDisplayState(spec, displayRef.current ?? current.fidelity, current.fidelity, dt, motionless);
      const list = buildRenderList({ definition, state: current, profile, displayFidelity: displayRef.current, pendingControlId: pendingRef.current });
      // RX-005d: presets with a frame refit to the stage's aspect; rail legs on LOW are cuts.
      const stageAspect = Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight);
      const preset = spec && current.fidelity ? framedPose(spec, findPreset(spec, current.fidelity.cameraPresetId), list.items, definition.scene.camera.fov, stageAspect) : fallbackPose;
      // A18 continuity: a downgrade keeps the learner's view of the same preset until they change preset or Recentre.
      if (carriedPose.current && carriedPose.current.presetId !== current.fidelity?.cameraPresetId) carriedPose.current = null;
      const base = carriedPose.current?.pose ?? preset;
      const targetPose = spec ? constrainCamera({ ...base, distance: base.distance * zoomRef.current }, spec.camera.constraints) : { ...base, distance: base.distance * zoomRef.current };
      camera = camera && !callbacks.current.railActive ? approachCamera(camera, targetPose, dt, motionless) : targetPose;

      const dpr = Math.min(window.devicePixelRatio || 1, list.budget.maxDevicePixelRatio), w = Math.max(1, Math.floor(el.clientWidth * dpr)), h = Math.max(1, Math.floor(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (list.environment === "DAYLIGHT") gl.clearColor(0.86, 0.91, 0.94, 0);
      else gl.clearColor(0.035, 0.055, 0.11, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspect = w / h;
      const fov = fitHorizontalFieldOfView(definition.scene.camera.fov, aspect);
      const viewProj = multiply(perspective(fov, aspect, 0.1, 100), viewMatrix(camera));
      frameRef.current = { list, viewProj, width: el.clientWidth, height: el.clientHeight };
      const t = reviewTime ?? now / 1000;
      const drawItem = (item: RenderList["items"][number], mesh: { position: WebGLBuffer; normal: WebGLBuffer; count: number }, modelMatrix: Mat4) => {
        gl.depthMask(item.alpha >= 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(attr.normal); gl.vertexAttribPointer(attr.normal, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(attr.color); gl.vertexAttrib3f(attr.color, 1, 1, 1); gl.uniform1f(uni.useVertexColor, 0);
        gl.disableVertexAttribArray(attr.emissive); gl.vertexAttrib1f(attr.emissive, 0); gl.uniform1f(uni.useVertexEmissive, 0);
        multiplyInto(mvpScratch, viewProj, modelMatrix); modelMatrixScratch.set(modelMatrix);
        gl.uniformMatrix4fv(uni.mvp, false, mvpScratch); gl.uniformMatrix4fv(uni.model, false, modelMatrixScratch);
        const base = rgb(item.color);
        const pulse = item.highlighted && list.budget.pulseHighlights && !motionless ? Math.sin(t * 4) * 0.04 : 0;
        gl.uniform3fv(uni.color, base); gl.uniform3fv(uni.highlightColor, rgb(HIGHLIGHT_COLOR));
        gl.uniform1f(uni.highlightMix, item.highlighted ? highlightBaseMix(item.color) + pulse : 0); gl.uniform1f(uni.hasHighlight, item.highlighted ? 1 : 0);
        gl.uniform1f(uni.alpha, item.highlighted ? Math.max(item.alpha, 0.65) : item.alpha); gl.uniform1f(uni.emissive, item.emissive); gl.uniform1f(uni.lighting, LIGHTING[list.budget.lighting]);
        gl.uniform1f(uni.clipEnabled, item.clip ? 1 : 0); if (item.clip) gl.uniform4f(uni.clipPlane, item.clip.normal[0], item.clip.normal[1], item.clip.normal[2], item.clip.offset);
        gl.uniform1f(uni.pointSize, 1);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      };
      // RX-006 merges repeated LOW geometry in CPU space. Source ids stay in the
      // plan for picking/labels, while per-part state stays individual.
      let framePlan: FramePlan | null = null;
      if (low) {
        const plan = syncLowBatchCache(lowBatchCache, list);
        framePlan = planLowFrame(list, { traceFlowId: callbacks.current.traceFlowId, plan });
        const planChanged = uploadedLowPlan !== plan;
        for (const batch of plan.batches) {
          let gpu = lowBatchBuffers.get(batch.key);
          if (!gpu) { gpu = { position: gl.createBuffer()!, normal: gl.createBuffer()!, color: gl.createBuffer()!, emissive: gl.createBuffer()!, count: 0, scratch: createLowBatchScratch(), itemRanges: new Map() }; lowBatchBuffers.set(batch.key, gpu); }
          let poseChanged = gpu.count === 0 || gpu.itemRanges.size !== batch.items.length;
          if (!poseChanged) for (const item of batch.items) {
            const range = gpu.itemRanges.get(item.id);
            if (!range) { poseChanged = true; break; }
            for (let index = 0; index < range.matrix.length; index++) if (range.matrix[index] !== item.matrix[index]) { poseChanged = true; break; }
            if (poseChanged) break;
          }
          if (poseChanged) {
            const vertexCount = batch.items.reduce((count, item) => count + dataFor(item).count, 0);
            const grew = ensureLowBatchScratch(gpu.scratch, vertexCount, MAX_LOW_BATCH_VERTICES);
            const { positions, normals, colors, emissions } = gpu.scratch;
            const previousRanges = new Map(gpu.itemRanges);
            gpu.itemRanges.clear();
            let vertexOffset = 0;
            for (const item of batch.items) {
              const data = dataFor(item), origin = transformPoint(item.matrix, [0, 0, 0]), baseColor = rgb(item.color), first = vertexOffset;
              for (let i = 0; i < data.positions.length; i += 3) {
                const point = transformPoint(item.matrix, [data.positions[i], data.positions[i + 1], data.positions[i + 2]]);
                positions.set(point, vertexOffset * 3);
                const transformed = transformPoint(item.matrix, [data.normals[i], data.normals[i + 1], data.normals[i + 2]]);
                let nx = transformed[0] - origin[0], ny = transformed[1] - origin[1], nz = transformed[2] - origin[2]; const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
                normals.set([nx, ny, nz], vertexOffset * 3); colors.set(baseColor, vertexOffset * 3); emissions[vertexOffset] = item.emissive; vertexOffset++;
              }
              const itemVertexCount = vertexOffset - first, previous = previousRanges.get(item.id);
              // Reuse the item's range staging when its size is unchanged (no allocation on a pose-only rebuild).
              const reuse = previous && previous.count === itemVertexCount;
              gpu.itemRanges.set(item.id, { first, count: itemVertexCount, color: item.color, emissive: item.emissive, matrix: reuse ? Object.assign(previous.matrix, item.matrix) : [...item.matrix], colorData: reuse ? previous.colorData : new Float32Array(itemVertexCount * 3), emissiveData: reuse ? previous.emissiveData : new Float32Array(itemVertexCount) });
            }
            gpu.count = vertexCount;
            const upload = (buffer: WebGLBuffer, data: Float32Array, used: number, usage: number) => {
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              if (grew) gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, usage);
              gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, used));
            };
            upload(gpu.position, positions, vertexCount * 3, gl.DYNAMIC_DRAW); upload(gpu.normal, normals, vertexCount * 3, gl.DYNAMIC_DRAW);
            upload(gpu.color, colors, vertexCount * 3, gl.DYNAMIC_DRAW); upload(gpu.emissive, emissions, vertexCount, gl.DYNAMIC_DRAW);
          } else {
            for (const item of batch.items) {
              const range = gpu.itemRanges.get(item.id);
              if (!range) continue;
              const changed = syncLowBatchItemState(range, item);
              if (changed & LOW_BATCH_COLOR_CHANGED) { gl.bindBuffer(gl.ARRAY_BUFFER, gpu.color); gl.bufferSubData(gl.ARRAY_BUFFER, range.first * 3 * Float32Array.BYTES_PER_ELEMENT, range.colorData); }
              if (changed & LOW_BATCH_EMISSIVE_CHANGED) { gl.bindBuffer(gl.ARRAY_BUFFER, gpu.emissive); gl.bufferSubData(gl.ARRAY_BUFFER, range.first * Float32Array.BYTES_PER_ELEMENT, range.emissiveData); }
            }
          }
          const source = batch.items[0];
          gl.depthMask(source.alpha >= 0.9);
          gl.bindBuffer(gl.ARRAY_BUFFER, gpu.position); gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, gpu.normal); gl.enableVertexAttribArray(attr.normal); gl.vertexAttribPointer(attr.normal, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, gpu.color); gl.enableVertexAttribArray(attr.color); gl.vertexAttribPointer(attr.color, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, gpu.emissive); gl.enableVertexAttribArray(attr.emissive); gl.vertexAttribPointer(attr.emissive, 1, gl.FLOAT, false, 0, 0);
          multiplyInto(mvpScratch, viewProj, IDENTITY); modelMatrixScratch.set(IDENTITY); gl.uniformMatrix4fv(uni.mvp, false, mvpScratch); gl.uniformMatrix4fv(uni.model, false, modelMatrixScratch);
          gl.uniform3f(uni.color, 1, 1, 1); gl.uniform3fv(uni.highlightColor, rgb(HIGHLIGHT_COLOR)); gl.uniform1f(uni.highlightMix, 0); gl.uniform1f(uni.hasHighlight, 0);
          gl.uniform1f(uni.useVertexColor, 1); gl.uniform1f(uni.useVertexEmissive, 1); gl.uniform1f(uni.alpha, source.alpha); gl.uniform1f(uni.emissive, 0); gl.uniform1f(uni.lighting, LIGHTING[list.budget.lighting]); gl.uniform1f(uni.clipEnabled, 0); gl.uniform1f(uni.pointSize, 1);
          gl.drawArrays(gl.TRIANGLES, 0, gpu.count);
        }
        if (planChanged) {
          // A batch key that empties keeps its buffers (bounded by the lab's finite batch keys) for when it refills.
          for (const [key, buffers] of lowBatchBuffers) if (!plan.batches.some((batch) => batch.key === key)) { buffers.count = 0; buffers.itemRanges.clear(); }
          uploadedLowPlan = plan;
        }
        for (const item of plan.singles) drawItem(item, meshFor(item), item.spin ? spinMatrix(item.spin, t, motionless) : item.matrix);
      } else {
        const ordered = [...list.items].sort((a, b) => Number(a.alpha < 0.9) - Number(b.alpha < 0.9));
        for (const item of ordered) drawItem(item, meshFor(item), item.spin ? spinMatrix(item.spin, t, motionless) : item.matrix);
      }
      gl.depthMask(true);
      if (list.environment === "DAYLIGHT") drawBatch(groundBatch, groundBuffers, gl.TRIANGLES, 1, 1, viewProj);
      if (list.surfaces.length) drawBatch(writeSurfaceTriangles(list.surfaces, surfaceStorage), surfaceBuffers, gl.TRIANGLES, 1, 1, viewProj);
      batchFlowGeometry(list, t, motionless, callbacks.current.traceFlowId, flowStorage);
      // Process paths are instructional overlays. Letting solid mesh depth hide
      // them made the flood spillway appear inactive in paused review frames.
      // Draw their cased tubes (A10/A13: dark casing first, coloured core over it) and fixed reduced-motion particle
      // cues above solids, then restore depth testing for trace nodes and markers.
      if (list.flows.length) {
        gl.disable(gl.DEPTH_TEST);
        drawBatch(flowStorage.tubes.casing, flowBuffers.casing, gl.TRIANGLES, 1, 1, viewProj);
        drawBatch(flowStorage.tubes.core, flowBuffers.core, gl.TRIANGLES, 1, 1, viewProj);
        drawBatch(flowStorage.particles, flowBuffers.particles, gl.POINTS, 1, (low ? 6 : 9) * dpr, viewProj);
        gl.enable(gl.DEPTH_TEST);
      }
      if (list.flows.length) drawBatch(flowStorage.traceNodes, flowBuffers.traceNodes, gl.POINTS, 1, 12 * dpr, viewProj);
      if (list.markers.length) drawPoints(list.markers, gl.POINTS, MARKER_COLOR, 1, (list.budget.pulseHighlights && !motionless ? 12 + Math.sin(t * 5) * 3 : 12) * dpr, viewProj);

      // Labels are DOM text (sharp at any DPR) repositioned a few times per second rather than every frame.
      const labelNow = reviewTime ?? now;
      if (labels.current && labelNow - labelTick > 120) {
        labelTick = labelNow;
        const status = list.motions.filter((motion) => motion.active).map((motion) => `${motion.label}: turning`).join(". ");
        if (motionStatus.current && motionStatus.current.textContent !== status) motionStatus.current.textContent = status;
        const project = (p: Vec3) => { const c = transformPoint(viewProj, p); return c[2] > 1 ? null : { x: (c[0] * 0.5 + 0.5) * el.clientWidth, y: (0.5 - c[1] * 0.5) * el.clientHeight }; };
        // Spin glyphs are placed first and act as obstacles; labels then go only where they fit wholly on screen
        // without overlapping a glyph or another label (R3 visual: LOW pile-ups and edge fragments).
        const glyphs = list.motions.filter((motion) => motion.active).map((motion) => ({ text: "↻", at: project(motion.center), title: `${motion.label}: turning`, glyph: true, mobileLabel: true }));
        const glyphBoxes = glyphs.flatMap((glyph) => glyph.at ? [{ left: glyph.at.x - 10, top: glyph.at.y - 12, right: glyph.at.x + 10, bottom: glyph.at.y + 12 }] : []);
        const narrowViewport = typeof window !== "undefined" && window.innerWidth <= 500;
        const labelItems = list.items.filter((item) => item.showLabel && item.inFocus && !(narrowViewport && item.mobileLabel === false));
        const placed = placeSceneLabels(labelItems.flatMap((item) => {
          // The label offset is in the part's own space, exactly as on HIGH/STANDARD (R4 visual: world-space offsets
          // put a small part's label on its neighbour).
          const at = project(transformPoint(item.spin ? spinMatrix(item.spin, t, motionless) : item.matrix, item.labelOffset ?? [0, 0, 0]));
          // The pill is drawn translated up by 160 % of its height, so its bottom sits 12 px above the anchor.
          return at ? [{ id: item.id, text: item.label, x: at.x, y: at.y - 12, highlighted: item.highlighted, critical: !!item.labelCritical }] : [];
        }), { width: el.clientWidth, height: el.clientHeight }, 8, glyphBoxes);
        const entries = [
          ...placed.map((label) => ({ text: label.text, at: { x: label.x, y: label.y + 12 }, title: undefined, glyph: false, mobileLabel: true })),
          ...glyphs,
        ];
        labels.current.replaceChildren(...entries.filter((entry) => entry.at).map((entry) => {
          const node = document.createElement("span");
          node.textContent = entry.text; node.dataset.labSceneLabel = "";
          if (entry.title) { node.title = entry.title; node.setAttribute("aria-label", entry.title); node.setAttribute("role", "img"); }
          node.className = entry.glyph ? "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-fuchsia-300 drop-shadow" : `pointer-events-none absolute -translate-x-1/2 -translate-y-[160%] whitespace-nowrap rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px] font-semibold text-slate-100${entry.mobileLabel === false ? " max-[500px]:hidden" : ""}`;
          // Whole pixels: a fractional position rasterises its pill edge differently run to run (A9 determinism).
          node.style.left = `${Math.round(entry.at!.x)}px`; node.style.top = `${Math.round(entry.at!.y)}px`;
          return node;
        }));
        // A15: reduced motion keeps static direction cues; LOW shows an emitter's glyph proxy in place of particles.
        const glyphProxies = list.emitters.filter((emitter) => emitter.active && emitter.lowProxy.kind === "glyph").map((emitter) => ({ id: `proxy:${emitter.id}`, kind: "glyph" as const, glyph: emitter.lowProxy.kind === "glyph" ? emitter.lowProxy.glyph : "", position: emitter.origin, direction: emitter.direction, color: emitter.color }));
        const focusedControl = (document.activeElement as HTMLElement | null)?.dataset.labHitProxy;
        controlTargets.current?.replaceChildren(...controlTargetElements(list.items, project, el.clientWidth, el.clientHeight, (pick) => onPickRef.current(pick), el.getBoundingClientRect().top, el.getBoundingClientRect().left));
        if (focusedControl) controlTargets.current?.querySelector<HTMLButtonElement>(`[data-lab-hit-proxy="${focusedControl}"]`)?.focus();
        labels.current.append(...cueElements([...(motionless ? list.cues : []), ...glyphProxies], project), ...statusBadgeElements(list.items, project), ...controlAffordanceElements(list.items, project));
      }
      const fidelityMoving = !!(spec && current.fidelity && displayRef.current && !isSettled(displayRef.current, current.fidelity));
      const cameraMoving = !motionless && (Math.abs(camera.distance - targetPose.distance) > 1e-4 || Math.abs(camera.yaw - targetPose.yaw) > 1e-4 || Math.abs(camera.pitch - targetPose.pitch) > 1e-4 || camera.target.some((value, index) => Math.abs(value - targetPose.target[index]) > 1e-4));
      const flowMoving = list.flows.some((flow) => flow.active && flow.particleCount > 0);
      const spinMoving = list.motions.some((motion) => motion.active);
      const pulseMoving = list.budget.pulseHighlights && list.items.some((item) => item.highlighted);
      // Review captures advance an authored virtual clock and need a frame for every tick.
      // Learner sessions request frames only while something visible is moving.
      const profileProbeActive = allowProfileUpgrade && !upgradeNotified && profile === "LOW" && frameTimes.length < 30;
      framesRendered += 1;
      if (root.current) { root.current.dataset.labDrawCalls = String(frameDraws); root.current.dataset.labFramesRendered = String(framesRendered); publishFramePlan(root.current, framePlan, false); if (!root.current.dataset.labSceneReady) { root.current.dataset.labSceneReady = "true"; callbacks.current.onReady?.(); } }
      lastFrame = { draws: frameDraws, triangles: frameTriangles, plan: framePlan };
      frameDraws = 0; frameTriangles = 0;
      ambientOnly = reviewTime === undefined && !fidelityMoving && !cameraMoving && !profileProbeActive && (flowMoving || spinMoving || pulseMoving);
      if (shouldScheduleWebGLFrame({ reviewClockActive: reviewTime !== undefined, reducedMotion: motionless, fidelityMoving, cameraMoving, flowMoving, spinMoving, pulseMoving, profileProbeActive })) {
        previousFrameScheduled = true;
        scheduleDraw();
      }
    };
    requestDrawRef.current = requestDraw;
    const resizeObserver = new ResizeObserver(requestDraw); resizeObserver.observe(el);
    const stopWatching = review ? () => {} : watchSceneVisibility(el, (next) => {
      active = next;
      if (next) requestDraw();
      else { cancelAnimationFrame(frame); frame = 0; previousFrameScheduled = false; }
    }, browserVisibilityDeps());
    requestDraw();
    return () => {
      requestDrawRef.current = () => {};
      if (reviewWindow.__labReviewFrameProbe === probe) delete reviewWindow.__labReviewFrameProbe;
      resizeObserver.disconnect();
      stopWatching();
      cancelAnimationFrame(frame);
      el.removeEventListener("webglcontextlost", handleContextLost);
      meshes.forEach((mesh) => { gl.deleteBuffer(mesh.position); gl.deleteBuffer(mesh.normal); });
      lowBatchBuffers.forEach((buffers) => { gl.deleteBuffer(buffers.position); gl.deleteBuffer(buffers.normal); gl.deleteBuffer(buffers.color); gl.deleteBuffer(buffers.emissive); });
      gl.deleteBuffer(lineBuffer);
      Object.values(flowBuffers).forEach((buffers) => { gl.deleteBuffer(buffers.positions); gl.deleteBuffer(buffers.colors); });
      gl.deleteBuffer(surfaceBuffers.positions); gl.deleteBuffer(surfaceBuffers.colors); gl.deleteBuffer(groundBuffers.positions); gl.deleteBuffer(groundBuffers.colors);
      gl.deleteProgram(program);
      // Defer forced loss one task so React StrictMode's development remount can reuse the live context.
      pendingContextLoss.current = window.setTimeout(() => {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        pendingContextLoss.current = null;
        if (review) reviewWindow.__labReviewLiveRenderers = (reviewWindow.__labReviewLiveRenderers ?? 1) - 1;
      }, 0);
    };
  }, [definition, profile, allowPerformanceDowngrade, allowProfileUpgrade, review]);

  useEffect(() => { requestDrawRef.current(); }, [state, reducedMotion, traceFlowId, pendingControlId]);
  useEffect(() => { if (recenter) carriedPose.current = null; zoomRef.current = 1; requestDrawRef.current(); }, [recenter]);

  const projector = () => { const { viewProj, width, height } = frameRef.current; return (p: Vec3) => { const c = transformPoint(viewProj, p); return c[0] < -1 || c[0] > 1 || c[1] < -1 || c[1] > 1 || c[2] < -1 || c[2] > 1 ? null : { x: (c[0] * 0.5 + 0.5) * width, y: (0.5 - c[1] * 0.5) * height, depth: c[2] }; }; };
  const pick = (clientX: number, clientY: number, target: HTMLElement) => {
    const { list } = frameRef.current; if (!list) return;
    const rect = target.getBoundingClientRect();
    const hit = pickNearest(list, projector(), { x: clientX - rect.left, y: clientY - rect.top }, traceFlowId);
    if (hit) onPick(hit);
  };
  /** A14: the drag-variable control part under the pointer, if any (drags it instead of rotating). */
  const dragControlAt = (clientX: number, clientY: number, target: HTMLElement): RenderItem | null => {
    const { list } = frameRef.current; if (!list) return null;
    const rect = target.getBoundingClientRect();
    const hit = pickNearest(list, projector(), { x: clientX - rect.left, y: clientY - rect.top }, null);
    return hit?.kind === "item" && hit.item.control?.dragAxis ? hit.item : null;
  };

  const constraints = definition.fidelity?.camera.constraints;
  return (
    <div ref={root} data-lab-renderer="webgl-pass" className={`relative ${SCENE_HEIGHT} w-full`}>
      <canvas ref={canvas} aria-label={`${definition.title ?? "Interactive"} 3D scene. Every scene action is also available in the controls panel.`} className="h-full w-full touch-none"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, active: true, moved: 0, control: dragControlAt(e.clientX, e.clientY, e.currentTarget) }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!drag.current.active) { if (e.pointerType === "mouse") { const control = dragControlAt(e.clientX, e.clientY, e.currentTarget) ?? null; const { list } = frameRef.current; const rect = e.currentTarget.getBoundingClientRect(); const hit = list ? pickNearest(list, projector(), { x: e.clientX - rect.left, y: e.clientY - rect.top }, null) : null; e.currentTarget.style.cursor = controlCursor(control?.control ?? (hit?.kind === "item" ? hit.item.control : undefined)); } return; }
          const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
          drag.current = { ...drag.current, x: e.clientX, y: e.clientY, moved: drag.current.moved + Math.abs(dx) + Math.abs(dy) };
          const control = drag.current.control;
          if (control?.control?.dragAxis) {
            if (drag.current.moved < 6) return; // A14 dead-zone: a tap never jumps the value.
            const project = projector(), rect = e.currentTarget.getBoundingClientRect(), [a, b] = control.control.dragAxis, start = project(a), end = project(b);
            if (start && end) onDragControl?.(control.id, dragParameter(start, end, { x: e.clientX - rect.left, y: e.clientY - rect.top }));
            return;
          }
          const selected = state.selectedObjectId;
          if (drag.current.moved > 6 && selected && definition.scene.objects.some((object) => object.id === selected)) dispatch({ type: "rotate", objectId: selected, delta: [dx * 0.012, dy * 0.012] });
        }}
        onPointerUp={(e) => { const wasClick = drag.current.moved < 6; drag.current.active = false; if (wasClick) pick(e.clientX, e.clientY, e.currentTarget); }}
        onWheel={(e) => { if (!constraints) return; zoomRef.current = Math.min(constraints.maxDistance / constraints.minDistance, Math.max(0.5, zoomRef.current * (e.deltaY > 0 ? 1.08 : 0.92))); requestDrawRef.current(); }}
      />
      <div ref={controlTargets} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
      <div ref={motionStatus} className="sr-only" role="status" aria-live="polite" />
    </div>
  );
}
