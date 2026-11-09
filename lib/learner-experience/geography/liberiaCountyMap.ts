/**
 * Liberia geographic county map — `liberia-geographic-map/1.0.0`.
 *
 * Reads the county polygons from a pinned, attributed factory SVG (geoBoundaries gbOpen LBR ADM1, UNMIL/OCHA ROWCA,
 * CC BY 3.0 IGO) and derives only what that geometry supports: shared boundaries (neighbours), relative position
 * (north-up), and Atlantic-facing outline (coast). It never invents roads, capital points or distances. The derived
 * data is generated once (scripts/learning-v4/generate-liberia-geography.ts) and re-checked against the exact bytes by
 * __tests__/learning-v4/liberia-geography.test.ts, so a changed asset fails closed instead of drifting.
 */

export const LIBERIA_GEOGRAPHIC_MAP_CONTRACT = "liberia-geographic-map/1.0.0" as const;

export type Point = readonly [number, number];
export type Compass = "north" | "north-east" | "east" | "south-east" | "south" | "south-west" | "west" | "north-west";

export type GeoCounty = Readonly<{
  id: string;
  name: string;
  /** The number printed in the county area on the factory map; it labels an area, not a capital point. */
  number: number;
  /** Administrative capital from the factory key (a name only; no point is plotted). */
  capital: string;
  path: string;
  label: Point;
  centroid: Point;
  /** Position within Liberia from the centroid, north up (for example "north-west"). "central" when near the middle. */
  region: string;
  coastal: boolean;
  /** County ids that share a boundary of at least MIN_SHARED_BOUNDARY map units, sorted by name. */
  neighbours: readonly string[];
}>;

export type GeoMapData = Readonly<{
  contract: typeof LIBERIA_GEOGRAPHIC_MAP_CONTRACT;
  source: Readonly<{ asset: string; sha256: string; dataset: string; upstreamCommit: string; representedYear: number; producer: string; license: string; licenseUrl: string; changes: string; endorsement: string }>;
  viewBox: readonly [number, number, number, number];
  north: Readonly<{ arrow: string; label: Point }>;
  ocean: Readonly<{ label: string; at: Point }>;
  counties: readonly GeoCounty[];
}>;

/** Contacts shorter than this (a corner or a simplification artefact) are not called neighbours. */
export const MIN_SHARED_BOUNDARY = 10;
const NEAR = 1.5;

const decode = (text: string) => text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
const idOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function rings(d: string): Point[][] {
  return d.split(/(?=M)/).map((part) => [...part.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as Point)).filter((ring) => ring.length > 2);
}

function ringArea(ring: readonly Point[]) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length], cross = x1 * y2 - x2 * y1;
    area += cross; cx += (x1 + x2) * cross; cy += (y1 + y2) * cross;
  }
  area /= 2;
  return { area: Math.abs(area), centroid: [cx / (6 * area), cy / (6 * area)] as Point };
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** A coarse grid of segments per county, so each point tests only nearby edges. */
function segmentIndex(countyRings: readonly Point[][]) {
  const cell = 8, grid = new Map<string, [Point, Point][]>();
  for (const ring of countyRings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    for (let x = Math.floor((Math.min(a[0], b[0]) - NEAR) / cell); x <= Math.floor((Math.max(a[0], b[0]) + NEAR) / cell); x++)
      for (let y = Math.floor((Math.min(a[1], b[1]) - NEAR) / cell); y <= Math.floor((Math.max(a[1], b[1]) + NEAR) / cell); y++) {
        const key = `${x},${y}`;
        (grid.get(key) ?? grid.set(key, []).get(key)!).push([a, b]);
      }
  }
  return (p: Point) => (grid.get(`${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`) ?? []).some(([a, b]) => segmentDistance(p, a, b) < NEAR);
}

const COMPASS: readonly Compass[] = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
/** Direction from a to b with north up (SVG y grows downward). */
export function compassBetween(a: Point, b: Point): Compass {
  const angle = Math.atan2(a[1] - b[1], b[0] - a[0]);
  return COMPASS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}

