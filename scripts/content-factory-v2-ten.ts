import fs from "fs";
import path from "path";
import { z } from "zod";
import { runCandidateBatch } from "../lib/content-factory/v2/batch";
import { actorSchema, batchContractSchema, bytesHash } from "../lib/content-factory/v2/batchContract";
import { FACTORY_ROLES } from "../lib/content-factory/v2/blueprint";
import { staticBatchExecutors } from "../lib/content-factory/v2/staticBatch";

/** Explicit local files only. No credentials, dynamic code imports or production clients. */
async function main() {
  if (process.env.CONTENT_FACTORY_TEN_CANDIDATES !== "1") throw new Error("content_factory_ten_disabled");
  const configPath = process.argv[2];
  if (!configPath) throw new Error("Usage: content-factory-v2-ten.ts <local-config.json>");
  const config = z.strictObject({
    contractFile: z.string(), inventoryFile: z.string(), outputRoot: z.string(),
    actors: z.record(z.enum(FACTORY_ROLES), actorSchema),
    generationFiles: z.record(z.string(), z.string()),
    productionCapture: z.strictObject({ jsonlFile: z.string(), manifestFile: z.string(),
      provenance: z.strictObject({ authorizationRef: z.string(), targetAttestationRef: z.string(), queryCommit: z.string(), querySha256: z.string() }),
    }).optional(),
  }).parse(JSON.parse(fs.readFileSync(configPath, "utf8")));
  const relative = (file: string) => path.resolve(path.dirname(configPath), file);
  const contract = batchContractSchema.parse(JSON.parse(fs.readFileSync(relative(config.contractFile), "utf8")));
  const inventory = JSON.parse(fs.readFileSync(relative(config.inventoryFile), "utf8"));
  const productionCapture = config.productionCapture ? {
    raw: fs.readFileSync(relative(config.productionCapture.jsonlFile), "utf8"),
    manifestJson: fs.readFileSync(relative(config.productionCapture.manifestFile), "utf8"), provenance: config.productionCapture.provenance,
  } : undefined;
  // Preload and check every generation input, so lesson ten cannot discover a missing file after calls.
  const generation = new Map(contract.lessons.map(entry => {
    const file = config.generationFiles[entry.candidateId];
    if (!file) throw new Error("batch_generation_file_missing");
    const bytes = fs.readFileSync(relative(file));
    if (bytesHash(bytes) !== entry.generation.sha256) throw new Error("batch_generation_input_hash_mismatch");
    return [entry.candidateId, bytes] as const;
  }));
  const summaries = await runCandidateBatch({ enabled: true, contract, inventory, outputRoot: relative(config.outputRoot), actors: config.actors,
    productionCapture,
    generationInputs: Object.fromEntries([...generation].map(([id, bytes]) => [id, bytes.toString("base64")])),
    createExecutors: ({ entry }) => {
      const bytes = generation.get(entry.candidateId);
      if (!bytes) throw new Error("batch_generation_file_missing");
      return staticBatchExecutors(bytes, entry.generation.sha256);
    },
  });
  process.stdout.write(JSON.stringify({ schemaVersion: contract.schemaVersion, evidence: contract.evidence.kind, summaries }, null, 2) + "\n");
  if (summaries.some(s => s.generationStatus !== "AWAITING_HUMAN_REVIEW")) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "factory_failed"}\n`); process.exitCode = 1; });
