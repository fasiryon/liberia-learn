// RX-005a scene graph for the three.js renderer (HIGH/STANDARD). Private to ThreeScene: it imports `three`, so LOW and
// FALLBACK_2D never load it. It turns the shared render list into meshes without a WebGL context, which lets tests
// build the exact scene a frame draws and hold it to the shared frame planner (RX-005 A8).
import * as THREE from "three";
import type { RenderItem, RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { buildParametricGeometry } from "@/lib/interactive-labs/v2/fidelity/geometry/builders";
import { flowParticles, spinMatrix } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { planLowBatches, type LowBatchPlan } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
import { castsShadow, runningEmitters, threeTransparent } from "@/lib/interactive-labs/v2/fidelity/framePlan";
import { emitterParticles } from "@/lib/interactive-labs/v2/fidelity/emitters";
import { HIGHLIGHT_COLOR, MARKER_COLOR, SECTION_CREAM } from "@/lib/interactive-labs/v2/fidelity/palette";
import { disposeSurfaces, syncSurfaces, type SurfaceStore } from "./threeSurfaces";

export type ThreeSceneStores = {
  scene: THREE.Scene;
  objects: Map<string, THREE.Mesh>;
  geometries: Map<string, THREE.BufferGeometry>;
  materials: Map<string, THREE.MeshStandardMaterial>;
  flowLines: Map<string, THREE.Line>;
  flowParticles: Map<string, THREE.Points>;
  markers: THREE.Points | null;
  surfaces: SurfaceStore;
  instanced: Map<string, THREE.InstancedMesh>;
  /** A15 section caps: one back-face cream mesh per clipped part, and their materials by clip plane. */
  caps: Map<string, THREE.Mesh>;
  capMaterials: Map<string, THREE.MeshBasicMaterial>;
  emitters: Map<string, THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>;
  shadows: boolean;
  shadowHash: string;
};

export function createThreeSceneStores(scene: THREE.Scene, shadows: boolean): ThreeSceneStores {
  return { scene, objects: new Map(), geometries: new Map(), materials: new Map(), flowLines: new Map(), flowParticles: new Map(), markers: null, surfaces: new Map(), instanced: new Map(), caps: new Map(), capMaterials: new Map(), emitters: new Map(), shadows, shadowHash: "" };
}

/** The primitive meshes ThreeScene builds; their triangle counts are THREE_PRIMITIVE_TRIANGLES in framePlan.ts. */
export function primitiveGeometry(kind: RenderItem["geometry"]): THREE.BufferGeometry {
  switch (kind) {
    case "sphere": return new THREE.SphereGeometry(1, 32, 20);
    case "cylinder": return new THREE.CylinderGeometry(1, 1, 2, 32);
    case "cone": return new THREE.ConeGeometry(1, 2, 32);
    case "rectangular-prism": return new THREE.BoxGeometry(2.5, 1.64, 1.44);
    case "panel": return new THREE.BoxGeometry(1, 1, 0.04);
    default: return new THREE.BoxGeometry(2, 2, 2);
  }
}

function geometryFor(item: RenderItem, profile: "HIGH" | "STANDARD"): THREE.BufferGeometry {
  if (!item.parametricGeometry) return primitiveGeometry(item.geometry);
  const data = buildParametricGeometry(item.parametricGeometry, profile);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Material cache key. Emissive is quantised to 1/100 so continuous model values reuse materials. */
export const materialKey = (item: RenderItem) => JSON.stringify([item.color, item.alpha, item.highlighted, Math.round(item.emissive * 100) / 100, item.clip, !!item.revealed]);
/** A15: a part revealed by a cutaway sits inside a shell that shades it, so it gets a fill-light floor of its own colour. */
export const REVEALED_FILL = 0.22;

export type ThreeSyncOptions = { profile: "HIGH" | "STANDARD"; time: number; reducedMotion: boolean; traceFlowId: string | null };

/**
 * Bring the scene graph in line with one render list. Identical static parts draw as one InstancedMesh, planned by
 * the same planner LOW and the budget use. Materials no longer referenced after the sync are disposed, so the cache
 * cannot grow with continuous emissive values (R3P-007). Returns the batch plan the frame was built from.
 */
export function syncThreeScene(stores: ThreeSceneStores, list: RenderList, options: ThreeSyncOptions): LowBatchPlan {
  const { scene } = stores;
  const usedMaterials = new Set<string>();
  const geometryOf = (item: RenderItem) => {
    const key = item.parametricGeometry ? JSON.stringify(item.parametricGeometry) : item.geometry;
    let geometry = stores.geometries.get(key);
    if (!geometry) { geometry = geometryFor(item, options.profile); stores.geometries.set(key, geometry); }
    return geometry;
  };
  const materialOf = (item: RenderItem) => {
    const key = materialKey(item);
    usedMaterials.add(key);
    let material = stores.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: item.highlighted ? HIGHLIGHT_COLOR : item.color, roughness: 0.64, metalness: 0.18, transparent: threeTransparent(item), depthWrite: !threeTransparent(item), opacity: threeTransparent(item) ? item.alpha : 1, emissive: item.emissive > 0 || item.revealed ? item.color : "#000000", emissiveIntensity: Math.max(Math.round(item.emissive * 100) / 100, item.revealed ? REVEALED_FILL : 0), side: THREE.DoubleSide, clippingPlanes: item.clip ? [new THREE.Plane(new THREE.Vector3(...item.clip.normal), -item.clip.offset)] : [] });
      stores.materials.set(key, material);
    }
    return material;
  };

  const plan = planLowBatches(list);
  const singleIds = new Set(plan.singles.map((item) => item.id));
  const seen = new Set<string>();
  for (const item of list.items) {
    if (!singleIds.has(item.id)) continue;
    seen.add(item.id);
    const geometry = geometryOf(item), material = materialOf(item);
    let object = stores.objects.get(item.id);
    if (!object) { object = new THREE.Mesh(geometry, material); object.matrixAutoUpdate = false; object.userData.componentId = item.id; scene.add(object); stores.objects.set(item.id, object); }
    else { object.geometry = geometry; object.material = material; }
    object.matrix.fromArray(item.spin ? spinMatrix(item.spin, options.time, options.reducedMotion) : item.matrix);
    object.visible = true;
    object.castShadow = stores.shadows && castsShadow(item);
    object.receiveShadow = stores.shadows && !item.clip && !item.revealed;
  }
  for (const [id, object] of stores.objects) if (!seen.has(id)) { object.removeFromParent(); stores.objects.delete(id); }

  // A15 section caps: a clipped solid shows its cut face in section cream. The cap is the part's own geometry drawn
  // back-face only and clipped by the same plane, so through the cut the learner sees a solid cream section rather
  // than the hollow inside of the shell. One opaque draw per clipped part (planned in framePlan.ts); it never casts.
  const usedCaps = new Set<string>();
  for (const item of plan.singles) {
    if (!item.clip) continue;
    const planeKey = JSON.stringify(item.clip);
    usedCaps.add(planeKey);
    let capMaterial = stores.capMaterials.get(planeKey);
    if (!capMaterial) {
      capMaterial = new THREE.MeshBasicMaterial({ color: SECTION_CREAM, side: THREE.BackSide, toneMapped: false, clippingPlanes: [new THREE.Plane(new THREE.Vector3(...item.clip.normal), -item.clip.offset)] });
      stores.capMaterials.set(planeKey, capMaterial);
    }
    let cap = stores.caps.get(item.id);
    if (!cap) { cap = new THREE.Mesh(geometryOf(item), capMaterial); cap.matrixAutoUpdate = false; cap.userData.sectionCapOf = item.id; scene.add(cap); stores.caps.set(item.id, cap); }
    else { cap.geometry = geometryOf(item); cap.material = capMaterial; }
    cap.matrix.fromArray(item.spin ? spinMatrix(item.spin, options.time, options.reducedMotion) : item.matrix);
    cap.castShadow = false; cap.receiveShadow = false;
  }
  for (const [id, cap] of stores.caps) if (!seen.has(id) || !plan.singles.some((item) => item.id === id && item.clip)) { cap.removeFromParent(); stores.caps.delete(id); }
  for (const [key, material] of stores.capMaterials) if (!usedCaps.has(key)) { material.dispose(); stores.capMaterials.delete(key); }

  const liveBatches = new Set<string>();
  const instanceMatrix = new THREE.Matrix4();
  for (const batch of plan.batches) {
    liveBatches.add(batch.key);
    const first = batch.items[0];
    const geometry = geometryOf(first), material = materialOf(first);
    let instanced = stores.instanced.get(batch.key);
    if (!instanced || instanced.instanceMatrix.count < batch.items.length || instanced.geometry !== geometry || instanced.material !== material) {
      instanced?.removeFromParent(); instanced?.dispose();
      instanced = new THREE.InstancedMesh(geometry, material, batch.items.length);
      instanced.matrixAutoUpdate = false; instanced.userData.batchKey = batch.key;
      scene.add(instanced); stores.instanced.set(batch.key, instanced);
    }
    instanced.count = batch.items.length;
    instanced.castShadow = stores.shadows; instanced.receiveShadow = stores.shadows;
    batch.items.forEach((item, index) => { instanceMatrix.fromArray(item.matrix); instanced!.setMatrixAt(index, instanceMatrix); });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }
  for (const [key, instanced] of stores.instanced) if (!liveBatches.has(key)) { instanced.removeFromParent(); instanced.dispose(); stores.instanced.delete(key); }

  for (const [key, material] of stores.materials) if (!usedMaterials.has(key)) { material.dispose(); stores.materials.delete(key); }

  syncSurfaces(scene, stores.surfaces, list.surfaces, options.time, options.reducedMotion, options.profile);
  syncEmitters(stores, list, options);

  const activeFlowIds = new Set(list.flows.map((flow) => flow.id));
  for (const [id, line] of stores.flowLines) if (!activeFlowIds.has(id)) line.removeFromParent();
  for (const flow of list.flows) {
    let line = stores.flowLines.get(flow.id);
    if (!line) {
      line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(flow.points.map((point) => new THREE.Vector3(...point))), new THREE.LineBasicMaterial());
      line.renderOrder = 5; line.userData.flowLine = true; stores.flowLines.set(flow.id, line);
    }
    const lineMaterial = line.material as THREE.LineBasicMaterial;
    lineMaterial.color.set(flow.active ? flow.color : "#64748b");
    lineMaterial.transparent = !flow.active; lineMaterial.opacity = flow.active ? 0.92 : 0.55;
    if (!line.parent) scene.add(line);
  }
  for (const [id, particles] of stores.flowParticles) if (!activeFlowIds.has(id)) particles.removeFromParent();
  for (const flow of list.flows) {
    const positionsNow = flowParticles(flow.points, flow.particleCount, flow.rate, flow.direction, options.time, options.reducedMotion);
    let particles = stores.flowParticles.get(flow.id);
    if (!positionsNow.length) { particles?.removeFromParent(); continue; }
    if (!particles) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positionsNow.length * 3), 3));
      particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: flow.color, size: 7, sizeAttenuation: false, depthTest: false }));
      particles.userData.labMarker = true; particles.renderOrder = 7; stores.flowParticles.set(flow.id, particles);
    }
    const attribute = particles.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (attribute.count !== positionsNow.length) particles.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positionsNow.length * 3), 3));
    const positions = particles.geometry.getAttribute("position") as THREE.BufferAttribute;
    positionsNow.forEach((point, index) => positions.array.set(point, index * 3));
    positions.needsUpdate = true;
    (particles.material as THREE.PointsMaterial).color.set(flow.color);
    if (!particles.parent) scene.add(particles);
  }

  const markerPoints = [...list.markers.map((marker) => marker.position), ...(options.traceFlowId ? list.flows.filter((flow) => flow.id === options.traceFlowId).flatMap((flow) => flow.nodes.filter((node) => node.traceable).map((node) => node.position)) : [])];
  if (markerPoints.length) {
    if (!stores.markers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(markerPoints.length * 3), 3));
      stores.markers = new THREE.Points(geometry, new THREE.PointsMaterial({ color: MARKER_COLOR, size: 12, sizeAttenuation: false, depthTest: false }));
      stores.markers.userData.labMarker = true; stores.markers.renderOrder = 6;
    }
    const attribute = stores.markers.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (attribute.count !== markerPoints.length) stores.markers.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(markerPoints.length * 3), 3));
    const positions = stores.markers.geometry.getAttribute("position") as THREE.BufferAttribute;
    markerPoints.forEach((point, index) => positions.array.set(point, index * 3));
    positions.needsUpdate = true;
    if (!stores.markers.parent) scene.add(stores.markers);
  } else stores.markers?.removeFromParent();

  return plan;
}

