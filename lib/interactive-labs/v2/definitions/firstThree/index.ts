import type { InteractiveLabDefinition, LabState, LearningCheck, Transform } from "../../types";
import { composeHighFidelity } from "../../fidelity/engine";
import { HIGH_FIDELITY_SPEC_VERSION, type ComponentDefinition, type HighFidelitySpec, type SimulationModel, type VariableDefinition } from "../../fidelity/types";
import map from "./map-data.json";
import { COUNTIES, countyModel, countyVariablesValid, waterModel, waterVariablesValid, fractionModel, fractionVariablesValid } from "./models";

export const FIRST_THREE_LAB_IDS = { civics: "g7-liberia-counties", science: "g7-water-particles", mathematics: "g7-fraction-manipulatives" } as const;
export const FIRST_THREE_LAB_VERSION = "1.1.0";
const modes = ["GUIDED", "EXPLORE", "CHALLENGE", "ASSESSMENT"] as const;
const initial = (): LabState => ({ mode: "GUIDED", selectedObjectId: null, focusedObjectId: null, rotations: {}, highlightedFeatures: {}, netObjectIds: [], completedChecks: [], retries: 0, hints: 0, lastFeedback: null });
const transform = (position: Transform["position"], scale: Transform["scale"] = [1,1,1]): Transform => ({ position, scale, rotation: [0,0,0] });
const variable = (id: string, label: string, min: number, max: number, start: number, step=1): VariableDefinition => ({ id,label,min,max,initial:start,step,kind:"discrete",learnerControlled:true });
const box = (id:string,label:string,position:Transform["position"],scale:Transform["scale"],color="#64748b"): ComponentDefinition => ({id,label,geometry:"box",transform:transform(position,scale),material:{color,roughness:1,metalness:0,opacity:1},showLabel:false,selectable:false});
const check = (id:string,prompt:string,objectiveId:string,quantityId:string,min=1,max=1):LearningCheck => ({id,prompt,objectiveId,conceptId:`draft-${objectiveId}`,kind:"direct-manipulation",answer:{quantityId},fidelity:{kind:"reach-target",quantityId,min,max},hints:[]});

function definition(id:string,title:string,subject:string,objectives:string[],spec:HighFidelitySpec,checks:LearningCheck[]):InteractiveLabDefinition<LabState>{
  const base:InteractiveLabDefinition<LabState>={
    contractVersion:"interactive-lab-definition/2.0.0",id,version:FIRST_THREE_LAB_VERSION,title,summary:spec.authoring.whyInteractive,grade:7,subject,
    objectiveIds:objectives,conceptIds:objectives.map(o=>`draft-${o}`),
    releaseBinding:{releaseId:"factory-first-three-draft-unreleased",releaseIdentity:"not-approved",activityId:id,activityVersion:FIRST_THREE_LAB_VERSION},
    provenance:{source:"First-three authored source bindings; proposed objectives, not governed approval",reference:"curriculum/factory-v2/first-ten-baseline.json",author:"LiberiaLearn"},
    reviewState:"DRAFT",approvalState:"PENDING",scene:{objects:[],lighting:{ambient:"#9aa8c7",key:"#ffffff"},camera:{fov:42,minDistance:2,maxDistance:24}},
    interactions:["inspect","set-variable","set-variables","guided-step","answer/check"],initialState:initial(),
    validateAction:(_state,action)=> action.type==="reset"||action.type==="mode"&&modes.some(m=>m===action.mode)?{ok:true}:{ok:false,reason:"This draft lab accepts only its declared controls and checks."},
    transition:(state,action)=>action.type==="reset"?initial():action.type==="mode"?{...state,mode:action.mode,lastFeedback:null,...(action.mode==="ASSESSMENT"?{completedChecks:[],hints:0,retries:0}:{})}:state,
    checks,accessibility:{touch:true,keyboard:true,reducedMotion:true,offline:true,fallback:"FALLBACK_2D"},
  };
  return composeHighFidelity(base,spec);
}

