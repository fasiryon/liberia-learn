// Empty metadata templates only. Existing restricted authoring inputs are never read or changed.
import fs from "fs";
import { readPinnedFirstTenSpec, firstTenBlueprint, firstTenSpecSchema } from "../lib/content-factory/v2/firstTen";
import { z } from "zod";
import { createAuthoringTemplate } from "../lib/content-factory/v2/authoringInput";
import { createHash } from "crypto";
const specBytes = readPinnedFirstTenSpec();
const spec = firstTenSpecSchema.parse(JSON.parse(specBytes.toString()));
const bindings = z.object({bindings: z.array(z.object({source: z.object({databaseId: z.string(), contentId: z.string(), revisionId: z.string(), revisionNumber: z.number().int(), snapshotSha256: z.string()})})).length(10)}).parse(JSON.parse(fs.readFileSync("curriculum/factory-v2/contracts/1.0.0/source-bindings.json", "utf8"))).bindings;
const sources = {specSha256: createHash("sha256").update(specBytes).digest("hex"), extractSha256: spec.basis.inventory.extractSha256, lessons: spec.lessons.map((lesson, index) => ({lesson, sourceRef: bindings[index].source}))};
for (const id of ["wk_mca7a_fri_p4", "wk_mca7a_fri_p3", "lesson_mca_1"]) {
  const index = spec.lessons.findIndex(lesson => lesson.contentId === id);
  const template = createAuthoringTemplate(firstTenBlueprint(sources, index));
  fs.writeFileSync(`curriculum/factory-v2/authoring/first-three/${id}.input-template.json`, JSON.stringify(template, null, 2) + "\n");
}
console.log("Three empty 1.0.0-cohort templates written at candidate version 0.2.0; no authored content generated.");