// A18 round sprites for emitter particles: a disc cut in the fragment shader, no texture.
const spriteVertex = `uniform float uSize; void main() { gl_PointSize = uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const spriteFragment = `uniform vec3 uColor; void main() { vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard; gl_FragColor = vec4(uColor, 1.0); #include <colorspace_fragment> }`;

function syncEmitters(stores: ThreeSceneStores, list: RenderList, options: ThreeSyncOptions) {
  const running = runningEmitters(list), live = new Set(running.map((emitter) => emitter.id));
  for (const [id, points] of stores.emitters) if (!live.has(id)) points.removeFromParent();
  for (const emitter of running) {
    const positionsNow = emitterParticles(emitter, options.time, options.reducedMotion);
    let points = stores.emitters.get(emitter.id);
    if (!points) {
      const material = new THREE.ShaderMaterial({ vertexShader: spriteVertex, fragmentShader: spriteFragment, depthTest: false, toneMapped: false, uniforms: { uColor: { value: new THREE.Color(emitter.color) }, uSize: { value: options.profile === "HIGH" ? 7 : 6 } } });
      points = new THREE.Points(new THREE.BufferGeometry(), material);
      points.renderOrder = 7; points.userData.labEmitter = emitter.id; points.frustumCulled = false;
      stores.emitters.set(emitter.id, points);
    }
    let attribute = points.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!attribute || attribute.count !== positionsNow.length) { attribute = new THREE.BufferAttribute(new Float32Array(positionsNow.length * 3), 3); points.geometry.setAttribute("position", attribute); }
    positionsNow.forEach((point, index) => attribute!.array.set(point, index * 3));
    attribute.needsUpdate = true;
    points.material.uniforms.uColor.value.set(emitter.color);
    if (!points.parent) stores.scene.add(points);
  }
}

