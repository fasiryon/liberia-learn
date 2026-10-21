import fs from "fs";
import { execFileSync } from "child_process";
import { FIRST_TEN_AMENDMENT_PINS, FIRST_TEN_CONTRACT_PIN, loadAmendedFirstTenContract } from "./contractPolicy";
import type { StatedPrimaryObjectives } from "./assessmentAttribution";

const STATED_PRIMARY = "curriculum/factory-v2/authoring/first-three/stated-primary-objectives.json";
const gitBytes = (sourceRef: string) => execFileSync("git", ["show", sourceRef.replace(/^git:/, "")], { maxBuffer: 64 * 1024 * 1024 });

/** Read the pinned contract and amendments from local git objects; hashes are verified by loadAmendedFirstTenContract. */
export function loadPinnedContractPolicy() {
  const contract = loadAmendedFirstTenContract(gitBytes(FIRST_TEN_CONTRACT_PIN.sourceRef), FIRST_TEN_AMENDMENT_PINS.map(pin => gitBytes(pin.sourceRef)));
  const stated = JSON.parse(fs.readFileSync(STATED_PRIMARY, "utf8")) as { tasks: StatedPrimaryObjectives };
  return { contract, statedPrimary: stated.tasks };
}
