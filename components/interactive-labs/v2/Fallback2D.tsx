"use client";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { dragParameter } from "@/lib/interactive-labs/v2/fidelity/controls";
import { SCENE_HEIGHT } from "./sceneLayout";
import type { InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { buildRenderList, fallbackVisibleItems } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { flowParticles } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { emitterParticles } from "@/lib/interactive-labs/v2/fidelity/emitters";
import { HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR, MARKER_COLOR, mixHexColor } from "@/lib/interactive-labs/v2/fidelity/palette";
import { transformPoint } from "@/lib/interactive-labs/v2/fidelity/math";
import { fallbackFrame, findPreset } from "@/lib/interactive-labs/v2/fidelity/camera";
import { convexHull, silhouetteSamples } from "./meshes";
import type { ScenePick } from "./picking";
import { useDisplayFidelity } from "./useDisplayFidelity";
import { SURFACE_SHALLOW } from "@/lib/interactive-labs/v2/fidelity/surfaces";
import { FLOW_CASING_COLOR } from "@/lib/interactive-labs/v2/fidelity/flowTubes";
import { ENVIRONMENT_BACKDROP } from "@/lib/interactive-labs/v2/fidelity/palette";

// Fixed precision keeps server and client SVG output identical (no hydration mismatch from float noise).
const round = (value: number) => Math.round(value * 1000) / 1000;
/** An energised part (lit city block, live gauge segment) is filled warm in 2D; a dead one keeps its base colour. */
const LIT_COLOR = "#fde68a";

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; reducedMotion: boolean; traceFlowId: string | null; dispatch: (action: LabAction) => void; onPick: (pick: ScenePick) => void;
  /** A14: the control part whose confirm preview is pending (drawn highlighted). */
  pendingControlId?: string | null;
  /** A14: a drag on a drag-variable control part, as the pointer's parameter along the part's axis. */
  onDragControl?: (componentId: string, t: number) => void };

/**
 * FALLBACK_2D draws the same render list as WebGL with a front orthographic projection, so every part,
 * flow, cutaway reveal and marker a check depends on is present. Every shape is a keyboard-focusable button.
 */
