// Regenerate lib/learner-experience/geography/liberia-adm1-2021.json from the pinned draft.6 civics map.
// Usage: npx tsx scripts/learning-v4/generate-liberia-geography.ts   (fails if the asset bytes do not match the sealed manifest)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { deriveLiberiaGeography } from "@/lib/learner-experience/geography/liberiaCountyMap";
import { DRAFT6_CIVICS_GEOGRAPHY } from "@/lib/learner-experience/geography/draft6Binding";

const dir = "curriculum/factory-v4/drafts/4.0.0-draft.6/g7-civics-counties-capitals";
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8")) as { packageHash: string; files: Record<string, string> };
if (manifest.packageHash !== DRAFT6_CIVICS_GEOGRAPHY.packageHash) throw Error("package hash differs from the binding");
const bytes = readFileSync(`${dir}/${DRAFT6_CIVICS_GEOGRAPHY.map.asset}`);
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== manifest.files[DRAFT6_CIVICS_GEOGRAPHY.map.asset] || sha256 !== DRAFT6_CIVICS_GEOGRAPHY.map.sha256) throw Error("map asset hash mismatch");
const data = deriveLiberiaGeography(bytes.toString("utf8"), DRAFT6_CIVICS_GEOGRAPHY.map.asset, sha256);
writeFileSync("lib/learner-experience/geography/liberia-adm1-2021.json", JSON.stringify(data) + "\n");
console.log(data.counties.map((c) => `${c.number}. ${c.name} [${c.region}${c.coastal ? ", coast" : ""}] -> ${c.neighbours.join(", ")}`).join("\n"));