function specBase(input:{goal:string;why:string;rules:string;components:ComponentDefinition[];variables:VariableDefinition[];simulation:SimulationModel;kind:NonNullable<HighFidelitySpec["learningTools"]>["kind"];paper:string[];guided:string[];target:[number,number,number];distance:number}):HighFidelitySpec{
  return {specVersion:HIGH_FIDELITY_SPEC_VERSION,
    authoring:{learningObjective:input.goal,whyInteractive:input.why,scene:input.goal,components:input.components.map(c=>c.label).filter(Boolean).join("; "),
      internalStructures:"No hidden physical mechanism is claimed in this conceptual model.",variables:input.variables.map(v=>`${v.label}: ${v.min} to ${v.max}`).join("; "),simulationRules:input.rules,
      learnerControls:"Direct scene selection, labelled buttons and exact keyboard controls through the existing LabAction kernel.",visualConsequences:input.rules,guidedPath:input.guided.join(" "),
      exploreMode:"Manipulate the same model without scoring or academic writes.",challenge:input.guided.at(-1)!,assessment:"Complete direct-manipulation checks without coaching, hints or derived solutions. These are draft review checks, not official assessments.",
      evidence:"Local review only. No authority mapping, canonical evidence, grade or publication. Only existing check actions can be observations.",misconceptions:input.rules,
      accessibility:"Equivalent keyboard, touch and mouse controls; visible focus; text feedback; reduced motion; identical instructional content on LOW and SVG.",deviceProfile:"Shared Runtime V2 renderers. Same instructional objects across all profiles. Real-device performance remains unverified.",offlineFallback:input.paper.join(" ")},
    components:input.components.map(c=>({...c,...(c.selectable!==false?{semanticCues:["target" as const,"label" as const]}:{})})),assemblies:[],exploded:[],cutaways:[],layers:[],poseTransitions:[],variables:input.variables,simulation:input.simulation,flows:[],
    camera:{defaultPresetId:"overview",presets:[{id:"overview",label:"Overview",target:input.target,distance:input.distance,yaw:0,pitch:0,frame:{componentIds:input.components.map(c=>c.id)}}],
      constraints:{minDistance:2,maxDistance:40,minPitch:-0.01,maxPitch:0.01,minYaw:-0.01,maxYaw:0.01}},
    guidedPath:input.guided.map((prompt,i)=>({id:`step-${i+1}`,prompt,cameraPresetId:"overview"})),modes:[...modes],
    offline:{remoteAssets:[],maxPackageBytes:290_000},environment:"STUDIO",independentAssessment:true,
    learningTools:{kind:input.kind,paperInstructions:input.paper,attribution:input.kind==="county-map"?map.attribution:"Original procedural LiberiaLearn draft model. No measured observations or protected assessment keys."},
  };
}

const countyComponents:ComponentDefinition[]=COUNTIES.flatMap((county,i)=>[
  {id:county.id,label:county.name,geometry:"panel" as const,transform:transform([county.center[0],county.center[1]+5,0]),
    geometryVariants:{HIGH:{kind:"extrude" as const,contour:county.contour,depth:0.025},STANDARD:{kind:"sameAs" as const,profile:"HIGH" as const},LOW:{kind:"extrude" as const,contour:county.contour,depth:0.025},FALLBACK_2D:{kind:"polygon" as const,points:county.contour}},
    material:{color:county.coastal?"#87b4ce":"#c5c9ad",roughness:1,metalness:0,opacity:1},selectable:true,showLabel:true,carriesPlaceIdentity:true},
  box(`capital-marker-${i}`,`Placed capital card for ${county.name}`,[county.center[0],county.center[1]+5,0.10],[0.055,0.055,0.035],"#fbbf24"),
]);
const countyVariables=[variable("county","Selected county",0,14,0),variable("boundaryA","Boundary county A",0,14,0),variable("boundaryB","Boundary county B",0,14,0),variable("boundaryDecision","Shared boundary decision",0,2,0),...COUNTIES.map((c,i)=>variable(`capital${i}`,`${c.name} capital card`,0,17,0))];
export const COUNTY_SPEC:HighFidelitySpec={...specBase({goal:"Locate Liberia's counties and administrative capitals, distinguish capitals from large towns, and identify shared county boundaries.",
  why:"Place capital cards on real county outlines, investigate neighbouring counties, and test a shared-boundary claim.",rules:"Pinned county contours and positive-length source edges determine location and adjacency. Card placement does not imply a town is largest or nationally capital.",
  components:countyComponents,variables:countyVariables,simulation:countyModel,kind:"county-map",target:[0,5,0],distance:16,
  guided:["Read the map key. Select counties in coastal then interior reading order.","Place capital cards. Distinguish county administration from the largest town or national capital.","Select two counties, trace their outlines, and decide whether they share a boundary."],
  paper:["Draw or print the same unlabelled county outline. Number counties in the supplied coastal/interior reading order.","Write county and capital cards on separate pieces of paper. Place them, record choices in a blank table, then compare with a teacher-held checking sheet.","Trace the boundary of two counties with a finger or pencil. Record whether a positive-length boundary is shared and explain; proximity alone is insufficient."]}),
  validateVariables:countyVariablesValid,
  componentAction:(id)=>{const index=COUNTIES.findIndex(c=>c.id===id);return index<0?null:{type:"set-variable",variableId:"county",value:index};},
  modeStart:{ASSESSMENT:{variables:Object.fromEntries(countyVariables.map(v=>[v.id,v.initial]))}},
};
export const countyDefinition=definition(FIRST_THREE_LAB_IDS.civics,"Liberia: counties, capitals and boundaries","CIVICS",["ft01-o1","ft01-o2","ft01-o3"],COUNTY_SPEC,[
  check("place-county-capitals","Place all 15 county capitals. Leave unused cards in the tray.","ft01-o1","correctPlacements",15,15),
  check("identify-shared-boundary","Select two different counties. Trace their outlines, then decide whether they share a boundary.","ft01-o3","boundaryCorrect"),
]);

