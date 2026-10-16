import { mkdir, readFile, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { validateProductionCapture } from "../lib/content-factory/v2/productionInventory";

async function main() {
  const [capturePath, outputDirectory, authorizationRef, targetAttestationRef, queryCommit] = process.argv.slice(2);
  if (!capturePath || !outputDirectory || !authorizationRef || !targetAttestationRef || !queryCommit) throw new Error("usage: <capture.jsonl> <new-output-directory> <authorization-ref> <target-attestation-ref> <query-commit>");
  const queryBytes = await readFile("scripts/content-factory-v2/production-inventory.sql");
  const captureBytes = await readFile(capturePath);
  const captureText = captureBytes.toString("utf8");
  if (!Buffer.from(captureText, "utf8").equals(captureBytes)) throw new Error("capture_invalid_utf8");
  const result = validateProductionCapture(captureText, { authorizationRef, targetAttestationRef, queryCommit, querySha256: createHash("sha256").update(queryBytes).digest("hex") });
  // The directory must be new. Restricted production artifacts must remain outside Git/public.
  const output = path.resolve(outputDirectory);
  const repository = path.resolve(".");
  const relative = path.relative(repository, output);
  if (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw new Error("production_inventory_output_must_be_outside_repository");
  await mkdir(output);
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(result.manifest, null, 2)}\n`, { flag: "wx" });
  await writeFile(path.join(output, "inventory.json"), `${JSON.stringify(result.inventory.inventory, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ validationStatus: result.manifest.validationStatus, lessonCount: result.manifest.lessonCount })}\n`);
}
main().catch(() => { process.stderr.write("inventory_validation_failed: inspect the restricted input locally; no production action was attempted\n"); process.exitCode = 1; });
