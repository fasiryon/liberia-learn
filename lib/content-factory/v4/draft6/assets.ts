import { readFileSync } from "fs";
import { z } from "zod";
import counties from "@/curriculum/factory-v4/draft6-sources/county-capitals.json";
import { HEATING_POINTS } from "./subjects";

const coordinate = z.tuple([z.number(), z.number()]).transform(([lon, lat]): [number, number] => [lon, lat]);
const geoSchema = z.object({ type: z.literal("FeatureCollection"), features: z.array(z.object({ properties: z.object({ shapeName: z.string() }), geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(coordinate).min(4)).min(1) }) })).length(15) });
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

export function geographicMap() {
  const geo = geoSchema.parse(JSON.parse(readFileSync("curriculum/factory-v4/draft6-sources/liberia-counties.geojson", "utf8")));
  const normalize = (s: string) => s.toLowerCase().replaceAll(" ", "");
  if (new Set(geo.features.map(f => normalize(f.properties.shapeName))).size !== 15) throw Error("county_names_not_unique");
  const xy = ([lon, lat]: number[]) => [50 + (lon + 11.6) * 140 * Math.cos(6.5 * Math.PI / 180), 70 + (8.6 - lat) * 140];
  const contains = (point: number[], ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const paths = geo.features.map(feature => {
    const county = counties.find(c => normalize(c.name) === normalize(feature.properties.shapeName));
    if (!county) throw Error("county_geometry_name_mismatch");
    const ring = feature.geometry.coordinates[0];
    if (ring.some(([lon, lat]) => lon < -11.7 || lon > -7.3 || lat < 4.1 || lat > 8.7)) throw Error("county_geometry_outside_liberia");
    // Choose an interior point with clearance, never a boundary vertex. Include holes in clearance tests.
    const minLon = Math.min(...ring.map(p => p[0])), maxLon = Math.max(...ring.map(p => p[0]));
    const minLat = Math.min(...ring.map(p => p[1])), maxLat = Math.max(...ring.map(p => p[1]));
    const segments = feature.geometry.coordinates.flatMap(r => r.slice(1).map((end, i) => [r[i], end]));
    let labelPoint: number[] | undefined, clearance = -1;
    for (let gx = 1; gx < 32; gx++) for (let gy = 1; gy < 32; gy++) {
      const point = [minLon + (maxLon - minLon) * gx / 32, minLat + (maxLat - minLat) * gy / 32];
      if (!contains(point, ring) || feature.geometry.coordinates.slice(1).some(hole => contains(point, hole))) continue;
      const distance = Math.min(...segments.map(([a, b]) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
        const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
        return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
      }));
      if (distance > clearance) { clearance = distance; labelPoint = point; }
    }
    if (!labelPoint || clearance < 0.01) throw Error("county_label_interior_clearance_missing");
    const [x, y] = xy(labelPoint);
    const d = feature.geometry.coordinates.map(r => r.map((p, i) => `${i ? "L" : "M"}${xy(p).map(n => n.toFixed(2)).join(",")}`).join(" ") + " Z").join(" ");
    return `<g><title>${escape(county.name)}</title><path d="${d}" fill="#f5f5f5" stroke="#222" stroke-width="1.4" fill-rule="evenodd"/><text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="17" font-weight="bold" fill="#111" paint-order="stroke" stroke="white" stroke-width="4">${county.number}</text></g>`;
  }).join("\n");
  const key = counties.map((c, i) => `<text x="690" y="${120 + i * 28}" font-size="16">${c.number}. ${escape(c.name)}: ${escape(c.capital)}</text>`).join("\n");
  const start = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 900" role="img" aria-labelledby="title desc"><title id="title">Liberia geographic county outline</title><desc id="desc">North is up. Fifteen coordinate-derived county areas are numbered. Numbers identify areas, not capital points. Use the separate key for county-capital recall. No roads are shown.</desc><metadata>Source: https://www.geoboundaries.org/api/current/gbOpen/LBR/ADM1/ ; upstream commit 9469f09; UNMIL / OCHA ROWCA; CC BY 3.0 IGO https://creativecommons.org/licenses/by/3.0/igo/ . Represented year 2021. No endorsement claimed.</metadata><rect width="1100" height="900" fill="white"/><g font-family="Arial,sans-serif" fill="#111"><text x="50" y="35" font-size="24">Liberia: county areas, north up</text><path d="M610 115 L610 65 L600 80 M610 65 L620 80" fill="none" stroke="#111" stroke-width="3"/><text x="604" y="55" font-size="20">N</text>`;
  const end = `<text x="50" y="750" font-size="15">Atlantic Ocean</text><text x="50" y="790" font-size="13">UNMIL / OCHA ROWCA via geoBoundaries gbOpen, LBR ADM1, represented year 2021.</text><text x="50" y="812" font-size="13">CC BY 3.0 IGO: https://creativecommons.org/licenses/by/3.0/igo/</text><text x="50" y="834" font-size="13">Changes: coordinate projection, simplified source outlines, numbered labels and administrative key.</text><text x="50" y="856" font-size="13">Educational outline; no endorsement, survey precision, road routes or capital-point locations implied.</text></g></svg>\n`;
  return { "liberia-county-map.svg": start + paths + key + end, "liberia-county-outline-task.svg": start + paths + end };
}

export function heatingDiagram() {
  const xy = (p: {x: number; y: number}) => [90 + p.x / 3050 * 900, 340 - (p.y + 10) / 120 * 260];
  const line = HEATING_POINTS.map((p, i) => `${i ? "L" : "M"}${xy(p).join(",")}`).join(" ");
  const labels = HEATING_POINTS.map((p, i) => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="4"/><text x="${x + (i === 5 ? -12 : 4)}" y="${y + (i === 3 ? 25 : -10)}">${"ABCDEF"[i]}</text>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 620" role="img" aria-labelledby="title desc"><title id="title">Idealized heating of one kilogram of pure water</title><desc id="desc">Temperature against net heat added, at fixed pressure near one atmosphere. A-B ice warms from minus 10 to zero Celsius. B-C melting at zero, 334 kilojoules. C-D liquid warms to 100 Celsius. D-E boiling at 100, 2256 kilojoules. E-F vapor warms to 110. Horizontal lengths are proportional to heat added. No time axis.</desc><rect width="1100" height="620" fill="white"/><g font-family="Arial,sans-serif" font-size="17" fill="#111"><text x="55" y="35" font-size="23">Pure water, 1 kg, fixed pressure near one atmosphere</text><path d="M90 60 V360 H1030" stroke="#111" fill="none" stroke-width="2"/><text x="380" y="400">Net heat added / kJ</text><text transform="translate(30 285) rotate(-90)">Temperature / degrees C</text><path d="${line}" fill="none" stroke="#125070" stroke-width="3"/>${labels}<text x="55" y="345">-10</text><text x="65" y="320">0</text><text x="45" y="105">100</text><text x="80" y="380">0</text><text x="180" y="380">355</text><text x="300" y="380">773</text><text x="935" y="380">3029</text><text x="60" y="450">A-B ice warms. B-C ice and liquid coexist during melting.</text><text x="60" y="480">C-D liquid warms. D-E liquid and vapor coexist during boiling.</text><text x="60" y="510">E-F vapor warms. Short A-B and E-F segments reflect the energy scale.</text><text x="60" y="550">Calculated illustrative model, not measured data or a heating procedure.</text><text x="60" y="580">Original diagram. Assumptions and full numeric table are in the academic packet.</text></g></svg>\n`;
}
