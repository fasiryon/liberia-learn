import { createHash } from "crypto";
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import generated from "@/lib/learner-experience/geography/liberia-adm1-2021.json";
import { compassBetween, countyIn, deriveLiberiaGeography, geographyTextAlternative, stepToward, type GeoMapData } from "@/lib/learner-experience/geography/liberiaCountyMap";
import { DRAFT6_CIVICS_GEOGRAPHY, geographicAttachments } from "@/lib/learner-experience/geography/draft6Binding";

const dir = "curriculum/factory-v4/drafts/4.0.0-draft.6/g7-civics-counties-capitals";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8")) as { packageHash: string; candidateSha256: string; files: Record<string, string> };
const data = generated as unknown as GeoMapData;
const c = (id: string) => countyIn(data, id)!;

describe("liberia-geographic-map/1.0.0 binding to the sealed draft.6 civics package", () => {
  it("binds the exact package, candidate and asset hashes", () => {
    expect(manifest.packageHash).toBe(DRAFT6_CIVICS_GEOGRAPHY.packageHash);
    expect(manifest.candidateSha256).toBe(DRAFT6_CIVICS_GEOGRAPHY.candidateSha256);
    for (const asset of [DRAFT6_CIVICS_GEOGRAPHY.map, DRAFT6_CIVICS_GEOGRAPHY.outline]) {
      const digest = sha(readFileSync(`${dir}/${asset.asset}`));
      expect(digest).toBe(asset.sha256);
      expect(manifest.files[asset.asset]).toBe(asset.sha256);
    }
  });

  it("the generated data is exactly what the pinned map bytes derive (no drift, no hand edits)", () => {
    const bytes = readFileSync(`${dir}/${DRAFT6_CIVICS_GEOGRAPHY.map.asset}`);
    expect(JSON.parse(JSON.stringify(deriveLiberiaGeography(bytes.toString("utf8"), DRAFT6_CIVICS_GEOGRAPHY.map.asset, sha(bytes))))).toEqual(generated);
  });

  it("the key-free outline carries the same county geometry as the keyed map", () => {
    const paths = (name: string) => [...readFileSync(`${dir}/${name}`, "utf8").matchAll(/<g><title>([^<]+)<\/title><path d="([^"]+)"/g)].map((m) => `${m[1]}|${m[2]}`);
    expect(paths(DRAFT6_CIVICS_GEOGRAPHY.outline.asset)).toEqual(paths(DRAFT6_CIVICS_GEOGRAPHY.map.asset));
    expect(readFileSync(`${dir}/${DRAFT6_CIVICS_GEOGRAPHY.outline.asset}`, "utf8")).not.toMatch(/Tubmanburg|Voinjama|Harper/);
  });

  it("keeps attribution, licence and the no-route disclaimer", () => {
    expect(data.source).toMatchObject({ license: "CC BY 3.0 IGO", upstreamCommit: "9469f09", representedYear: 2021 });
    expect(data.source.endorsement).toMatch(/no endorsement/i);
    expect(geographyTextAlternative(data)).toMatch(/no roads, distances or capital points/);
  });
});

describe("geography derived from the outlines", () => {
  it("has fifteen numbered counties with symmetric neighbour lists", () => {
    expect(data.counties.map((x) => x.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    for (const county of data.counties) for (const n of county.neighbours) expect(c(n).neighbours).toContain(county.id);
  });

  it("states the handoff's required spatial facts: Lofa north and inland; Maryland south-east and coastal", () => {
    expect(c("lofa")).toMatchObject({ region: "north", coastal: false });
    expect(c("maryland")).toMatchObject({ region: "south-east", coastal: true });
    expect(c("lofa").centroid[1]).toBe(Math.min(...data.counties.map((x) => x.centroid[1])));
    expect(compassBetween(c("maryland").centroid, c("lofa").centroid)).toBe("north-west");
  });

  it("classifies the coast and excludes corner contacts as neighbours", () => {
    expect(data.counties.filter((x) => x.coastal).map((x) => x.id).sort()).toEqual(["bomi", "grand-bassa", "grand-cape-mount", "grand-kru", "margibi", "maryland", "montserrado", "river-cess", "sinoe"]);
    expect(c("sinoe").neighbours).not.toContain("nimba");
    expect(c("lofa").neighbours).toEqual(["bong", "gbarpolu"]);
  });

  it("arrow-key steps move in the pressed direction", () => {
    expect(stepToward(data, c("bong"), "north")?.id).toBe("lofa");
    expect(stepToward(data, c("lofa"), "north")).toBeNull();
    expect(stepToward(data, c("river-gee"), "south")?.id).toMatch(/maryland|grand-kru/);
  });

  it("attaches only to the exact sealed identity", () => {
    const scenes = ["generated-1", "generated-2", "generated-3", "generated-4", "generated-5", "generated-assess"];
    const exact = geographicAttachments({ selection: DRAFT6_CIVICS_GEOGRAPHY.selection, packageHash: manifest.packageHash, candidateSha256: manifest.candidateSha256 }, scenes);
    expect(Object.keys(exact).sort()).toEqual(scenes.slice(0, 5));
    expect(exact["generated-3"][0].variant).toBe("OUTLINE_TASK");
    expect(geographicAttachments({ selection: DRAFT6_CIVICS_GEOGRAPHY.selection, packageHash: "0".repeat(64), candidateSha256: manifest.candidateSha256 }, scenes)).toEqual({});
    expect(geographicAttachments({ selection: "factory@4.0.0-draft.5@g7-civics-counties-capitals", packageHash: manifest.packageHash, candidateSha256: manifest.candidateSha256 }, scenes)).toEqual({});
  });
});