/** True when the 2D stage is phone-width: frame tighter and keep text legible instead of letterboxing the valley. */
function useNarrowContainer(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function Fallback2D({ definition, state, reducedMotion, traceFlowId, dispatch, onPick, pendingControlId = null, onDragControl }: Props) {
  const hasFlows = !!definition.fidelity?.flows.length;
  const { display, time } = useDisplayFidelity(definition, state, reducedMotion, hasFlows);
  const list = useMemo(() => buildRenderList({ definition, state, profile: "FALLBACK_2D", displayFidelity: display, pendingControlId }), [definition, state, display, pendingControlId]);
  // A14 drag-variable on 2D: the front projection maps world (x, y) to SVG (x, -y), so the drag runs in SVG units.
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ id: string; axis: [[number, number, number], [number, number, number]] } | null>(null);
  const dragTo = (event: ReactPointerEvent) => {
    const active = dragging.current, matrix = svgRef.current?.getScreenCTM();
    if (!active || !matrix) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const [a, b] = active.axis;
    onDragControl?.(active.id, dragParameter({ x: a[0], y: -a[1] }, { x: b[0], y: -b[1] }, { x: local.x, y: local.y }));
  };
  const narrow = useNarrowContainer();
  // The valley's front view is wide and short. On a phone, frame a tighter, near-square window (presets still move
  // it) instead of a tall one that letterboxes the plant into a thin strip (R3 visual P0). A18: a preset with a frame
  // (a rail stop, a check view) is fitted to its parts so it always fits the 2D stage.
  const preset = definition.fidelity && state.fidelity ? findPreset(definition.fidelity, state.fidelity.cameraPresetId) : undefined;
  const frame = fallbackFrame(list.items, preset, narrow);
  // Keep labels and trace markers at a stable screen size as focused presets zoom in (and larger on phones).
  const screenScale = (frame.distance / 15) * (narrow ? 1.1 : 1);
  const viewBox = `${frame.x} ${frame.y} ${frame.width} ${frame.height}`;
  // FALLBACK_2D represents cutaways by hiding the removed solid, matching LOW's
  // cutaway behavior. SVG has no clipping plane, so drawing the faded source
  // mesh would obscure the revealed internals and instructional labels.
  const ordered = fallbackVisibleItems(list.items);
  const drawnBySurface = new Set(list.surfaces.filter((surface) => surface.active).map((surface) => definition.fidelity?.surfaces?.find((declared) => declared.id === surface.id)?.componentId).filter(Boolean) as string[]);
  // A11 label budget on 2D as on 3D: highlighted parts first, at most 8 scene labels.
  const labelAllowed = new Set([...ordered.filter((item) => item.showLabel && item.inFocus && item.highlighted), ...ordered.filter((item) => item.showLabel && item.inFocus && !item.highlighted)].slice(0, 8).map((item) => item.id));
  // Labels are placed in one pass and drawn last, on plates, so no part, flow or trace node covers them.
  const placedLabels: { x:number; y:number; halfWidth:number }[] = [];
  const labels: { id: string; text: string; x: number; y: number; halfWidth: number; mobileHidden: boolean }[] = [];
  for (const item of ordered) {
    const labelX=item.center[0]+(item.labelOffset?.[0]??0)*screenScale,labelY=-(item.center[1]+(item.labelOffset?.[1]??0)*screenScale)-.15*screenScale,labelHalfWidth=item.label.length*.09*screenScale;
    const labelCrowded=placedLabels.some(previous=>Math.abs(previous.y-labelY)<.34*screenScale&&Math.abs(previous.x-labelX)<previous.halfWidth+labelHalfWidth+.16*screenScale);
    if(!(item.showLabel&&item.inFocus&&labelAllowed.has(item.id)&&!labelCrowded))continue;
    placedLabels.push({x:labelX,y:labelY,halfWidth:labelHalfWidth});
    labels.push({ id: item.id, text: item.label, x: labelX, y: labelY, halfWidth: labelHalfWidth, mobileHidden: item.mobileLabel === false });
  }
  const activate = (pick: ScenePick) => (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(pick); } };
  const selected = state.selectedObjectId && definition.scene.objects.some((object) => object.id === state.selectedObjectId) ? state.selectedObjectId : null;

  return (
    <div className="relative" aria-label="2D lab scene" data-lab-renderer="svg" data-lab-frames-rendered="1">
      <svg ref={svgRef} viewBox={viewBox} className={narrow ? "aspect-[100/95] h-auto w-full" : `${SCENE_HEIGHT} w-full`} role="group" aria-label={`${definition.title ?? "Lab"} scene (2D view)`}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0f172a" /></marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.07" /></filter>
        </defs>
        <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill={ENVIRONMENT_BACKDROP[list.environment]} />
        {/* RX-005b on FALLBACK_2D: each active water surface as a band whose thickness follows the model's width
            factor (the front projection hides channel depth, so thickness carries the volume cue). */}
        {list.surfaces.filter((surface) => surface.active && surface.width > 0).map((surface) => (
          <polyline key={surface.id} data-lab-surface={surface.id} role="img" aria-label={`${surface.label}: ${surface.kind === "pool" ? "level unchanged" : `width ${Math.round(surface.width * 100) / 100}`}`}
            points={surface.points.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke={SURFACE_SHALLOW} strokeOpacity={0.85}
            strokeWidth={Math.max(0.06, surface.width * 0.32)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        ))}
        {list.flows.filter((flow) => !flow.active).map((flow) => (
          <g key={flow.id} aria-label={`${flow.label}: ${flow.active ? "flowing" : "not flowing"}`}>
            {/* A10: cased line - a dark casing under the light core. */}
            <polyline data-lab-flow-casing={flow.id} points={flow.points.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke={FLOW_CASING_COLOR} strokeWidth={5} strokeDasharray={flow.active ? undefined : "8 6"} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <polyline points={flow.points.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke={flow.active ? flow.color : INACTIVE_FLOW_COLOR} strokeOpacity={1} strokeDasharray={flow.active ? undefined : "8 6"} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" markerMid={flow.active && reducedMotion ? "url(#flow-arrow)" : undefined} />
            {!reducedMotion && flowParticles(flow.points, flow.particleCount, flow.rate, flow.direction, time, false).map((p, index) => <circle key={index} cx={p[0]} cy={-p[1]} r={0.09} fill={flow.color} />)}
          </g>
        ))}
        {ordered.map((item) => {
          const sourcePoints = item.fallbackSilhouette?.points.map(([x, y]) => [x, y, 0] as const) ?? silhouetteSamples(item.geometry);
          const hull = convexHull(sourcePoints.map((sample) => { const p = transformPoint(item.matrix, sample); return [round(p[0]), round(-p[1])] as [number, number]; }));
          const pick: ScenePick = { kind: "item", item };
          return (
            <g key={item.id} opacity={item.alpha < 0.5 && item.inFocus ? 0.45 : item.alpha} {...(item.detail === "decor" ? { pointerEvents: "none" as const } : item.control && item.inFocus ? { "aria-hidden": true, onClick: () => onPick(pick), className: item.control.dragAxis ? "cursor-grab touch-none" : "cursor-pointer",
              ...(item.control.dragAxis ? { onPointerDown: (event: ReactPointerEvent<SVGGElement>) => { dragging.current = { id: item.id, axis: item.control!.dragAxis! }; event.currentTarget.setPointerCapture(event.pointerId); dragTo(event); }, onPointerMove: dragTo, onPointerUp: () => { dragging.current = null; }, onPointerCancel: () => { dragging.current = null; } } : {}) } : item.selectable && item.inFocus ? { role: "button", tabIndex: 0, "aria-label": item.status ? `${item.label}: ${item.status.text}` : item.label, "aria-pressed": item.highlighted, onClick: () => onPick(pick), onKeyDown: activate(pick), className: "cursor-pointer outline-none focus-visible:[&>polygon]:stroke-cyan-200" } : {})}>
              {item.selectable && item.inFocus && item.detail !== "decor" && <polygon data-lab-touch-target points={hull.map((p) => p.join(",")).join(" ")} fill="transparent" stroke="#fff" strokeOpacity={0.001} strokeWidth={48} vectorEffect="non-scaling-stroke" pointerEvents="stroke" aria-hidden="true" />}
              {item.emissive > 0 && <circle cx={item.center[0]} cy={-item.center[1]} r={0.08 * item.emissive + 0.04} fill="#fde68a" opacity={Math.min(0.08, item.emissive * 0.08)} filter="url(#glow)" />}
              {/* A19 / G3: a status lamp's glyph, so its state is never colour alone. */}
              {item.status && item.selectable && item.inFocus && <text data-lab-status={item.id} x={item.center[0]} y={-item.center[1] + 0.42 * screenScale} textAnchor="middle" dominantBaseline="central" fontSize={0.3 * screenScale} fontWeight={800} fill="#0f172a" stroke="#f8fafc" strokeWidth={0.04 * screenScale} paintOrder="stroke" aria-hidden="true">{item.status.glyph}</text>}
              <polygon points={hull.map((p) => p.join(",")).join(" ")} fill={drawnBySurface.has(item.id) && !item.highlighted ? "none" : item.highlighted ? mixHexColor(item.color, HIGHLIGHT_COLOR, 0.2) : item.emissive > 0 ? mixHexColor(item.color, LIT_COLOR, Math.min(0.8, 0.8 * item.emissive)) : item.color} stroke={item.highlighted ? HIGHLIGHT_COLOR : "#0f172a"} strokeWidth={item.highlighted ? 3 : 1} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {/* Active process paths sit above opaque SVG geometry so a real flow
            cannot disappear behind the dam, gate, or housing it passes. */}
        {list.flows.filter((flow) => flow.active).map((flow) => (
          <g key={`${flow.id}-active-overlay`} aria-label={`${flow.label}: flowing`} pointerEvents="none">
            <polyline data-lab-flow-casing={flow.id} points={flow.points.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke={FLOW_CASING_COLOR} strokeWidth={5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <polyline points={flow.points.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke={flow.color} strokeOpacity={1} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" markerMid={reducedMotion ? "url(#flow-arrow)" : undefined} />
            {!reducedMotion && flowParticles(flow.points, flow.particleCount, flow.rate, flow.direction, time, false).map((p, index) => <circle key={index} cx={p[0]} cy={-p[1]} r={0.09} fill={flow.color} />)}
          </g>
        ))}
        {/* RX-005b emitters: the same seeded particles as 3D (frozen under reduced motion), and A15 static cues for
            moving surfaces and emitters under reduced motion (active flows already carry arrowheads). */}
        {list.emitters.filter((emitter) => emitter.active).map((emitter) => (
          <g key={`emitter-${emitter.id}`} aria-label={`${emitter.label}: active`} pointerEvents="none">
            {emitterParticles(emitter, time, reducedMotion).map((p, index) => <circle key={index} cx={p[0]} cy={-p[1]} r={0.08} fill={emitter.color} />)}
          </g>
        ))}
        {reducedMotion && list.cues.filter((cue) => !list.flows.some((flow) => cue.id.startsWith(`${flow.id}:`))).map((cue) => cue.kind === "glyph"
          ? <text key={cue.id} data-lab-cue={cue.id} x={cue.position[0]} y={-cue.position[1]} fontSize={0.4 * screenScale} textAnchor="middle" dominantBaseline="central" fill={cue.color} aria-hidden="true">{cue.glyph}</text>
          : <path key={cue.id} data-lab-cue={cue.id} d="M -0.18 -0.14 L 0.18 0 L -0.18 0.14 Z" fill={cue.color} stroke="#0f172a" strokeWidth={0.03} aria-hidden="true" transform={`translate(${cue.position[0]} ${-cue.position[1]}) rotate(${(Math.atan2(-cue.direction[1], cue.direction[0]) * 180 / Math.PI).toFixed(2)}) scale(${screenScale.toFixed(3)})`} />)}
        {list.markers.map((marker) => <g key={marker.id}><circle cx={marker.position[0]} cy={-marker.position[1]} r={0.16 * screenScale} fill={marker.color} />{marker.label && <text x={marker.position[0]} y={-marker.position[1] + 0.09 * screenScale} textAnchor="middle" fontSize={0.2 * screenScale} fill="#0f172a">{marker.label}</text>}</g>)}
        {list.motions.filter((motion) => motion.active).map((motion) => <g key={motion.id} role="img" aria-label={`${motion.label}: turning`} transform={`translate(${motion.center[0]} ${-motion.center[1]})`}><title>{`${motion.label}: turning`}</title><text textAnchor="middle" dominantBaseline="central" fontSize={0.58} fontWeight={700} fill="#f0abfc">↻</text></g>)}
        {traceFlowId && list.flows.filter((flow) => flow.id === traceFlowId).flatMap((flow) => flow.nodes.filter((node) => node.traceable).map((node) => {
          const order = flow.traced.indexOf(node.id);
          const pick: ScenePick = { kind: "node", flowId: flow.id, nodeId: node.id };
          return (
            <g key={node.id} role="button" tabIndex={0} aria-label={`Trace: ${node.label}`} onClick={() => onPick(pick)} onKeyDown={activate(pick)} className="cursor-pointer">
              <circle data-lab-touch-target cx={node.position[0]} cy={-node.position[1]} r={0.24} fill="transparent" stroke="transparent" strokeWidth={44} vectorEffect="non-scaling-stroke" pointerEvents="stroke" aria-hidden="true" />
              <circle cx={node.position[0]} cy={-node.position[1]} r={0.24 * screenScale} fill={order >= 0 ? MARKER_COLOR : "#e2e8f0"} stroke="#0f172a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {order >= 0 && <text x={node.position[0]} y={-node.position[1] + 0.1 * screenScale} textAnchor="middle" fontSize={0.26 * screenScale} fill="#0f172a">{order + 1}</text>}
            </g>
          );
        }))}
        {labels.map((label) => (
          <g key={`label-${label.id}`} aria-hidden="true" className={`pointer-events-none select-none${label.mobileHidden ? " max-[500px]:hidden" : ""}`}>
            <rect x={label.x - label.halfWidth - 0.08 * screenScale} y={label.y - 0.27 * screenScale} width={2 * label.halfWidth + 0.16 * screenScale} height={0.36 * screenScale} rx={0.08 * screenScale} fill={list.environment === "DAYLIGHT" ? "#f8fafc" : "#020617"} fillOpacity={0.88} />
            <text x={label.x} y={label.y} textAnchor="middle" fontSize={0.3 * screenScale} fill={list.environment === "DAYLIGHT" ? "#111827" : "#f8fafc"}>{label.text}</text>
          </g>
        ))}
      </svg>
      {selected && (
        <div className="absolute bottom-3 left-3 flex gap-2">
          <button type="button" onClick={() => dispatch({ type: "rotate", objectId: selected, delta: [0.3, 0] })} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white">Turn {definition.scene.objects.find((object) => object.id === selected)?.label.toLowerCase()} ({(state.rotations[selected]?.[1] ?? 0).toFixed(1)})</button>
        </div>
      )}
    </div>
  );
}
