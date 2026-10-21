/**
 * Interactive Learning V4 — reference data for the Liberia counties map explorer.
 *
 * The explorer is a SCHEMATIC tile map, stated as such to learners: one square per county, placed near its
 * real position so north/south/east/west and neighbours read correctly. It has no borders, no scale and no
 * distances, so it never claims geographic precision it does not have. County seats are the official
 * capitals. Facts flagged `reviewCheck` must be confirmed by a curriculum reviewer before release.
 */

export type County = Readonly<{
  id: string;
  name: string;
  capital: string;
  /** Schematic tile position (column 0 = west, row 0 = north). */
  tile: Readonly<{ col: number; row: number }>;
  region: "NORTHWEST" | "NORTH_CENTRAL" | "CENTRAL_COAST" | "SOUTHEAST";
  coast: boolean | null;
  borders: readonly ("SIERRA_LEONE" | "GUINEA" | "COTE_DIVOIRE")[];
  note?: string;
}>;

export const LIBERIA_COUNTIES_SCHEMATIC_VERSION = "liberia-counties-schematic/1.0.0" as const;

export const LIBERIA_COUNTIES: readonly County[] = Object.freeze([
  { id: "lofa", name: "Lofa", capital: "Voinjama", tile: { col: 2, row: 0 }, region: "NORTHWEST", coast: false, borders: ["SIERRA_LEONE", "GUINEA"] },
  { id: "gbarpolu", name: "Gbarpolu", capital: "Bopolu", tile: { col: 1, row: 1 }, region: "NORTHWEST", coast: false, borders: ["SIERRA_LEONE"] },
  { id: "grand-cape-mount", name: "Grand Cape Mount", capital: "Robertsport", tile: { col: 0, row: 2 }, region: "NORTHWEST", coast: true, borders: ["SIERRA_LEONE"] },
  { id: "bomi", name: "Bomi", capital: "Tubmanburg", tile: { col: 1, row: 2 }, region: "NORTHWEST", coast: null, borders: [], note: "Coastline not stated in this lesson (reviewCheck)." },
  { id: "montserrado", name: "Montserrado", capital: "Bensonville", tile: { col: 1, row: 3 }, region: "CENTRAL_COAST", coast: true, borders: [], note: "Monrovia, the national capital, is in Montserrado County." },
  { id: "bong", name: "Bong", capital: "Gbarnga", tile: { col: 3, row: 1 }, region: "NORTH_CENTRAL", coast: false, borders: [] },
  { id: "nimba", name: "Nimba", capital: "Sanniquellie", tile: { col: 4, row: 1 }, region: "NORTH_CENTRAL", coast: false, borders: ["GUINEA", "COTE_DIVOIRE"] },
  { id: "margibi", name: "Margibi", capital: "Kakata", tile: { col: 2, row: 3 }, region: "CENTRAL_COAST", coast: true, borders: [] },
  { id: "grand-bassa", name: "Grand Bassa", capital: "Buchanan", tile: { col: 3, row: 3 }, region: "CENTRAL_COAST", coast: true, borders: [] },
  { id: "river-cess", name: "River Cess", capital: "Cestos City", tile: { col: 4, row: 3 }, region: "CENTRAL_COAST", coast: true, borders: [] },
  { id: "grand-gedeh", name: "Grand Gedeh", capital: "Zwedru", tile: { col: 5, row: 2 }, region: "SOUTHEAST", coast: false, borders: ["COTE_DIVOIRE"] },
  { id: "sinoe", name: "Sinoe", capital: "Greenville", tile: { col: 5, row: 4 }, region: "SOUTHEAST", coast: true, borders: [] },
  { id: "river-gee", name: "River Gee", capital: "Fish Town", tile: { col: 6, row: 3 }, region: "SOUTHEAST", coast: false, borders: ["COTE_DIVOIRE"] },
  { id: "grand-kru", name: "Grand Kru", capital: "Barclayville", tile: { col: 6, row: 4 }, region: "SOUTHEAST", coast: true, borders: [] },
  { id: "maryland", name: "Maryland", capital: "Harper", tile: { col: 7, row: 4 }, region: "SOUTHEAST", coast: true, borders: ["COTE_DIVOIRE"] },
]);

export const REGION_LABEL: Record<County["region"], string> = { NORTHWEST: "Northwest", NORTH_CENTRAL: "North and centre", CENTRAL_COAST: "Central coast", SOUTHEAST: "Southeast" };
export const NEIGHBOUR_LABEL: Record<County["borders"][number], string> = { SIERRA_LEONE: "Sierra Leone", GUINEA: "Guinea", COTE_DIVOIRE: "Côte d'Ivoire" };

export function countyById(id: string): County | null {
  return LIBERIA_COUNTIES.find((county) => county.id === id) ?? null;
}

/** Compass direction from one county's tile to another's, as a learner would read it on the schematic. */
export function directionBetween(fromId: string, toId: string): string | null {
  const from = countyById(fromId), to = countyById(toId);
  if (!from || !to || from === to) return null;
  const dy = to.tile.row - from.tile.row, dx = to.tile.col - from.tile.col;
  const ns = dy < 0 ? "north" : dy > 0 ? "south" : "";
  const ew = dx > 0 ? "east" : dx < 0 ? "west" : "";
  return ns && ew ? `${ns}${ew}` : ns || ew;
}