const waterComponents:ComponentDefinition[]=[
  ...[[0,-0.2,0.10],[0,0.3,0.10],[-0.25,0.05,0.10],[0.25,0.05,0.10]].map((p,i)=>box(`vapour-region-edge-${i}`,"Schematic vapour region",p as [number,number,number],i<2?[0.25,0.012,0.015]:[0.012,0.25,0.015],"#fbbf24")),
  box("vessel-left","Vessel left wall",[-2.15,1.1,0],[0.035,2,0.12]),box("vessel-right","Vessel right wall",[2.15,1.1,0],[0.035,2,0.12]),box("vessel-bottom","Vessel base",[0,-0.9,0],[2.18,0.035,0.12]),
  ...Array.from({length:24},(_,i):ComponentDefinition=>({id:`water-particle-${i}`,label:`Water particle ${i+1}`,geometry:"sphere",transform:transform([0,0,0],[0.10,0.10,0.10]),material:{color:"#22d3ee",roughness:0.5,metalness:0,opacity:1},selectable:true,showLabel:false})),
];
const waterVariables=[variable("energyJPerG","Added energy (J/g)",0,3094,0),variable("surfaceExchange","Surface exchange view",0,1,0)];
export const WATER_SPEC:HighFidelitySpec={...specBase({goal:"Explain particle motion, phase changes and energy/temperature behavior for ideal pure water near 1 atmosphere.",why:"Add and remove energy while observing conserved, constant-size particles and temperature plateaux during melting and boiling.",
  rules:"Specific-energy curve in J/g: ice warming 0–42; melting at 0 C, 42–376; liquid warming 376–794; boiling at 100 C, 794–3054; vapour warming 3054–3094. Surface escapes occur in cool and hot liquid and during boiling, with faster schematic rates when hotter. Evaporation is not a temperature plateau.",
  components:waterComponents,variables:waterVariables,simulation:waterModel,kind:"water-particles",target:[0,1,0],distance:10,
  guided:["Predict how ice particles can move without leaving their lattice sites.","Add energy through melting. Compare temperature with the changing phase balance.","Warm liquid water and inspect surface exchange below boiling.","Add more energy through boiling; then remove energy to investigate condensation and freezing."],
  paper:["Use 24 pencil marks or counters of the same size. Arrange them as a lattice, close-packed liquid, or widely spaced vapour; do not create or enlarge particles.","Make an energy/temperature table and sketch the two plateaux. Mark the data as an ideal model, not measurements.","If equipment is available, a teacher may supervise ice and thermometer observations. This model does not certify handling hot equipment; no unsupervised boiling is required."]}),
  validateVariables:waterVariablesValid,hud:[{quantityId:"temperature",label:"Temperature",unit:"C",digits:1},{quantityId:"energyJPerG",label:"Energy added",unit:"J/g",digits:0},{quantityId:"particleCount",label:"Particles",digits:0}],
  modeStart:{ASSESSMENT:{variables:{energyJPerG:0,surfaceExchange:0}}},
};
export const waterDefinition=definition(FIRST_THREE_LAB_IDS.science,"Water: particles, energy and phase changes","SCIENCE",["ft04-o1","ft04-o2","ft04-o3"],WATER_SPEC,[
  check("mixed-melting","Create a state with equal amounts of ice and liquid water while the temperature remains at the melting plateau.","ft04-o2","solidFraction",0.49,0.51),
  check("mixed-boiling","Create a liquid/vapour mixture with approximately half the model bulk water in each phase at the boiling plateau.","ft04-o2","vapourFraction",0.49,0.51),
]);

