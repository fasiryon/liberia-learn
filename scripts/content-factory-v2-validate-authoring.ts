import fs from "fs";
import { blueprintHash } from "../lib/content-factory/v2/blueprint";
import { authoringGenerationInput, authoringInputSchema, validateAuthoringInput } from "../lib/content-factory/v2/authoringInput";
import { unitBlueprintSchema } from "../lib/content-factory/v2/blueprint";

const [mode, ...files] = process.argv.slice(2);
if (!["--template", "--authored", "--blueprint-hash", "--generation-json"].includes(mode) || files.length === 0 || mode === "--generation-json" && files.length !== 1) {
  process.stderr.write("Usage: --template|--authored|--blueprint-hash <authoring-input.json> [...], or --generation-json <one-authored-input.json>\n"); process.exitCode = 1;
} else for (const file of files) {
  try {
    const input = JSON.parse(fs.readFileSync(file, "utf8"));
    if (mode === "--generation-json") {
      process.stdout.write(JSON.stringify(authoringGenerationInput(input), null, 2) + "\n");
    } else if (mode === "--blueprint-hash") {
      const envelope = authoringInputSchema.parse(input);
      const blueprint = unitBlueprintSchema.parse(envelope.blueprint);
      process.stdout.write(JSON.stringify({ file, blueprintContentHash: blueprintHash(blueprint) }) + "\n");
    } else {
      const result = validateAuthoringInput(input, mode === "--template" ? "template" : "authored");
      process.stdout.write(JSON.stringify({ file, ...result }, null, 2) + "\n");
      if (!result.valid) process.exitCode = 1;
    }
  } catch (error) { process.stderr.write(`${file}: ${error instanceof Error ? error.message : "validation_failed"}\n`); process.exitCode = 1; }
}
