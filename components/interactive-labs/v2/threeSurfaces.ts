// RX-005b for the three.js renderer (HIGH/STANDARD). Private to ThreeScene: it is the only other module that
// imports `three`, so LOW and FALLBACK_2D never load it. Every uniform comes from the render list.
import * as THREE from "three";
import { SURFACE_DEEP, SURFACE_SHALLOW, surfaceRibbon, type RenderSurface } from "@/lib/interactive-labs/v2/fidelity/surfaces";

/** A9: shader time is wrapped on the CPU to a tileable period so precision holds in long sessions. */
export const SURFACE_TIME_PERIOD_SECONDS = 600;

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Procedural, deterministic water: deep centre to shallow edges, streaks that drift downstream at a speed set
// by the model's rate. A pool (rate 0) keeps a still surface; an inactive surface is never drawn.
const fragmentShader = `uniform float uTime; uniform float uRate; uniform float uDetail; uniform vec3 uDeep; uniform vec3 uShallow;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float edge = abs(vUv.y - 0.5) * 2.0;
  vec3 colour = mix(uDeep, uShallow, smoothstep(0.15, 1.0, edge));
  float drift = uTime * (0.25 + 1.6 * uRate);
  float n = noise(vec2(vUv.x * 2.4 - drift, vUv.y * 5.0)) * 0.6 + uDetail * noise(vec2(vUv.x * 6.5 - drift * 1.7, vUv.y * 11.0)) * 0.4;
  float streak = smoothstep(0.58, 0.92, n) * (0.25 + 0.75 * uRate);
  colour = mix(colour, vec3(0.92, 0.97, 1.0), streak * 0.5);
  colour = mix(colour, uShallow * 1.08, smoothstep(0.9, 1.0, edge) * 0.45);
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

type SurfaceEntry = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; key: string };
export type SurfaceStore = Map<string, SurfaceEntry>;

function ribbonGeometry(surface: RenderSurface): THREE.BufferGeometry {
  const ribbon = surfaceRibbon(surface.points, surface.width);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(ribbon.positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(ribbon.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(ribbon.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Create, update or remove one mesh per active surface. Geometry is rebuilt only when its width changes. */
export function syncSurfaces(scene: THREE.Scene, store: SurfaceStore, surfaces: readonly RenderSurface[], timeSeconds: number, reducedMotion: boolean, profile: "HIGH" | "STANDARD"): void {
  const live = new Set<string>();
  const t = reducedMotion ? 0 : ((timeSeconds % SURFACE_TIME_PERIOD_SECONDS) + SURFACE_TIME_PERIOD_SECONDS) % SURFACE_TIME_PERIOD_SECONDS;
  for (const surface of surfaces) {
    if (!surface.active || surface.width <= 0) continue;
    live.add(surface.id);
    const key = JSON.stringify([surface.points, surface.width]);
    let entry = store.get(surface.id);
    if (!entry) {
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide, uniforms: {
        uTime: { value: 0 }, uRate: { value: 0 }, uDetail: { value: profile === "HIGH" ? 1 : 0 },
        uDeep: { value: new THREE.Color(SURFACE_DEEP) }, uShallow: { value: new THREE.Color(SURFACE_SHALLOW) },
      } });
      const mesh = new THREE.Mesh(ribbonGeometry(surface), material);
      mesh.name = `surface:${surface.id}`; mesh.renderOrder = 1; mesh.userData.labSurface = surface.id;
      scene.add(mesh);
      entry = { mesh, key };
      store.set(surface.id, entry);
    } else if (entry.key !== key) {
      entry.mesh.geometry.dispose();
      entry.mesh.geometry = ribbonGeometry(surface);
      entry.key = key;
    }
    entry.mesh.material.uniforms.uTime.value = t;
    entry.mesh.material.uniforms.uRate.value = surface.rate;
  }
  for (const [id, entry] of store) if (!live.has(id)) { entry.mesh.removeFromParent(); entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); store.delete(id); }
}

export function disposeSurfaces(store: SurfaceStore): void {
  for (const entry of store.values()) { entry.mesh.removeFromParent(); entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); }
  store.clear();
}
