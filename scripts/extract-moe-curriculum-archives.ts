import { readFile, writeFile } from "node:fs/promises";
import { parseMoeArchiveJson, type MoeArchiveSource } from "../lib/learning-authority/moeArchiveParser";

const sources: readonly MoeArchiveSource[] = [
  { id: "liberia-moe-grade-1-6-archive", document: "GRADE-1-6.zip", localPath: "curriculum/sources/raw/GRADE-1-6.zip", sourceUri: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-1-6.zip", authority: "VERIFIED_LIBERIA_MOE_SOURCE", gradeMin: 1, gradeMax: 6 },
  { id: "liberia-moe-grade-7-9-archive", document: "GRADE-7-9.zip", localPath: "curriculum/sources/raw/GRADE-7-9.zip", sourceUri: "http://www.moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip", authority: "VERIFIED_LIBERIA_MOE_SOURCE", gradeMin: 7, gradeMax: 9 },
  { id: "liberia-moe-grade-10-12-archive", document: "Grade-10-12.zip", localPath: "curriculum/sources/raw/Grade-10-12.zip", sourceUri: "http://www.moe.gov.lr/wp-content/uploads/2019/09/Grade-10-12.zip", authority: "VERIFIED_LIBERIA_MOE_SOURCE", gradeMin: 10, gradeMax: 12 },
];

async function main() {
  for (const source of sources) {
    const buffer = await readFile(source.localPath);
    const output = source.localPath.replace(/\/raw\//, "/intermediate/").replace(/\.zip$/i, ".json");
    await writeFile(output, parseMoeArchiveJson(source, buffer), "utf8");
    console.log(`${source.id}: ${output}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
