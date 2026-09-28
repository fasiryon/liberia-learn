// Procedural meshes with flat normals. No asset downloads: everything is generated on the device.
import type { GeometryKind } from "@/lib/interactive-labs/v2/types";
import type { Vec3 } from "@/lib/interactive-labs/v2/fidelity/math";

export type MeshData = { positions: Float32Array; normals: Float32Array; count: number };

function builder() {
  const p: number[] = [], n: number[] = [];
  const tri = (a: Vec3, b: Vec3, c: Vec3) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    p.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) n.push(nx / len, ny / len, nz / len);
  };
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) => { tri(a, b, c); tri(a, c, d); };
  return { tri, quad, done: (): MeshData => ({ positions: new Float32Array(p), normals: new Float32Array(n), count: p.length / 3 }) };
}

function box(hx: number, hy: number, hz: number): MeshData {
  const m = builder();
  const v: Vec3[] = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
  [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3]].forEach(([a, b, c, d]) => m.quad(v[a], v[b], v[c], v[d]));
  return m.done();
}

function sphere(low: boolean): MeshData {
  const m = builder(), n = low ? 12 : 24, rings = low ? 8 : 16;
  const at = (t: number, u: number): Vec3 => [Math.sin(t) * Math.cos(u), Math.cos(t), Math.sin(t) * Math.sin(u)];
  for (let j = 0; j < rings; j++) for (let i = 0; i < n; i++) {
    const a = Math.PI * j / rings, b = Math.PI * (j + 1) / rings, c1 = 2 * Math.PI * i / n, c2 = 2 * Math.PI * (i + 1) / n;
    m.quad(at(a, c1), at(a, c2), at(b, c2), at(b, c1));
  }
  return m.done();
}

function cylinder(low: boolean, cone: boolean): MeshData {
  const m = builder(), n = low ? 14 : 32;
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n, b = 2 * Math.PI * (i + 1) / n;
    const a0: Vec3 = [Math.cos(a), -1, Math.sin(a)], b0: Vec3 = [Math.cos(b), -1, Math.sin(b)];
    const a1: Vec3 = cone ? [0, 1, 0] : [Math.cos(a), 1, Math.sin(a)], b1: Vec3 = cone ? [0, 1, 0] : [Math.cos(b), 1, Math.sin(b)];
    if (cone) m.tri(a0, a1, b0); else m.quad(a0, a1, b1, b0);
    m.tri([0, -1, 0], a0, b0);
    if (!cone) m.tri([0, 1, 0], b1, a1);
  }
  return m.done();
}

export function buildMesh(kind: GeometryKind, low: boolean): MeshData {
  switch (kind) {
    case "sphere": return sphere(low);
    case "cylinder": return cylinder(low, false);
    case "cone": return cylinder(low, true);
    case "rectangular-prism": return box(1.25, 0.82, 0.72);
    case "panel": return box(0.5, 0.5, 0.02);
    case "cube": case "box": case "lever": return box(1, 1, 1);
  }
}

/** Points whose 2D projection outlines the shape; used by the SVG fallback. */
export function silhouetteSamples(kind: GeometryKind): Vec3[] {
  const ring = (y: number, count = 16): Vec3[] => Array.from({ length: count }, (_, i) => [Math.cos(2 * Math.PI * i / count), y, Math.sin(2 * Math.PI * i / count)]);
  const corners = (hx: number, hy: number, hz: number): Vec3[] => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x * hx, y * hy, z * hz] as Vec3)));
  switch (kind) {
    case "sphere": return [...ring(0, 24), ...Array.from({ length: 24 }, (_, i) => [Math.cos(2 * Math.PI * i / 24), Math.sin(2 * Math.PI * i / 24), 0] as Vec3)];
    case "cylinder": return [...ring(-1), ...ring(1)];
    case "cone": return [...ring(-1), [0, 1, 0]];
    case "rectangular-prism": return corners(1.25, 0.82, 0.72);
    case "panel": return corners(0.5, 0.5, 0.02);
    case "cube": case "box": case "lever": return corners(1, 1, 1);
  }
}

export function convexHull(points: [number, number][]): [number, number][] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
