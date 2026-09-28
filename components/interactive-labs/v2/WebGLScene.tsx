"use client";

import { useEffect, useRef } from "react";
import type { CapabilityProfile, GeometryKind, InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import type { FidelityState } from "@/lib/interactive-labs/v2/fidelity/types";
import { buildRenderList, type RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { approachCamera, constrainCamera, easeDisplayState, flowParticles, presetPose, viewMatrix, type CameraPose } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { downgradeFrameBudgetMs } from "@/lib/interactive-labs/v2/production/budgets";
import { IDENTITY, multiply, perspective, transformPoint, type Mat4, type Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";
import { buildMesh } from "./meshes";
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
};

const vertexShader = `attribute vec3 position; attribute vec3 normal; uniform mat4 mvp; uniform mat4 model; uniform float pointSize; varying vec3 vNormal; varying vec3 vWorld;
void main(){ vec4 world = model * vec4(position, 1.0); vWorld = world.xyz; vNormal = mat3(model) * normal; gl_Position = mvp * vec4(position, 1.0); gl_PointSize = pointSize; }`;
const fragmentShader = `precision mediump float; varying vec3 vNormal; varying vec3 vWorld; uniform vec3 color; uniform float alpha; uniform float emissive; uniform float lighting; uniform vec4 clipPlane; uniform float clipEnabled;
void main(){
  if (clipEnabled > 0.5 && dot(clipPlane.xyz, vWorld) > clipPlane.w) discard;
  vec3 n = normalize(vNormal); if (!gl_FrontFacing) n = -n;
  vec3 l = normalize(vec3(-0.35, 0.7, 1.0));
  float diffuse = max(dot(n, l), 0.0);
  float ambient = lighting > 2.5 ? 0.38 : 0.5;
  float shade = lighting < 0.5 ? 1.0 : ambient + (1.0 - ambient) * diffuse;
  float spec = lighting > 2.5 ? pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * 0.28 : 0.0;
  vec3 glow = emissive * vec3(1.0, 0.86, 0.45);
  gl_FragColor = vec4(color * shade + spec + glow, clamp(alpha + emissive * 0.4, 0.0, 1.0));
}`;
const LIGHTING = { full: 3, simplified: 2, minimal: 1, none: 0 } as const;

function rgb(value: string): [number, number, number] { const n = Number.parseInt(value.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

export function WebGLScene({ definition, state, profile, reducedMotion, traceFlowId, dispatch, onPick, onDowngrade }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, y: 0, active: false, moved: 0 });
  const stateRef = useRef(state);
  const displayRef = useRef<FidelityState | undefined>(state.fidelity);
  const zoomRef = useRef(1);
  const frameRef = useRef<{ list: RenderList | null; viewProj: Mat4; width: number; height: number }>({ list: null, viewProj: IDENTITY, width: 1, height: 1 });
  const callbacks = useRef({ onDowngrade, reducedMotion, traceFlowId });
  stateRef.current = state;
  callbacks.current = { onDowngrade, reducedMotion, traceFlowId };

  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext("webgl", { antialias: profile === "HIGH", alpha: true, premultipliedAlpha: false });
    if (!gl) { callbacks.current.onDowngrade("context"); return; }
    const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { callbacks.current.onDowngrade("context"); return; }
    gl.useProgram(program);
    const attr = { position: gl.getAttribLocation(program, "position"), normal: gl.getAttribLocation(program, "normal") };
    const uni = Object.fromEntries(["mvp", "model", "pointSize", "color", "alpha", "emissive", "lighting", "clipPlane", "clipEnabled"].map((name) => [name, gl.getUniformLocation(program, name)])) as Record<string, WebGLUniformLocation | null>;
    const spec = definition.fidelity;
    const low = profile === "LOW";
    // Meshes are built once per geometry and profile, never per frame.
    const meshes = new Map<GeometryKind, { position: WebGLBuffer; normal: WebGLBuffer; count: number }>();
    const meshFor = (kind: GeometryKind) => {
      let mesh = meshes.get(kind);
      if (!mesh) {
        const data = buildMesh(kind, low);
        const position = gl.createBuffer()!, normal = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, normal); gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
        mesh = { position, normal, count: data.count }; meshes.set(kind, mesh);
      }
      return mesh;
    };
    const lineBuffer = gl.createBuffer()!;
    const drawPoints = (points: Vec3[], mode: number, color: string, alpha: number, size: number, viewProj: Mat4) => {
      if (points.length === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points.flat()), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
      gl.disableVertexAttribArray(attr.normal); gl.vertexAttrib3f(attr.normal, 0, 0, 1);
      gl.uniformMatrix4fv(uni.mvp, false, new Float32Array(viewProj)); gl.uniformMatrix4fv(uni.model, false, new Float32Array(IDENTITY));
      gl.uniform3fv(uni.color, rgb(color)); gl.uniform1f(uni.alpha, alpha); gl.uniform1f(uni.emissive, 0); gl.uniform1f(uni.lighting, 0); gl.uniform1f(uni.clipEnabled, 0); gl.uniform1f(uni.pointSize, size);
      gl.drawArrays(mode, 0, points.length);
    };

    const fallbackPose: CameraPose = { target: [0, 0, 0], distance: 11, yaw: 0, pitch: 0 };
    let camera: CameraPose | null = null;
    let frame = 0, last = performance.now(), labelTick = 0;
    const frameTimes: number[] = [];
    let downgraded = false;
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      frameTimes.push(dt * 1000); if (frameTimes.length > 120) frameTimes.shift();
      if (!downgraded && shouldDowngrade(frameTimes, downgradeFrameBudgetMs(profile))) { downgraded = true; callbacks.current.onDowngrade("performance"); }
      const current = stateRef.current, motionless = callbacks.current.reducedMotion;
      if (spec && current.fidelity) displayRef.current = easeDisplayState(spec, displayRef.current ?? current.fidelity, current.fidelity, dt, motionless);
      const list = buildRenderList({ definition, state: current, profile, displayFidelity: displayRef.current });
      const preset = spec && current.fidelity ? presetPose(spec, current.fidelity.cameraPresetId) : fallbackPose;
      const targetPose = spec ? constrainCamera({ ...preset, distance: preset.distance * zoomRef.current }, spec.camera.constraints) : { ...preset, distance: preset.distance * zoomRef.current };
      camera = camera ? approachCamera(camera, targetPose, dt, motionless) : targetPose;

      const dpr = Math.min(window.devicePixelRatio || 1, list.budget.maxDevicePixelRatio), w = Math.max(1, Math.floor(el.clientWidth * dpr)), h = Math.max(1, Math.floor(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.035, 0.055, 0.11, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const viewProj = multiply(perspective(definition.scene.camera.fov, w / h, 0.1, 100), viewMatrix(camera));
      frameRef.current = { list, viewProj, width: el.clientWidth, height: el.clientHeight };
      const t = now / 1000;
      // Opaque first, then translucent without depth writes so cut-away glass and faded context blend correctly.
      const ordered = [...list.items].sort((a, b) => Number(a.alpha < 0.9) - Number(b.alpha < 0.9));
      for (const item of ordered) {
        const mesh = meshFor(item.geometry);
        gl.depthMask(item.alpha >= 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(attr.position); gl.vertexAttribPointer(attr.position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(attr.normal); gl.vertexAttribPointer(attr.normal, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(uni.mvp, false, new Float32Array(multiply(viewProj, item.matrix))); gl.uniformMatrix4fv(uni.model, false, new Float32Array(item.matrix));
        const pulse = item.highlighted && list.budget.pulseHighlights && !motionless ? 0.12 + Math.sin(t * 4) * 0.08 : item.highlighted ? 0.12 : 0;
        const base = rgb(item.color);
        gl.uniform3fv(uni.color, item.highlighted ? base.map((c) => Math.min(1, c + 0.12)) : base);
        gl.uniform1f(uni.alpha, item.alpha); gl.uniform1f(uni.emissive, Math.max(item.emissive, pulse)); gl.uniform1f(uni.lighting, LIGHTING[list.budget.lighting]);
        gl.uniform1f(uni.clipEnabled, item.clip ? 1 : 0); if (item.clip) gl.uniform4f(uni.clipPlane, item.clip.normal[0], item.clip.normal[1], item.clip.normal[2], item.clip.offset);
        gl.uniform1f(uni.pointSize, 1);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      }
      gl.depthMask(true);
      for (const flow of list.flows) {
        drawPoints(flow.points, gl.LINE_STRIP, flow.active ? flow.color : "#64748b", flow.active ? 0.75 : 0.5, 1, viewProj);
        drawPoints(flowParticles(flow.points, flow.particleCount, flow.rate, flow.direction, t, motionless), gl.POINTS, flow.color, 1, (low ? 6 : 9) * dpr, viewProj);
        if (callbacks.current.traceFlowId === flow.id) drawPoints(flow.nodes.filter((node) => node.traceable).map((node) => node.position), gl.POINTS, "#e2e8f0", 0.9, 12 * dpr, viewProj);
      }
      if (list.markers.length) drawPoints(list.markers.map((marker) => marker.position), gl.POINTS, "#67e8f9", 1, (list.budget.pulseHighlights && !motionless ? 12 + Math.sin(t * 5) * 3 : 12) * dpr, viewProj);

      // Labels are DOM text (sharp at any DPR) repositioned a few times per second rather than every frame.
      if (labels.current && now - labelTick > 120) {
        labelTick = now;
        const project = (p: Vec3) => { const c = transformPoint(viewProj, p); return c[2] > 1 ? null : { x: (c[0] * 0.5 + 0.5) * el.clientWidth, y: (0.5 - c[1] * 0.5) * el.clientHeight }; };
        const entries = list.items.filter((item) => item.showLabel && item.inFocus && (!low || item.highlighted)).map((item) => ({ text: item.label, at: project(item.center) }));
        labels.current.replaceChildren(...entries.filter((entry) => entry.at).map((entry) => {
          const node = document.createElement("span");
          node.textContent = entry.text;
          node.className = "pointer-events-none absolute -translate-x-1/2 -translate-y-[160%] whitespace-nowrap rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px] font-semibold text-slate-100";
          node.style.left = `${entry.at!.x}px`; node.style.top = `${entry.at!.y}px`;
          return node;
        }));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); meshes.forEach((mesh) => { gl.deleteBuffer(mesh.position); gl.deleteBuffer(mesh.normal); }); gl.deleteBuffer(lineBuffer); gl.deleteProgram(program); };
  }, [definition, profile]);

  const pick = (clientX: number, clientY: number, target: HTMLElement) => {
    const { list, viewProj, width, height } = frameRef.current; if (!list) return;
    const rect = target.getBoundingClientRect();
    const project = (p: Vec3) => { const c = transformPoint(viewProj, p); return c[2] > 1 ? null : { x: (c[0] * 0.5 + 0.5) * width, y: (0.5 - c[1] * 0.5) * height }; };
    const hit = pickNearest(list, project, { x: clientX - rect.left, y: clientY - rect.top }, traceFlowId);
    if (hit) onPick(hit);
  };

  const constraints = definition.fidelity?.camera.constraints;
  return (
    <div className="relative h-[clamp(420px,62vh,640px)] w-full">
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
        onWheel={(e) => { if (!constraints) return; zoomRef.current = Math.min(constraints.maxDistance / constraints.minDistance, Math.max(0.5, zoomRef.current * (e.deltaY > 0 ? 1.08 : 0.92))); }}
      />
      <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
    </div>
  );
}
