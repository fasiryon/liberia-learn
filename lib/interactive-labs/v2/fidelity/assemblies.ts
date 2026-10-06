// Reusable assembly builders. A box of six faces serves solids, packaging, rooms, containers and any
// prism-shaped system; it yields components, an exploded view, an optional net pose and optional slots.
import type { Transform } from "../types";
import type { AssemblySlot, ComponentAssemblyDefinition, ComponentDefinition, ExplodedViewDefinition, PoseTransitionDefinition } from "./types";
import type { Vec3 } from "./math";

type FaceName = "front" | "back" | "right" | "left" | "top" | "bottom";
const FACE_NAMES: readonly FaceName[] = ["front", "back", "right", "left", "top", "bottom"];

function faceGeometry(half: Vec3, face: FaceName): { folded: Transform; normal: Vec3; size: [number, number] } {
  const [hx, hy, hz] = half;
  const q = Math.PI / 2;
  const table: Record<FaceName, { position: Vec3; rotation: Vec3; normal: Vec3; size: [number, number] }> = {
    front: { position: [0, 0, hz], rotation: [0, 0, 0], normal: [0, 0, 1], size: [2 * hx, 2 * hy] },
    back: { position: [0, 0, -hz], rotation: [0, Math.PI, 0], normal: [0, 0, -1], size: [2 * hx, 2 * hy] },
    right: { position: [hx, 0, 0], rotation: [0, q, 0], normal: [1, 0, 0], size: [2 * hz, 2 * hy] },
    left: { position: [-hx, 0, 0], rotation: [0, -q, 0], normal: [-1, 0, 0], size: [2 * hz, 2 * hy] },
    top: { position: [0, hy, 0], rotation: [-q, 0, 0], normal: [0, 1, 0], size: [2 * hx, 2 * hz] },
    bottom: { position: [0, -hy, 0], rotation: [q, 0, 0], normal: [0, -1, 0], size: [2 * hx, 2 * hz] },
  };
  const entry = table[face];
  return { folded: { position: entry.position, rotation: entry.rotation, scale: [entry.size[0], entry.size[1], 1] }, normal: entry.normal, size: entry.size };
}

/** Cross-shaped net laid flat in the root's local XY plane. */
function netTransform(half: Vec3, face: FaceName, size: [number, number]): Transform {
  const [hx, hy, hz] = half;
  const position: Record<FaceName, Vec3> = { front: [0, 0, 0], top: [0, hy + hz, 0], bottom: [0, -(hy + hz), 0], back: [0, -(2 * hy + 2 * hz), 0], right: [hx + hz, 0, 0], left: [-(hx + hz), 0, 0] };
  return { position: position[face], rotation: [0, 0, 0], scale: [size[0], size[1], 1] };
}

function shapeKey(size: [number, number]): string { return [...size].sort((a, b) => a - b).map((value) => value.toFixed(2)).join("x"); }

const LABELS: Record<FaceName, string> = { front: "Front", back: "Back", right: "Right", left: "Left", top: "Top", bottom: "Bottom" };

export function boxFaceAssembly(options: { assemblyId: string; label: string; rootObjectId: string; half: Vec3; color: string; explodeDistance?: number; net?: { poseId: string; variableId: string }; build?: { trayOrigin: Vec3; traySpacing: [number, number]; order: FaceName[] } }) {
  const { assemblyId, half, color } = options;
  const faces = FACE_NAMES.map((name) => ({ name, ...faceGeometry(half, name) }));
  // Buildable assemblies use neutral "Face n" labels in a shuffled tray so the learner matches by shape, not by name.
  const order = options.build?.order ?? FACE_NAMES;
  const componentIdFor = (name: FaceName) => options.build ? `${assemblyId}-face-${order.indexOf(name) + 1}` : `${assemblyId}-${name}`;
  const trayTransform = (name: FaceName, size: [number, number]): Transform => {
    const index = order.indexOf(name), build = options.build!;
    return { position: [build.trayOrigin[0] + (index % 3) * build.traySpacing[0], build.trayOrigin[1] - Math.floor(index / 3) * build.traySpacing[1], build.trayOrigin[2]], rotation: [0, 0, 0], scale: [size[0], size[1], 1] };
  };
  const components: ComponentDefinition[] = faces.map((face) => ({
    id: componentIdFor(face.name),
    label: options.build ? `Face ${order.indexOf(face.name) + 1}` : `${LABELS[face.name]} face`,
    description: `${face.size[0].toFixed(1)} by ${face.size[1].toFixed(1)} units`,
    geometry: "panel",
    transform: options.build ? trayTransform(face.name, face.size) : face.folded,
    material: { color, roughness: 0.35, metalness: 0.05 },
    // A1: a buildable face is matched by its size (shape) and named by its neutral "Face n" label and tray target.
    ...(options.build ? { semanticCues: ["shape", "label", "target"] as const } : {}),
    shapeKey: shapeKey(face.size),
  }));
  const slots: AssemblySlot[] | undefined = options.build ? faces.map((face) => ({ id: `${assemblyId}-slot-${face.name}`, label: LABELS[face.name], accepts: shapeKey(face.size), transform: face.folded, initialComponentId: componentIdFor(face.name) })) : undefined;
  const assembly: ComponentAssemblyDefinition = { id: assemblyId, label: options.label, rootObjectId: options.rootObjectId, componentIds: components.map((component) => component.id), ...(slots ? { slots } : {}) };
  const exploded: ExplodedViewDefinition = { assemblyId, offsets: Object.fromEntries(faces.map((face) => [componentIdFor(face.name), face.normal.map((value) => value * (options.explodeDistance ?? 1.1)) as Vec3])) };
  const pose: PoseTransitionDefinition | undefined = options.net ? { id: options.net.poseId, assemblyId, variableId: options.net.variableId, from: Object.fromEntries(faces.map((face) => [componentIdFor(face.name), face.folded])), to: Object.fromEntries(faces.map((face) => [componentIdFor(face.name), netTransform(half, face.name, face.size)])) } : undefined;
  return { components, assembly, exploded, pose };
}
