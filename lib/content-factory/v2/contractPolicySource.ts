import fs from "fs";
import { execFileSync } from "child_process";
import { FIRST_TEN_AMENDMENT_PINS, V021_AMENDMENT_PINS, FIRST_TEN_CONTRACT_PIN, loadAmendedFirstTenContract } from "./contractPolicy";
import type { StatedPrimaryObjectives } from "./assessmentAttribution";

const STATED_PRIMARY = "curriculum/factory-v2/authoring/first-three/stated-primary-objectives.json";
const gitBytes = (sourceRef: string) => execFileSync("git", ["show", sourceRef.replace(/^git:/, "")], { maxBuffer: 64 * 1024 * 1024 });

/** Read the pinned contract and amendments from local git objects; hashes are verified by loadAmendedFirstTenContract. */
export function loadPinnedContractPolicy(generation: "V2" | "V0.2.1" = "V2") {
  const pins = generation === "V0.2.1" ? V021_AMENDMENT_PINS : FIRST_TEN_AMENDMENT_PINS;
  const contract = loadAmendedFirstTenContract(gitBytes(FIRST_TEN_CONTRACT_PIN.sourceRef), pins.map(pin => pin.sourceRef.startsWith("repo-path:") ? fs.readFileSync(pin.sourceRef.slice("repo-path:".length)) : gitBytes(pin.sourceRef)), generation);
  const stated = JSON.parse(fs.readFileSync(generation === "V0.2.1" ? STATED_PRIMARY.replace(".json", "-v021.json") : STATED_PRIMARY, "utf8")) as { tasks: StatedPrimaryObjectives };
  return { contract, statedPrimary: stated.tasks };
}