function regionOf(c: Point, box: readonly [number, number, number, number]) {
  const [minX, minY, maxX, maxY] = box, fx = (c[0] - minX) / (maxX - minX), fy = (c[1] - minY) / (maxY - minY);
  const ns = fy < 0.36 ? "north" : fy > 0.64 ? "south" : "", ew = fx < 0.36 ? "west" : fx > 0.64 ? "east" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew || "central";
}

/** Parse the factory SVG and derive county facts. Throws on anything other than the fifteen expected areas. */
export function deriveLiberiaGeography(svg: string, asset: string, sha256: string): GeoMapData {
  const viewBox = (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? "").split(/\s+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) throw Error("geo_viewbox");
  const metadata = decode(/<metadata>([^<]*)<\/metadata>/.exec(svg)?.[1] ?? "");
  if (!/CC BY 3\.0 IGO/.test(metadata) || !/UNMIL \/ OCHA ROWCA/.test(metadata) || !/9469f09/.test(metadata)) throw Error("geo_attribution_missing");
  const areas = [...svg.matchAll(/<g><title>([^<]+)<\/title><path d="([^"]+)"/g)].map((m) => ({ name: decode(m[1]), d: m[2], rings: rings(m[2]) }));
  const labels = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="middle"[^>]*>(\d+)<\/text>/g)].map((m) => ({ at: [Number(m[1]), Number(m[2])] as Point, number: Number(m[3]) }));
  const key = new Map([...svg.matchAll(/<text[^>]*>(\d+)\. ([^:<]+): ([^<]+)<\/text>/g)].map((m) => [decode(m[2]).trim(), { number: Number(m[1]), capital: decode(m[3]).trim() }]));
  if (areas.length !== 15 || labels.length !== 15 || new Set(areas.map((a) => a.name)).size !== 15) throw Error("geo_county_count");

  const box = areas.flatMap((a) => a.rings.flat()).reduce<[number, number, number, number]>((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const near = areas.map((a) => segmentIndex(a.rings));
  const shared = areas.map(() => new Map<number, number>());
  const open = areas.map(() => [] as { mid: Point; length: number }[]);
  areas.forEach((area, i) => {
    for (const ring of area.rings) for (let k = 0; k < ring.length; k++) {
      const p = ring[k], q = ring[(k + 1) % ring.length], mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const hits = areas.map((_, j) => j).filter((j) => j !== i && near[j](p) && near[j](q) && near[j](mid));
      if (hits.length) for (const j of hits) shared[i].set(j, (shared[i].get(j) ?? 0) + length);
      else open[i].push({ mid, length });
    }
  });
  // Coast: outline not shared with another county, lying on the Atlantic side of the chord joining the country's western
  // and south-eastern extremes. The side is fixed by the map's own "Atlantic Ocean" label, not assumed.
  const all = areas.flatMap((a) => a.rings.flat());
  const west = all.reduce((best, p) => (p[0] < best[0] ? p : best)), southEast = all.reduce((best, p) => (p[0] + p[1] > best[0] + best[1] ? p : best));
  const oceanMatch = /<text x="([\d.]+)" y="([\d.]+)"[^>]*>Atlantic Ocean<\/text>/.exec(svg);
  if (!oceanMatch) throw Error("geo_ocean_label");
  const ocean: Point = [Number(oceanMatch[1]), Number(oceanMatch[2])];
  const ux = southEast[0] - west[0], uy = southEast[1] - west[1], norm = Math.hypot(ux, uy);
  const rawSide = (p: Point) => ((p[0] - west[0]) * uy - (p[1] - west[1]) * ux) / norm, sign = Math.sign(rawSide(ocean));
  const coastLength = open.map((edges) => edges.filter((e) => sign * rawSide(e.mid) > -20).reduce((sum, e) => sum + e.length, 0));

  const counties = areas.map((area, i) => {
    const main = area.rings.map(ringArea).sort((a, b) => b.area - a.area)[0];
    const entry = key.get(area.name);
    const label = labels.find((l) => l.number === entry?.number);
    if (!entry || !label) throw Error(`geo_key_missing:${area.name}`);
    return { id: idOf(area.name), name: area.name, number: entry.number, capital: entry.capital, path: area.d, label: label.at,
      centroid: [Math.round(main.centroid[0] * 10) / 10, Math.round(main.centroid[1] * 10) / 10] as Point,
      region: regionOf(main.centroid, box), coastal: coastLength[i] >= MIN_SHARED_BOUNDARY,
      neighbours: [...shared[i]].filter(([j, length]) => length >= MIN_SHARED_BOUNDARY && (shared[j].get(i) ?? 0) >= MIN_SHARED_BOUNDARY).map(([j]) => areas[j].name).sort().map(idOf) };
  }).sort((a, b) => a.number - b.number);

  const north = /<path d="(M[\d. ]+L[\d. ]+L[\d. ]+M[\d. ]+L[\d. ]+)" fill="none"/.exec(svg)?.[1];
  const northLabel = /<text x="([\d.]+)" y="([\d.]+)"[^>]*>N<\/text>/.exec(svg);
  if (!north || !northLabel) throw Error("geo_north_arrow");
  return {
    contract: LIBERIA_GEOGRAPHIC_MAP_CONTRACT,
    source: { asset, sha256, dataset: "geoBoundaries gbOpen LBR ADM1 (simplified)", upstreamCommit: "9469f09", representedYear: 2021, producer: "UNMIL / OCHA ROWCA via geoBoundaries",
      license: "CC BY 3.0 IGO", licenseUrl: "https://creativecommons.org/licenses/by/3.0/igo/",
      changes: "Coordinate projection, simplified source outlines, numbered labels and administrative key.", endorsement: "No endorsement, survey precision, road routes or capital-point locations implied." },
    viewBox: viewBox as unknown as readonly [number, number, number, number],
    north: { arrow: north, label: [Number(northLabel[1]), Number(northLabel[2])] },
    // Label just offshore of the coast's midpoint (the source label sits far below the map and would waste height).
    ocean: { label: "Atlantic Ocean", at: [Math.round((west[0] + southEast[0]) / 2 + sign * 70 * uy / norm - 180), Math.round((west[1] + southEast[1]) / 2 - sign * 70 * ux / norm)] as Point },
    counties,
  };
}

// ── Learner-facing descriptions (shared by the map, its text alternative and feedback) ──

export const countyIn = (data: GeoMapData, id: string) => data.counties.find((county) => county.id === id);

export function describeCounty(data: GeoMapData, county: GeoCounty, { names = true }: { names?: boolean } = {}) {
  const others = county.neighbours.map((id) => countyIn(data, id)!).map((n) => (names ? n.name : `area ${n.number}`));
  const where = county.region === "central" ? "in central Liberia" : `in ${county.region} Liberia`;
  return `${names ? county.name : `Area ${county.number}`} lies ${where}, ${county.coastal ? "on the Atlantic coast" : "inland, away from the coast"}. It shares a boundary with ${others.length === 1 ? others[0] : `${others.slice(0, -1).join(", ")} and ${others[others.length - 1]}`}.`;
}

/** The whole map as text: every county's position, coast and neighbours. Usable offline and on paper. */
export function geographyTextAlternative(data: GeoMapData, { names = true }: { names?: boolean } = {}) {
  return `Map of Liberia, north up, with the Atlantic Ocean to the south-west. ${data.counties.map((county) => describeCounty(data, county, { names })).join(" ")} The map shows county areas only: no roads, distances or capital points.`;
}

/** The nearest county whose centre lies in the pressed direction (within 67.5° of it), preferring neighbours. */
export function stepToward(data: GeoMapData, from: GeoCounty, direction: "north" | "south" | "east" | "west") {
  const target = { north: Math.PI / 2, south: -Math.PI / 2, east: 0, west: Math.PI }[direction];
  const scored = data.counties.filter((c) => c.id !== from.id).map((c) => {
    const dx = c.centroid[0] - from.centroid[0], dy = from.centroid[1] - c.centroid[1];
    let off = Math.abs(Math.atan2(dy, dx) - target);
    if (off > Math.PI) off = 2 * Math.PI - off;
    return { c, off, cost: Math.hypot(dx, dy) * (1 + off) * (from.neighbours.includes(c.id) ? 0.6 : 1) };
  }).filter((s) => s.off <= (3 * Math.PI) / 8).sort((a, b) => a.cost - b.cost);
  return scored[0]?.c ?? null;
}
