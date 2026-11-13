import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Own audit scratch file only. Inputs are explicitly selected synthetic fields.
export function observe(id: string, observed: unknown) {
  const target = fileURLToPath(new URL("../scratch/observations.jsonl", import.meta.url));
  appendFileSync(target, JSON.stringify({ id, observed }) + "\n", "utf8");
}