/** A7: a pure hash of the shadow casters' matrices; the shadow map redraws only when it changes. */
export function shadowCasterHash(list: RenderList): string {
  return list.items.filter(castsShadow).map((item) => item.id + ":" + item.matrix.map((value) => value.toFixed(3)).join(",")).join("|");
}

export function disposeThreeSceneStores(stores: ThreeSceneStores): void {
  for (const mesh of stores.objects.values()) mesh.removeFromParent();
  for (const geometry of stores.geometries.values()) geometry.dispose();
  for (const material of stores.materials.values()) material.dispose();
  for (const line of stores.flowLines.values()) { line.removeFromParent(); line.geometry.dispose(); (line.material as THREE.Material).dispose(); }
  for (const points of stores.flowParticles.values()) { points.removeFromParent(); points.geometry.dispose(); (points.material as THREE.Material).dispose(); }
  if (stores.markers) { stores.markers.removeFromParent(); stores.markers.geometry.dispose(); (stores.markers.material as THREE.Material).dispose(); stores.markers = null; }
  disposeSurfaces(stores.surfaces);
  for (const instanced of stores.instanced.values()) { instanced.removeFromParent(); instanced.dispose(); }
  for (const cap of stores.caps.values()) cap.removeFromParent();
  for (const material of stores.capMaterials.values()) material.dispose();
  for (const points of stores.emitters.values()) { points.removeFromParent(); points.geometry.dispose(); points.material.dispose(); }
  stores.emitters.clear();
  stores.objects.clear(); stores.geometries.clear(); stores.materials.clear(); stores.flowLines.clear(); stores.flowParticles.clear(); stores.instanced.clear();
}

