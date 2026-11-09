/**
 * Delivery binding for the geographic county map in exactly one sealed package: draft.6 civics
 * (`factory@4.0.0-draft.6@g7-civics-counties-capitals`). The sealed candidate and projection are never changed; the
 * player attaches the map beside the named scenes only when the loaded identity matches every hash below.
 * Codex handoff (DRAFT6_T1_HANDOFF.md): keyed map for explore/investigate, key-free outline for the comparison,
 * recognition kept separate from capital recall, no route claims, formative feedback only, no record writes.
 */
import { LIBERIA_GEOGRAPHIC_MAP_CONTRACT } from "./liberiaCountyMap";

export type GeoTask =
  | Readonly<{ kind: "LOCATE"; id: string; countyId: string }>
  | Readonly<{ kind: "FARTHEST"; id: string; direction: "north" | "south"; options: readonly string[] }>
  | Readonly<{ kind: "COAST"; id: string; countyId: string }>
  | Readonly<{ kind: "NEIGHBOUR"; id: string; countyId: string }>;

export type GeoSceneAttachment = Readonly<{
  kind: "LIBERIA_GEOGRAPHIC_MAP";
  contract: typeof LIBERIA_GEOGRAPHIC_MAP_CONTRACT;
  /** KEYED_MAP shows names and the capital key; OUTLINE_TASK shows numbers only, for independent identification. */
  variant: "KEYED_MAP" | "OUTLINE_TASK";
  asset: string;
  sha256: string;
  tasks: readonly GeoTask[];
}>;

export const DRAFT6_CIVICS_GEOGRAPHY = {
  selection: "factory@4.0.0-draft.6@g7-civics-counties-capitals",
  packageHash: "2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb",
  candidateSha256: "ea3ff95feafe3aee979e0a906581dbfdbab5044abf5c2bb742fd97fccda9215b",
  map: { asset: "liberia-county-map.svg", sha256: "1ec51bf4b7137feccc80756752cc9d5ff05c9edeccaf631ca14e1ce8323a20fc" },
  outline: { asset: "liberia-county-outline-task.svg", sha256: "8f5437fbbcec60aa1aaba4f300cd184c734a48537488cfc3aa728fae25eebf8f" },
} as const;

const keyed = (tasks: readonly GeoTask[] = []): GeoSceneAttachment => ({ kind: "LIBERIA_GEOGRAPHIC_MAP", contract: LIBERIA_GEOGRAPHIC_MAP_CONTRACT, variant: "KEYED_MAP", ...DRAFT6_CIVICS_GEOGRAPHY.map, tasks });
const outline = (tasks: readonly GeoTask[]): GeoSceneAttachment => ({ kind: "LIBERIA_GEOGRAPHIC_MAP", contract: LIBERIA_GEOGRAPHIC_MAP_CONTRACT, variant: "OUTLINE_TASK", ...DRAFT6_CIVICS_GEOGRAPHY.outline, tasks });

const SCENES: Readonly<Record<string, readonly GeoSceneAttachment[]>> = {
  // Read a geographic county map: free exploration of every area, its position, coast and neighbours.
  "generated-1": [keyed()],
  // Find 8, 10 and 12 and say which lies farthest north.
  "generated-2": [keyed([{ kind: "LOCATE", id: "find-lofa", countyId: "lofa" }, { kind: "LOCATE", id: "find-maryland", countyId: "maryland" }, { kind: "LOCATE", id: "find-nimba", countyId: "nimba" },
    { kind: "FARTHEST", id: "farthest-north-three", direction: "north", options: ["lofa", "maryland", "nimba"] }])],
  // The comparison works from the key-free outline: recognition without names, then north-south and coast evidence.
  "generated-3": [outline([{ kind: "LOCATE", id: "outline-montserrado", countyId: "montserrado" }, { kind: "LOCATE", id: "outline-lofa", countyId: "lofa" },
    { kind: "FARTHEST", id: "lofa-or-maryland", direction: "north", options: ["lofa", "maryland"] }, { kind: "COAST", id: "maryland-coast", countyId: "maryland" }])],
  // Bound a geographic claim: boundaries are evidence the map does show.
  "generated-4": [keyed([{ kind: "NEIGHBOUR", id: "lofa-neighbour", countyId: "lofa" }])],
  // No route: the map stays available for reference only; it shows no roads.
  "generated-5": [keyed()],
};

/** Attachments for a loaded package, or none. Any identity mismatch yields nothing; the lesson still plays as sealed. */
export function geographicAttachments(identity: Readonly<{ selection?: string; packageHash: string; candidateSha256: string }> | null | undefined, sceneIds: readonly string[]) {
  if (!identity || identity.packageHash !== DRAFT6_CIVICS_GEOGRAPHY.packageHash || identity.candidateSha256 !== DRAFT6_CIVICS_GEOGRAPHY.candidateSha256) return {};
  if (identity.selection !== undefined && identity.selection !== DRAFT6_CIVICS_GEOGRAPHY.selection) return {};
  return Object.fromEntries(Object.entries(SCENES).filter(([sceneId]) => sceneIds.includes(sceneId)));
}
