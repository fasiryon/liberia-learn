import fs from "fs";
import path from "path";
import { tenLessonFixture } from "../lib/content-factory/v2/batchFixture";

async function main() {
  const dir = path.resolve(process.argv[2] ?? "artifacts/content-factory-v2/ten-fixture");
  // Exclusive creation protects previous inputs and packages.
  fs.mkdirSync(dir);
  const fixture = await tenLessonFixture();
  const write = (file: string, value: unknown) => fs.writeFileSync(path.join(dir, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  write("contract.json", fixture.contract); write("inventory.json", fixture.inventory);
  fs.writeFileSync(path.join(dir, "generation.json"), fixture.generationBytes, { flag: "wx" });
  write("config.json", { contractFile: "contract.json", inventoryFile: "inventory.json", outputRoot: "packages", actors: fixture.actors,
    generationFiles: Object.fromEntries(fixture.contract.lessons.map(l => [l.candidateId, "generation.json"])),
  });
  process.stdout.write(`Synthetic fixture only: ${path.join(dir, "config.json")}\n`);
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "fixture_failed"}\n`); process.exitCode = 1; });
