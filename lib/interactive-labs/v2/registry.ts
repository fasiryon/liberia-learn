import { leverDefinition } from "./definitions/lever";
import { solidsDefinition } from "./definitions/solids";
import type { InteractiveLabDefinition, LabState } from "./types";

export const interactiveLabDefinitions = Object.freeze({ [solidsDefinition.id]: solidsDefinition, [leverDefinition.id]: leverDefinition });
export function getInteractiveLabDefinition(id: string): InteractiveLabDefinition<LabState> | null { return interactiveLabDefinitions[id as keyof typeof interactiveLabDefinitions] as InteractiveLabDefinition<LabState> | undefined ?? null; }
