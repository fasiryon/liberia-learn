import type { CapabilityProfile } from "../../types";
import type { Vec3 } from "../math";

export type LatheDescriptor = { kind: "lathe"; profile: readonly (readonly [number, number])[]; radialSegments?: number };
export type SweepDescriptor = { kind: "sweep"; points: readonly Vec3[]; radius: number; radialSegments?: number; closed?: boolean };
export type ExtrudeDescriptor = { kind: "extrude"; contour: readonly (readonly [number, number])[]; depth: number };
export type HeightfieldDescriptor = { kind: "heightfield"; rows: number; columns: number; size: readonly [number, number]; heights: readonly number[] };
export type ScatterDescriptor = { kind: "scatter"; seed: number; prototype: Exclude<ParametricDescriptor, { kind: "scatter" | "dimensionLine" }>; transforms: readonly { position: Vec3; rotation: Vec3; scale: Vec3 }[] };
export type DimensionLineDescriptor = { kind: "dimensionLine"; start: Vec3; end: Vec3; ticks?: number; labelKey?: string };
export type ParametricDescriptor = LatheDescriptor | SweepDescriptor | ExtrudeDescriptor | HeightfieldDescriptor | ScatterDescriptor | DimensionLineDescriptor;
export type GeometrySilhouette = { kind: "polygon"; points: readonly (readonly [number, number])[]; semanticLabel?: string };
export type ProfileGeometry = ParametricDescriptor | { kind: "sameAs"; profile: Exclude<CapabilityProfile, "FALLBACK_2D"> };
export type InstructionalGeometryVariants = {
  HIGH: ProfileGeometry;
  STANDARD: ProfileGeometry;
  LOW: ParametricDescriptor;
  FALLBACK_2D: GeometrySilhouette;
};
export type GeometryMesh = { positions: Float32Array; normals: Float32Array; indices: Uint16Array | Uint32Array; triangles: number };