const fractionComponents:ComponentDefinition[]=[
  ...["A","B"].flatMap(strip=>Array.from({length:24},(_,i)=>({...box(`piece-${strip}-${i}`,`Strip ${strip}, piece ${i+1}`,[0,strip==="A"?1.5:0.3,0],[1,0.28,0.055]),selectable:true}))),
  box("number-line","Number line from zero to two",[0,-0.9,0],[4,0.012,0.025]),
  ...Array.from({length:49},(_,i)=>box(`line-tick-${i}`,`Number line tick ${i}`,[0,-0.9,0],[0.015,0.07,0.035])),
  {...box("marker-A","Fraction A number-line card",[-4,-1.35,0.1],[0.10,0.14,0.05],"#22d3ee"),showLabel:true},
  {...box("marker-B","Fraction B number-line card",[-4,-1.75,0.1],[0.10,0.14,0.05],"#fbbf24"),showLabel:true},
  {...box("zero","0",[-4,-0.55,0],[0.015,0.015,0.015]),showLabel:true,selectable:true},
  {...box("one","1",[0,-0.55,0],[0.015,0.015,0.015]),showLabel:true,selectable:true},
  {...box("two","2",[4,-0.55,0],[0.015,0.015,0.015]),showLabel:true,selectable:true},
];
const fractionVariables=[variable("denA","Strip A equal parts",1,12,2),variable("maskA","Strip A selected pieces",0,16_777_215,1),variable("denB","Strip B equal parts",1,12,3),variable("maskB","Strip B selected pieces",0,16_777_215,3),variable("tickA","Card A tick",0,48,0),variable("tickB","Card B tick",0,48,0),variable("lockedA","Card A placed",0,1,0),variable("lockedB","Card B placed",0,1,0),variable("relation","Comparison",0,3,0),variable("reason","Comparison justification",0,3,0)];
export const FRACTION_SPEC:HighFidelitySpec={...specBase({goal:"Represent and operate on fractions using equal wholes, exact subdivision, two-whole strips and a common number line.",why:"Shade pieces, split without changing quantity, add/remove units and place fraction cards before comparing and explaining.",
  rules:"Each whole has identical length. Exact integer masks preserve shading through subdivision. Improper fractions extend past one whole. Common denominators above 24 are unsupported and rejected, never rounded.",
  components:fractionComponents,variables:fractionVariables,simulation:fractionModel,kind:"fraction-strips",target:[0,0,0],distance:13,
  guided:["Identify the equal wholes. Shade and unshade equal parts on each strip.","Split every half into quarters, then eighths. Explain why the selected quantity stays unchanged.","Compose five quarters across two wholes, then add or remove exact pieces.","Move and lock both fraction cards on the common line. Compare their positions and justify the relation."],
  paper:["Draw two pairs of equal-length paper strips. Divide equal wholes into halves, quarters and eighths, using hatching for selected pieces.","Represent five quarters across two wholes. Subdivide all selected pieces together and record equivalent fractions; physically add or remove pieces for arithmetic.","Draw a number line from 0 to 2 with an exact common subdivision. For thirds and fourths use twelfths, not rounded eighths. Place two cards and write a comparison and explanation."]}),
  validateVariables:fractionVariablesValid,
  componentAction:(id,v)=>{const match=/^piece-([AB])-(\d+)$/.exec(id);if(!match)return null;const strip=match[1],index=Number(match[2]);return index<2*v[`den${strip}`]?{type:"set-variables",values:{[`mask${strip}`]:v[`mask${strip}`] ^ 2 ** index,[`locked${strip}`]:0,relation:0,reason:0}}:null;},
  modeStart:{ASSESSMENT:{variables:Object.fromEntries(fractionVariables.map(v=>[v.id,v.initial]))}},
};
export const fractionsDefinition=definition(FIRST_THREE_LAB_IDS.mathematics,"Fractions: strips and number lines","MATH",["ft07-o1","ft07-o2","ft07-o3"],FRACTION_SPEC,[
  check("equivalent-half","Represent one half with at least four equal parts per whole.","ft07-o1","equivalentHalf"),
  check("five-quarters","Compose five quarters on strip A, across two equal wholes.","ft07-o2","improperFiveQuarters"),
  check("compare-and-explain","Place and lock both cards accurately, choose the comparison, and justify it using the common number line.","ft07-o3","comparisonCorrect"),
]);

export const firstThreeDefinitions=[countyDefinition,waterDefinition,fractionsDefinition] as const;
