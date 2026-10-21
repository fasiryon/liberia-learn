/** Trusted, narrow adaptation of the delivered first-three authoring/runtime contract.
 * Original authored bytes and media are retained in review packages; this never grants eligibility.
 */
import { createHash } from "crypto";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { FIRST_THREE_LAB_IDS, FIRST_THREE_LAB_VERSION } from "@/lib/interactive-labs/v2/definitions/firstThree";
import geometry from "@/lib/interactive-labs/v2/definitions/firstThree/map-data.json";
import type { AuthoringInput } from "./authoringInput";
import type { ResourceDraft } from "./types";
import { parseResourceDraft } from "./quality";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Superseded V1 canonical inputs. Their packages are historical evidence; they never bind to the current runtime. */
export const SUPERSEDED_V1_CANONICAL_INPUTS: readonly string[] = [
  "d3c983060d971804ae209361dd25377265d3e80d9fc34882a0488f04a35a79ec",
  "5878123ea2eb9a9b2ee043fb3a2af09464c91514bb6a5091e31081741fcc9e4c",
  "891fde7cd106cc4c767c5005480555c8bd1eadba5bdf918eca8e25067c2950eb",
];
/** V2 canonical inputs, sha256(JSON.stringify(input)). extraScenes are authored LAB scenes that reuse a media runtime. */
const pins: Readonly<Record<string,{input:string;labId:string;media:readonly string[];extraScenes?:Readonly<Record<string,readonly string[]>>}>> = {
  wk_mca7a_fri_p4:{input:"bc5dadf2583adbf8670c219504245840c0153f38e07a30276656e122bf3a6356",labId:FIRST_THREE_LAB_IDS.civics,media:["ft01-v1","ft01-v2"],extraScenes:{"ft01-v2":["s12b-place-interior"]}},
  wk_mca7a_fri_p3:{input:"fb4d8f49a3b1f2841db9182205e2325897c14c414afd42c86bd04cbba72dfa80",labId:FIRST_THREE_LAB_IDS.science,media:["ft04-v1"]},
  lesson_mca_1:{input:"33ec4103fcd1ec6f73d7ef91b23f0cd1fe47b1ac5414d5d2d38403c724dc7940",labId:FIRST_THREE_LAB_IDS.mathematics,media:["ft07-v1","ft07-v2"]},
};

/** Corrected authored baseline. Historical V2 inputs remain resolvable as V2 evidence. */
export const V021_CANONICAL_INPUTS: Readonly<Record<string, string>> = {
  wk_mca7a_fri_p4: "2cd1e6b097d8421d20637570d0a6589095dc17d99f9a054ddd8043afbf98c544",
  wk_mca7a_fri_p3: "52be8b196f47b8f6b98672c7a575b243c9bf5717c26d5a722e15b1f348fdd764",
  lesson_mca_1: "6c73ffedaf43a59f69b83013c33e33ed7a7b599382301f737b68fb262b8eab1f",
};

export function resolveAuthoredRuntime(input: AuthoringInput) {
  const pin=pins[input.source.contentId];
  const inputHash=hash(input);
  if(!pin||(inputHash!==pin.input&&inputHash!==V021_CANONICAL_INPUTS[input.source.contentId]))return null;
  const definition=getInteractiveLabDefinition(pin.labId);
  if(!definition||definition.version!==FIRST_THREE_LAB_VERSION||definition.reviewState!=="DRAFT"||definition.approvalState!=="PENDING"||validateHighFidelityDefinition(definition).length)return null;
  const bindings=pin.media.flatMap(id=>{
    const media=input.mediaSpecifications.find(m=>m.id===id);
    if(!media)return [null];
    const scenes=input.resources.flatMap(resource=>{
      const draft=parseResourceDraft({id:resource.id,version:resource.version,payload:resource.payload});
      if(draft.payload.kind!=="LESSON")return [];
      return draft.payload.candidate.scenes.filter(scene=>scene.id===media!.sceneId||(pin.extraScenes?.[id]??[]).includes(scene.id)).map(scene=>({resourceId:resource.id,sceneId:scene.id}));
    });
    if(!media||scenes.length!==1+(pin.extraScenes?.[id]?.length??0))return [null];
    return scenes.map(scene=>({mediaId:id,...scene,sourceMedia:media.provenance!,labId:pin.labId,labVersion:definition.version}));
  });
  if(bindings.some(b=>b===null))return null;
  return {schemaVersion:"first-three-runtime-binding/1.2.0",authoredCanonicalSha256:inputHash,authoredGeneration:inputHash===pin.input?"V2" as const:"V0.2.1" as const,source:input.source,bindings:bindings as NonNullable<(typeof bindings)[number]>[],
    derivedGeometrySha256:pin.labId===FIRST_THREE_LAB_IDS.civics?hash(geometry):null,
    studentEligible:false,state:"DRAFT",approved:false,released:false,
    notices:["Adapted interaction to registered LAB_LAUNCH; retained original authored input, instructional content and source media hashes.",
      "Runtime keyboard controls provide equivalent native buttons/selects/ranges; source interaction descriptions remain review evidence.",
      ...(pin.labId===FIRST_THREE_LAB_IDS.civics?[geometry.displayLimitation,"CC-BY-3.0-IGO retained; asset-policy approval is pending."]:[])]};
}

export function adaptAuthoredRuntime(input:AuthoringInput,drafts:Record<string,ResourceDraft[]>):Record<string,ResourceDraft[]> {
  const runtime=resolveAuthoredRuntime(input);
  if(!runtime)return drafts;
  const definition=getInteractiveLabDefinition(runtime.bindings[0].labId)!;
  return Object.fromEntries(Object.entries(drafts).map(([role,resources])=>[role,resources.map(resource=>{
    if(resource.payload.kind!=="LESSON")return resource;
    const candidate=resource.payload.candidate;
    const bindings=runtime.bindings.filter(b=>b.resourceId===resource.id);
    return {...resource,payload:{...resource.payload,candidate:{...candidate,
      scenes:candidate.scenes.map(scene=>{const binding=bindings.find(b=>b.sceneId===scene.id);return binding?{...scene,type:"LAB" as const,interaction:{kind:"LAB_LAUNCH" as const,labCandidateId:`runtime-${binding.mediaId}-${binding.sceneId}`}}:scene;}),
      labProposals:[...candidate.labProposals,...bindings.map(binding=>{
        const scene=candidate.scenes.find(s=>s.id===binding.sceneId)!;
        const objectiveId=scene.objectiveIds.find(id=>definition.checks.some(c=>c.objectiveId===id))??scene.objectiveIds[0];
        return {id:`runtime-${binding.mediaId}-${binding.sceneId}`,labId:binding.labId,objectiveId,placementSceneId:scene.id,requirement:"REQUIRED" as const,checkIds:definition.checks.filter(c=>c.objectiveId===objectiveId).map(c=>c.id),rationale:"Exact-source first-three DRAFT runtime binding; no academic approval or official evidence mapping."};
      })],
    }}};
  })]));
}
