import { readFile, writeFile } from "fs/promises";
import { inventoryLegacy } from "../lib/content-factory/v2/inventory";

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error("usage: tsx scripts/content-factory-v2-inventory.ts <read-only-export.json> <local-report.json>");
  const report = inventoryLegacy(JSON.parse(await readFile(inputPath, "utf8")));
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ rows: report.rows.length, selectedDatabaseId: report.selected?.databaseId ?? null, liveVerification: report.liveVerification, writes: report.writes })}\n`);
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "inventory_failed"}\n`); process.exitCode = 1; });
