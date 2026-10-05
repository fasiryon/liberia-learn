"use client";

import { useEffect, useRef } from "react";
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import type { FidelityState } from "@/lib/interactive-labs/v2/fidelity/types";
import { buildRenderList, type RenderList, type RenderMarker } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { approachCamera, constrainCamera, easeDisplayState, isSettled, spinMatrix, viewMatrix, type CameraPose } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { findPreset, framedPose } from "@/lib/interactive-labs/v2/fidelity/camera";
import { recordFrameSample, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { probeAllowsUpgrade } from "@/lib/interactive-labs/v2/capabilities";
import { downgradeFrameBudgetMs } from "@/lib/interactive-labs/v2/production/budgets";
import { fitHorizontalFieldOfView, IDENTITY, multiply, perspective, transformPoint, type Mat4, type Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";
import { batchFlowGeometry, createFlowBatchStorage, createPointBatchStorage, writeMarkerPositions, type FlowVertexBatch } from "@/lib/interactive-labs/v2/fidelity/flowBatch";
import { shouldScheduleWebGLFrame } from "@/lib/interactive-labs/v2/fidelity/renderLoop";
import { browserVisibilityDeps, shouldDrawFrame, watchSceneVisibility } from "@/lib/interactive-labs/v2/fidelity/sceneActivity";
import { highlightBaseMix, HIGHLIGHT_COLOR, MARKER_COLOR } from "@/lib/interactive-labs/v2/fidelity/palette";
import { placeSceneLabels } from "@/lib/interactive-labs/v2/fidelity/labelLayout";
import { buildMesh } from "./meshes";
import { buildParametricGeometry } from "@/lib/interactive-labs/v2/fidelity/geometry/builders";
import { planLowBatches } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
import { planLowFrame, type FramePlan } from "@/lib/interactive-labs/v2/fidelity/framePlan";
import { publishFramePlan, type ReviewFrameProbe } from "@/lib/interactive-labs/v2/review/framePlanEvidence";
import { createSurfaceTriangleStorage, writeSurfaceTriangles } from "@/lib/interactive-labs/v2/fidelity/surfaces";
import type { MeshData } from "./meshes";
import { pickNearest, type ScenePick } from "./picking";

type Props = {
  definition: InteractiveLabDefinition<LabState>;
  state: LabState;
  profile: CapabilityProfile;
  reducedMotion: boolean;
  traceFlowId: string | null;
  dispatch: (action: LabAction) => void;
  onPick: (pick: ScenePick) => void;
  onDowngrade: (reason: "context" | "performance") => void;
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
};

const vertexShader = `attribute vec3 position; attribute vec3 normal; attribute vec3 vcolor; uniform mat4 mvp; uniform mat4 model; uniform float pointSize; uniform float useVertexColor; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vertexColor;
void main(){ vec4 world = model * vec4(position, 1.0); vWorld = world.xyz; vNormal = mat3(model) * normal; vertexColor = mix(vec3(1.0), vcolor, useVertexColor); gl_Position = mvp * vec4(position, 1.0); gl_PointSize = pointSize; }`;
const fragmentShader = `precision mediump float; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vertexColor; uniform vec3 color; uniform vec3 highlightColor; uniform float highlightMix; uniform float hasHighlight; uniform float alpha; uniform float emissive; uniform float lighting; uniform vec4 clipPlane; uniform float clipEnabled;
void main(){
  if (clipEnabled > 0.5 && dot(clipPlane.xyz, vWorld) > clipPlane.w) discard;
  vec3 n = normalize(vNormal); if (!gl_FrontFacing) n = -n;
  vec3 l = normalize(vec3(-0.35, 0.7, 1.0));
  float diffuse = max(dot(n, l), 0.0);
  float ambient = lighting > 2.5 ? 0.38 : 0.5;
  float shade = lighting < 0.5 ? 1.0 : ambient + (1.0 - ambient) * diffuse;
  float spec = lighting > 2.5 ? pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * 0.28 : 0.0;
  // State emission must brighten an item without washing the full surface to white.
  vec3 glow = emissive * vec3(0.22, 0.19, 0.10);
  vec3 base = color * vertexColor * shade + spec + glow;
  float rim = pow(1.0 - abs(dot(n, normalize(vec3(0.0, 0.0, 1.0)))), 3.0);
  vec3 highlighted = mix(base, highlightColor, clamp(highlightMix + rim * 0.55, 0.0, 0.9));
  gl_FragColor = vec4(mix(base, highlighted, hasHighlight), clamp(alpha + emissive * 0.4, 0.0, 1.0));
}`;
const LIGHTING = { full: 3, simplified: 2, minimal: 1, none: 0 } as const;

/** A11: at most 8 scene labels, highlighted parts first; the parts list carries the rest. */

/** Shared with ThreeScene's daylight ground plane. */
const GROUND_Y = -2.25;

function rgb(value: string): [number, number, number] { const n = Number.parseInt(value.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

export function WebGLScene({ definition, state, profile, reducedMotion, traceFlowId, dispatch, onPick, onDowngrade, onUpgradeReady, allowProfileUpgrade = false, allowPerformanceDowngrade = true, review = false, onReady, railActive = false, recenter = 0 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Review evidence: identity, frames drawn and last-frame draw calls on the root (rendererIdentity.ts).
  const root = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const motionStatus = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, y: 0, active: false, moved: 0 });
  const stateRef = useRef(state);
  const displayRef = useRef<FidelityState | undefined>(state.fidelity);
  const zoomRef = useRef(1);
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
    const attr = { position: gl.getAttribLocation(program, "position"), normal: gl.getAttribLocation(program, "normal"), color: gl.getAttribLocation(program, "vcolor") };
    const uni = Object.fromEntries(["mvp", "model", "pointSize", "color", "highlightColor", "highlightMix", "hasHighlight", "useVertexColor", "alpha", "emissive", "lighting", "clipPlane", "clipEnabled"].map((name) => [name, gl.getUniformLocation(program, name)])) as Record<string, WebGLUniformLocation | null>;
    const spec = definition.fidelity;
    const low = profile === "LOW";
    // Meshes are built once per geometry and profile, never per frame.
    const meshes = new Map<string, { position: WebGLBuffer; normal: WebGLBuffer; count: number }>();
    const cpuMeshes = new Map<string, MeshData>();
    const lowBatchBuffers = new Map<string, { position: WebGLBuffer; normal: WebGLBuffer; count: number; signature: string }>();
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
    const flowBuffers = Object.fromEntries(["lines", "particles", "traceNodes"].map((key) => [key, { positions: gl.createBuffer()!, colors: gl.createBuffer()!, capacity: 0 }])) as Record<"lines" | "particles" | "traceNodes", { positions: WebGLBuffer; colors: WebGLBuffer; capacity: number }>;
    const uploadBatch = (batch: FlowVertexBatch, gpu: { positions: WebGLBuffer; colors: WebGLBuffer; capacity: number }) => {
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
      gl.uniformMatrix4fv(uni.mvp, false, new Float32Array(viewProj)); gl.uniformMatrix4fv(uni.model, false, new Float32Array(IDENTITY));
      gl.uniform3fv(uni.color, rgb(color)); gl.uniform3fv(uni.highlightColor, rgb(HIGHLIGHT_COLOR)); gl.uniform1f(uni.highlightMix, 0); gl.uniform1f(uni.hasHighlight, 0); gl.uniform1f(uni.useVertexColor, 0);
      gl.uniform1f(uni.alpha, alpha); gl.uniform1f(uni.emissive, 0); gl.uniform1f(uni.lighting, 0); gl.uniform1f(uni.clipEnabled, 0); gl.uniform1f(uni.pointSize, size);
      gl.drawArrays(mode, 0, markers.length);
    };
    const drawBatch = (batch: FlowVertexBatch, gpu: { positions: WebGLBuffer; colors: WebGLBuffer; capacity: number }, mode: number, alpha: number, size: number, viewProj: Mat4) => {
      if (!batch.count) return;
      uploadBatch(batch, gpu);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.positions); gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.colors); gl.enableVertexAttribArray(attr.color); gl.vertexAttribPointer(attr.color, 3, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(attr.normal); gl.vertexAttrib3f(attr.normal, 0, 0, 1);
      gl.uniformMatrix4fv(uni.mvp, false, new Float32Array(viewProj)); gl.uniformMatrix4fv(uni.model, false, new Float32Array(IDENTITY));
      gl.uniform3f(uni.color, 1, 1, 1); gl.uniform3fv(uni.highlightColor, rgb(HIGHLIGHT_COLOR)); gl.uniform1f(uni.highlightMix, 0); gl.uniform1f(uni.hasHighlight, 0); gl.uniform1f(uni.useVertexColor, 1);
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
      const list = buildRenderList({ definition, state: current, profile, displayFidelity: displayRef.current });
      // RX-005d: presets with a frame refit to the stage's aspect; rail legs on LOW are cuts.
      const stageAspect = Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight);
      const preset = spec && current.fidelity ? framedPose(spec, findPreset(spec, current.fidelity.cameraPresetId), list.items, definition.scene.camera.fov, stageAspect) : fallbackPose;
      const targetPose = spec ? constrainCamera({ ...preset, distance: preset.distance * zoomRef.current }, spec.camera.constraints) : { ...preset, distance: preset.distance * zoomRef.current };
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
        gl.uniformMatrix4fv(uni.mvp, false, new Float32Array(multiply(viewProj, modelMatrix))); gl.uniformMatrix4fv(uni.model, false, new Float32Array(modelMatrix));
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
        const plan = planLowBatches(list);
        framePlan = planLowFrame(list, { traceFlowId: callbacks.current.traceFlowId, plan });
        const activeBatchKeys = new Set(plan.batches.map((batch) => batch.key));
        for (const batch of plan.batches) {
          const signature = JSON.stringify(batch.items.map((item) => [item.id, item.matrix]));
          let gpu = lowBatchBuffers.get(batch.key);
          if (!gpu) { gpu = { position: gl.createBuffer()!, normal: gl.createBuffer()!, count: 0, signature: "" }; lowBatchBuffers.set(batch.key, gpu); }
          if (gpu.signature !== signature) {
            const positions: number[] = [], normals: number[] = [];
            for (const item of batch.items) {
              const data = dataFor(item), origin = transformPoint(item.matrix, [0, 0, 0]);
              for (let i = 0; i < data.positions.length; i += 3) {
                const point = transformPoint(item.matrix, [data.positions[i], data.positions[i + 1], data.positions[i + 2]]);
                positions.push(...point);
                const transformed = transformPoint(item.matrix, [data.normals[i], data.normals[i + 1], data.normals[i + 2]]);
                let nx = transformed[0] - origin[0], ny = transformed[1] - origin[1], nz = transformed[2] - origin[2]; const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length; normals.push(nx, ny, nz);
              }
            }
            gpu.count = positions.length / 3; gpu.signature = signature;
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, gpu.normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
          }
          const source = batch.items[0]; drawItem(source, gpu, IDENTITY);
        }
        for (const [key, buffers] of lowBatchBuffers) if (!activeBatchKeys.has(key)) { gl.deleteBuffer(buffers.position); gl.deleteBuffer(buffers.normal); lowBatchBuffers.delete(key); }
        const singles = [...plan.singles].sort((a, b) => Number(a.alpha < 0.9) - Number(b.alpha < 0.9));
        for (const item of singles) drawItem(item, meshFor(item), item.spin ? spinMatrix(item.spin, t, motionless) : item.matrix);
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
      // Draw their thin lines and fixed reduced-motion particle cues above
      // solids, then restore depth testing for trace nodes and markers.
      if (list.flows.length) {
        gl.disable(gl.DEPTH_TEST);
        drawBatch(flowStorage.lines, flowBuffers.lines, gl.LINES, 1, 1, viewProj);
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
          const center = item.spin ? transformPoint(spinMatrix(item.spin, t, motionless), [0, 0, 0]) : item.center;
          const offset = item.labelOffset ?? [0, 0, 0];
          const at = project([center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]]);
          // The pill is drawn translated up by 160 % of its height, so its bottom sits 12 px above the anchor.
          return at ? [{ id: item.id, text: item.label, x: at.x, y: at.y - 12, highlighted: item.highlighted }] : [];
        }), { width: el.clientWidth, height: el.clientHeight }, 8, glyphBoxes);
        const entries = [
          ...placed.map((label) => ({ text: label.text, at: { x: label.x, y: label.y + 12 }, title: undefined, glyph: false, mobileLabel: true })),
          ...glyphs,
        ];
        labels.current.replaceChildren(...entries.filter((entry) => entry.at).map((entry) => {
          const node = document.createElement("span");
          node.textContent = entry.text;
          if (entry.title) { node.title = entry.title; node.setAttribute("aria-label", entry.title); node.setAttribute("role", "img"); }
          node.className = entry.glyph ? "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-fuchsia-300 drop-shadow" : `pointer-events-none absolute -translate-x-1/2 -translate-y-[160%] whitespace-nowrap rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px] font-semibold text-slate-100${entry.mobileLabel === false ? " max-[500px]:hidden" : ""}`;
          node.style.left = `${entry.at!.x}px`; node.style.top = `${entry.at!.y}px`;
          return node;
        }));
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
      lowBatchBuffers.forEach((buffers) => { gl.deleteBuffer(buffers.position); gl.deleteBuffer(buffers.normal); });
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

  useEffect(() => { requestDrawRef.current(); }, [state, reducedMotion, traceFlowId]);
  useEffect(() => { zoomRef.current = 1; requestDrawRef.current(); }, [recenter]);

  const pick = (clientX: number, clientY: number, target: HTMLElement) => {
    const { list, viewProj, width, height } = frameRef.current; if (!list) return;
    const rect = target.getBoundingClientRect();
    const project = (p: Vec3) => { const c = transformPoint(viewProj, p); return c[2] > 1 ? null : { x: (c[0] * 0.5 + 0.5) * width, y: (0.5 - c[1] * 0.5) * height }; };
    const hit = pickNearest(list, project, { x: clientX - rect.left, y: clientY - rect.top }, traceFlowId);
    if (hit) onPick(hit);
  };

  const constraints = definition.fidelity?.camera.constraints;
  return (
    <div ref={root} data-lab-renderer="webgl-pass" className="relative h-[clamp(420px,62vh,640px)] w-full">
      <canvas ref={canvas} aria-label={`${definition.title ?? "Interactive"} 3D scene. Every scene action is also available in the controls panel.`} className="h-full w-full touch-none"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, active: true, moved: 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!drag.current.active) return;
          const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY, active: true, moved: drag.current.moved + Math.abs(dx) + Math.abs(dy) };
          const selected = state.selectedObjectId;
          if (drag.current.moved > 6 && selected && definition.scene.objects.some((object) => object.id === selected)) dispatch({ type: "rotate", objectId: selected, delta: [dx * 0.012, dy * 0.012] });
        }}
        onPointerUp={(e) => { const wasClick = drag.current.moved < 6; drag.current.active = false; if (wasClick) pick(e.clientX, e.clientY, e.currentTarget); }}
        onWheel={(e) => { if (!constraints) return; zoomRef.current = Math.min(constraints.maxDistance / constraints.minDistance, Math.max(0.5, zoomRef.current * (e.deltaY > 0 ? 1.08 : 0.92))); requestDrawRef.current(); }}
      />
      <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
      <div ref={motionStatus} className="sr-only" role="status" aria-live="polite" />
    </div>
  );
}
