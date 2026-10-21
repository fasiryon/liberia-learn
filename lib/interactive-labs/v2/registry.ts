import { circuitDefinition } from "./definitions/circuit";
import { leverDefinition } from "./definitions/lever";
import { solidsDefinition } from "./definitions/solids";
import { hydropowerDefinition } from "./definitions/hydropower";
import { countyDefinition, waterDefinition, fractionsDefinition } from "./definitions/firstThree";
import type { InteractiveLabDefinition, LabState } from "./types";

export const interactiveLabDefinitions = Object.freeze({ [solidsDefinition.id]: solidsDefinition, [leverDefinition.id]: leverDefinition, [circuitDefinition.id]: circuitDefinition, [hydropowerDefinition.id]: hydropowerDefinition, [countyDefinition.id]: countyDefinition, [waterDefinition.id]: waterDefinition, [fractionsDefinition.id]: fractionsDefinition });
export function getInteractiveLabDefinition(id: string): InteractiveLabDefinition<LabState> | null { return interactiveLabDefinitions[id as keyof typeof interactiveLabDefinitions] as InteractiveLabDefinition<LabState> | undefined ?? null; }
