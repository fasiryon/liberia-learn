"use client";
import { useMemo } from "react";
import type { InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { buildRenderList, orderFallbackItems } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { flowParticles } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR, mixHexColor } from "@/lib/interactive-labs/v2/fidelity/palette";
import { transformPoint } from "@/lib/interactive-labs/v2/fidelity/math";
import { convexHull, silhouetteSamples } from "./meshes";
import type { ScenePick } from "./picking";
import { useDisplayFidelity } from "./useDisplayFidelity";

// Fixed precision keeps server and client SVG output identical (no hydration mismatch from float noise).
const round = (value: number) => Math.round(value * 1000) / 1000;

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; reducedMotion: boolean; traceFlowId: string | null; dispatch: (action: LabAction) => void; onPick: (pick: ScenePick) => void };

/**
 * FALLBACK_2D draws the same render list as WebGL with a front orthographic projection, so every part,
 * flow, cutaway reveal and marker a check depends on is present. Every shape is a keyboard-focusable button.
 */
export function Fallback2D({ definition, state, reducedMotion, traceFlowId, dispatch, onPick }: Props) {
  const hasFlows = !!definition.fidelity?.flows.length;
  const { display, time } = useDisplayFidelity(definition, state, reducedMotion, hasFlows);
  const list = useMemo(() => buildRenderList({ definition, state, profile: "FALLBACK_2D", displayFidelity: display }), [definition, state, display]);
  const camera = list.camera ?? { target: [0.25, 0, 0] as [number, number, number], distance: 11 };
  const width = camera.distance * 1.25, height = width * 0.62;
  const viewBox = `${camera.target[0] - width / 2} ${-camera.target[1] - height / 2} ${width} ${height}`;
  const ordered = orderFallbackItems(list.items);
  const activate = (pick: ScenePick) => (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(pick); } };
  const selected = state.selectedObjectId && definition.scene.objects.some((object) => object.id === state.selectedObjectId) ? state.selectedObjectId : null;

  return (
    <div className="relative" aria-label="2D lab scene">
      <svg viewBox={viewBox} className="h-[clamp(420px,62vh,640px)] w-full" role="group" aria-label={`${definition.title ?? "Lab"} scene (2D view)`}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#facc15" /></marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.07" /></filter>
        </defs>
        {list.flows.map((flow) => (
          <g key={flow.id} aria-label={`${flow.label}: ${flow.active ? "flowing" : "not flowing"}`}>
            <polyline points={flow.points.map((p) => `${p[0]},${-p[1]}`).join(" ")} fill="none" stroke={flow.active ? flow.color : INACTIVE_FLOW_COLOR} strokeOpacity={1} strokeDasharray={flow.active ? undefined : "8 6"} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" markerMid={flow.active && reducedMotion ? "url(#flow-arrow)" : undefined} />
            {!reducedMotion && flowParticles(flow.points, flow.particleCount, flow.rate, flow.direction, time, false).map((p, index) => <circle key={index} cx={p[0]} cy={-p[1]} r={0.09} fill={flow.color} />)}
          </g>
        ))}
        {ordered.map((item) => {
          const hull = convexHull(silhouetteSamples(item.geometry).map((sample) => { const p = transformPoint(item.matrix, sample); return [round(p[0]), round(-p[1])] as [number, number]; }));
          const pick: ScenePick = { kind: "item", item };
          return (
            <g key={item.id} opacity={item.alpha < 0.5 && item.inFocus ? 0.45 : item.alpha} {...(item.detail === "decor" ? { pointerEvents: "none" as const } : item.selectable && item.inFocus ? { role: "button", tabIndex: 0, "aria-label": item.label, "aria-pressed": item.highlighted, onClick: () => onPick(pick), onKeyDown: activate(pick), className: "cursor-pointer outline-none focus-visible:[&>polygon]:stroke-cyan-200" } : {})}>
              {item.selectable && item.inFocus && item.detail !== "decor" && <polygon data-lab-touch-target points={hull.map((p) => p.join(",")).join(" ")} fill="transparent" stroke="#fff" strokeOpacity={0.001} strokeWidth={48} vectorEffect="non-scaling-stroke" pointerEvents="stroke" aria-hidden="true" />}
              {item.emissive > 0 && <circle cx={item.center[0]} cy={-item.center[1]} r={0.08 * item.emissive + 0.04} fill="#fde68a" opacity={Math.min(0.08, item.emissive * 0.08)} filter="url(#glow)" />}
              <polygon points={hull.map((p) => p.join(",")).join(" ")} fill={item.highlighted ? mixHexColor(item.color, HIGHLIGHT_COLOR, 0.2) : item.color} stroke={item.highlighted ? HIGHLIGHT_COLOR : "#0f172a"} strokeWidth={item.highlighted ? 3 : 1} vectorEffect="non-scaling-stroke" />
              {item.showLabel && item.inFocus && <text x={item.center[0] + (item.labelOffset?.[0] ?? 0)} y={-(item.center[1] + (item.labelOffset?.[1] ?? 0)) - 0.15} textAnchor="middle" fontSize={0.3} fill="#f8fafc" className={`pointer-events-none select-none${item.mobileLabel === false ? " max-[500px]:hidden" : ""}`} style={{ paintOrder: "stroke", stroke: "#020617", strokeWidth: 0.06 }}>{item.label}</text>}
            </g>
          );
        })}
        {list.markers.map((marker) => <g key={marker.id}><circle cx={marker.position[0]} cy={-marker.position[1]} r={0.16} fill={marker.color} />{marker.label && <text x={marker.position[0]} y={-marker.position[1] + 0.09} textAnchor="middle" fontSize={0.2} fill="#0f172a">{marker.label}</text>}</g>)}
        {list.motions.filter((motion) => motion.active).map((motion) => <g key={motion.id} role="img" aria-label={`${motion.label}: turning`} transform={`translate(${motion.center[0]} ${-motion.center[1]})`}><title>{`${motion.label}: turning`}</title><text textAnchor="middle" dominantBaseline="central" fontSize={0.58} fontWeight={700} fill="#f0abfc">↻</text></g>)}
        {traceFlowId && list.flows.filter((flow) => flow.id === traceFlowId).flatMap((flow) => flow.nodes.filter((node) => node.traceable).map((node) => {
          const order = flow.traced.indexOf(node.id);
          const pick: ScenePick = { kind: "node", flowId: flow.id, nodeId: node.id };
          return (
            <g key={node.id} role="button" tabIndex={0} aria-label={`Trace: ${node.label}`} onClick={() => onPick(pick)} onKeyDown={activate(pick)} className="cursor-pointer">
              <circle data-lab-touch-target cx={node.position[0]} cy={-node.position[1]} r={0.24} fill="transparent" stroke="transparent" strokeWidth={44} vectorEffect="non-scaling-stroke" pointerEvents="stroke" aria-hidden="true" />
              <circle cx={node.position[0]} cy={-node.position[1]} r={0.24} fill={order >= 0 ? "#facc15" : "#e2e8f0"} stroke="#0f172a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {order >= 0 && <text x={node.position[0]} y={-node.position[1] + 0.1} textAnchor="middle" fontSize={0.26} fill="#0f172a">{order + 1}</text>}
            </g>
          );
        }))}
      </svg>
      {selected && (
        <div className="absolute bottom-3 left-3 flex gap-2">
          <button type="button" onClick={() => dispatch({ type: "rotate", objectId: selected, delta: [0.3, 0] })} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white">Turn {definition.scene.objects.find((object) => object.id === selected)?.label.toLowerCase()} ({(state.rotations[selected]?.[1] ?? 0).toFixed(1)})</button>
        </div>
      )}
    </div>
  );
}
