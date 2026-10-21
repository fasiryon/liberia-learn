import countyMap from "./map-data.json";
import type { SimulationModel, SimulationOutput } from "../../fidelity/types";

export const COUNTIES = countyMap.counties.map(county=>({...county,contour:county.contour.map((point):[number,number]=>{if(point.length!==2||point.some(n=>!Number.isFinite(n)))throw new Error("county_contour_invalid");return [point[0],point[1]];})}));
export const CAPITAL_CARDS = [...COUNTIES.map(c => c.capital), "Ganta", "Monrovia"];
const good = { ok: true as const };
const bad = (reason: string) => ({ ok: false as const, reason });
const integer = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;

export function countyVariablesValid(v: Readonly<Record<string, number>>) {
  for (const key of ["county", "boundaryA", "boundaryB"]) if (!integer(v[key], 0, 14)) return bad("county_unknown");
  if (!integer(v.boundaryDecision, 0, 2)) return bad("boundary_decision_invalid");
  const cards = COUNTIES.map((_, i) => v[`capital${i}`]);
  if (cards.some(card => !integer(card, 0, 17))) return bad("capital_card_unknown");
  const used = cards.filter(card => card !== 0);
  return new Set(used).size === used.length ? good : bad("capital_card_already_placed");
}

export function countiesAdjacent(a: number, b: number): boolean {
  return !!COUNTIES[a] && !!COUNTIES[b] && COUNTIES[a].neighbours.includes(COUNTIES[b].id);
}

export function capitalFeedback(county: number, card: number): string {
  if (card === 0) return "No capital card placed yet.";
  if (card === county + 1) return `${COUNTIES[county].name}: ${COUNTIES[county].capital} is its county capital.`;
  if (COUNTIES[county].id === "nimba" && card === 16) return "Ganta is Nimba's large commercial town. Its county administration is in Sanniquellie.";
  if (COUNTIES[county].id === "montserrado" && card === 17) return "Monrovia is Liberia's national capital. Montserrado's county seat is Bensonville, also called Bentol.";
  if (card > 15) return "A real town, but not a county capital.";
  const belongs = COUNTIES[card - 1];
  if (COUNTIES[county].name.startsWith("Grand ") && belongs.name.startsWith("Grand ")) return "Compare the positions of the Grand counties along the coast and inland before placing this capital.";
  return `${CAPITAL_CARDS[card - 1]} belongs to ${belongs.name}. Compare county positions, not just similar names.`;
}

export const countyModel: SimulationModel = {
  id: "liberia-county-boundary-and-capital-rules", version: "1.0.0", kind: "deterministic-rules",
  evaluate: ({ variables: v }) => {
    const selected = COUNTIES[v.county];
    const adjacent = countiesAdjacent(v.boundaryA, v.boundaryB);
    const correctPlacements = COUNTIES.filter((_, i) => v[`capital${i}`] === i + 1).length;
    const states: SimulationOutput["componentStates"] = {};
    COUNTIES.forEach((county, i) => {
      states[county.id] = { color: i === v.county ? "#67e8f9" : i === v.boundaryA || i === v.boundaryB ? "#fbbf24" : county.coastal ? "#87b4ce" : "#c5c9ad" };
      states[`capital-marker-${i}`] = { alpha: v[`capital${i}`] ? 1 : 0, color: "#fbbf24" };
    });
    return { quantities: { correctPlacements, boundaryCorrect: v.boundaryA !== v.boundaryB && v.boundaryDecision === (adjacent ? 1 : 2) ? 1 : 0 }, flows: {}, componentStates: states,
      explanation: [
        { id: "selected", text: `${selected.name}: ${selected.capital}; ${selected.coastal ? "coastal" : "interior"}. Shared-boundary neighbours: ${selected.neighbours.map(id => COUNTIES.find(c => c.id === id)!.name+(selected.shortContacts.includes(id)?" (a very short contact)":"")).join(", ")}.` },
        { id: "placement", text: capitalFeedback(v.county, v[`capital${v.county}`]) },
        { id: "boundary", text: "Adjacent counties share a boundary segment. A point contact or a nearby capital does not establish adjacency." },
      ] };
  },
};

/** Specific energy in J/g relative to ice at -20 C. Ideal pure water near 1 atm. */
export function waterState(energy: number) {
  if (!Number.isFinite(energy) || energy < 0 || energy > 3094) throw new Error("water_energy_out_of_range");
  if (energy <= 42) return { temperature: -20 + energy / 2.1, solid: 1, liquid: 0, gas: 0 };
  if (energy <= 376) { const liquid = (energy - 42) / 334; return { temperature: 0, solid: 1 - liquid, liquid, gas: 0 }; }
  if (energy <= 794) return { temperature: (energy - 376) / 4.18, solid: 0, liquid: 1, gas: 0 };
  if (energy <= 3054) { const gas = (energy - 794) / 2260; return { temperature: 100, solid: 0, liquid: 1 - gas, gas }; }
  return { temperature: 100 + (energy - 3054) / 2, solid: 0, liquid: 0, gas: 1 };
}

export function waterVariablesValid(v: Readonly<Record<string, number>>) {
  if (!integer(v.energyJPerG, 0, 3094) || !integer(v.surfaceExchange, 0, 1)) return bad("water_variables_invalid");
  return v.surfaceExchange === 0 || v.energyJPerG > 376 && v.energyJPerG < 794 ? good : bad("surface_exchange_requires_liquid");
}

export function waterPhaseLabel(energy: number): string {
  const s = waterState(energy);
  return s.solid === 1 ? "Ice" : s.solid > 0 ? "Ice and liquid water" : s.gas === 1 ? "Water vapour" : s.gas > 0 ? "Liquid water and vapour" : "Liquid water";
}

/** Schematic surface crossing cycles per second, increasing with liquid temperature.
 * These are teaching rates, not measured molecular evaporation rates.
 */
export function surfaceEscapeRate(energy: number) {
  const s=waterState(energy);
  return s.liquid>0 && s.solid===0 ? 0.12+0.003*s.temperature : 0;
}

export const waterModel: SimulationModel = {
  id: "water-specific-energy-phase-equilibrium", version: "1.0.0", kind: "equation",
  evaluate: ({ variables: v }) => {
    const s = waterState(v.energyJPerG);
    const solidCount = Math.round(s.solid * 24);
    const exchangeCount=surfaceEscapeRate(v.energyJPerG)>0?2:0;
    const gasCount = exchangeCount ? Math.max(exchangeCount,Math.min(23,Math.round(s.gas*24))) : s.gas>0&&s.gas<1 ? Math.max(1,Math.min(23,Math.round(s.gas*24))) : Math.round(s.gas * 24);
    const liquidCount = 24 - solidCount - gasCount;
    const states: SimulationOutput["componentStates"] = {};
    for (let i = 0; i < 24; i++) {
      const solid = i < solidCount, gas = i >= 24 - gasCount;
      const index = solid ? i : gas ? i - (24 - gasCount) : i - solidCount;
      const columns = gas ? 4 : 6;
      const x = gas ? -1.45 + (index % columns) * 0.96 : -1.30 + (index % columns) * 0.52;
      const y = gas ? 1.1 + Math.floor(index / columns) * 0.43 : -0.55 + Math.floor(index / columns) * 0.38;
      const interiorBubble = gas && index===0 && s.gas>0 && s.liquid>0;
      const exchange = gas && index>=gasCount-exchangeCount;
      states[`water-particle-${i}`] = { position: [exchange ? index===0 ? -0.7 : 0.7 : interiorBubble ? 0 : x, exchange ? 0.8 : interiorBubble ? 0.05 : y, 0.12], color: solid ? "#a5f3fc" : "#22d3ee",
        translation: { seed: exchange ? index===gasCount-exchangeCount ? 0 : 5 : interiorBubble ? 0 : i + 1, amplitude: exchange ? [0.12,0.8,0.08] : interiorBubble ? [0.08,0.6,0.02] : gas ? [0.25, 0.25, 0.08] : solid ? [0.025, 0.025, 0.01] : [0.32, 0.18, 0.06], frequency: exchange ? surfaceEscapeRate(v.energyJPerG) : (gas ? 0.25 : solid ? 2 : 0.45) * Math.sqrt((s.temperature + 273.15) / 273.15) } };
    }
    for(let edge=0;edge<4;edge++)states[`vapour-region-edge-${edge}`]={alpha:s.gas>0&&s.liquid>0?1:0,translation:{seed:0,amplitude:[0.08,0.6,0.02],frequency:0.25*Math.sqrt((s.temperature+273.15)/273.15)}};
    return { quantities: { energyJPerG: v.energyJPerG, temperature: s.temperature, solidFraction: s.solid, liquidFraction: s.liquid, vapourFraction: s.gas,
      surfaceEscapeRate:surfaceEscapeRate(v.energyJPerG), particleCount: 24, solidCount, liquidCount, gasCount, mixedMelting: s.solid > 0 && s.liquid > 0 ? 1 : 0, mixedBoiling: s.gas > 0 && s.liquid > 0 ? 1 : 0 },
      flows: {}, componentStates: states, explanation: [
        { id: "state", text: `${waterPhaseLabel(v.energyJPerG)} at ${s.temperature.toFixed(1)} C. All 24 constant-size particles are representative samples; their rounded counts are not literal mass fractions.` },
        { id: "energy", text: s.solid > 0 && s.liquid > 0 ? "During melting/freezing, energy changes the phase balance at 0 C rather than raising temperature." : s.gas > 0 && s.liquid > 0 ? "During boiling/condensation, energy changes the phase balance at 100 C rather than raising temperature." : "Within a single phase, added energy raises temperature. Removing energy reverses this ideal equilibrium sequence." },
        { id: "surface", text: exchangeCount ? "Surface samples escape and rejoin at all liquid temperatures, faster when hotter, including during boiling. Removing heat returns them to the liquid before freezing. Schematic rates and rounded sample counts are not measured mass fractions. Evaporation does not hold temperature constant." : "Evaporation occurs at a liquid surface below boiling. Boiling also forms vapour inside the liquid. The motion is schematic, not measured molecular trajectories." },
        { id: "model", text: "Ideal pure water near 1 atmosphere; rounded heat capacities and latent heats. No supercooling, heat loss or practical measurement skill is simulated." },
      ] };
  },
};

export type FractionStrip = { denominator: number; mask: number };
export function shadedCount(mask: number): number { let count = 0; for (let bits = mask; bits; bits >>>= 1) count += bits & 1; return count; }
export function fractionValue(denominator: number, mask: number): number { return shadedCount(mask) / denominator; }
function gcd(a: number, b: number): number { while (b) [a,b] = [b,a%b]; return a; }
export function commonDenominator(a: number, b: number): number | null { const lcm = a / gcd(a,b) * b; return Number.isInteger(lcm) && lcm >= 1 && lcm <= 24 ? lcm : null; }

export function splitFraction(denominator: number, mask: number, factor: number): FractionStrip | null {
  if (![2,3].includes(factor) || !integer(denominator,1,12) || denominator * factor > 12 || !integer(mask,0,2 ** (2 * denominator) - 1)) return null;
  let next = 0;
  for (let i=0;i<denominator*2;i++) if (mask & 2 ** i) for(let child=0;child<factor;child++) next += 2 ** (i * factor + child);
  return { denominator: denominator * factor, mask: next };
}

export function combineFractions(a: FractionStrip, b: FractionStrip, sign: 1 | -1): FractionStrip | null {
  const denominator = commonDenominator(a.denominator,b.denominator);
  if (!denominator || denominator > 12) return null;
  const numerator = shadedCount(a.mask) * (denominator/a.denominator) + sign * shadedCount(b.mask) * (denominator/b.denominator);
  return integer(numerator,0,denominator*2) ? { denominator, mask:2 ** numerator-1 } : null;
}

export function fractionVariablesValid(v: Readonly<Record<string, number>>) {
  for(const strip of ["A","B"]) {
    const d=v[`den${strip}`];
    if(!integer(d,1,12)||!integer(v[`mask${strip}`],0,2 ** (2*d)-1)||!integer(v[`locked${strip}`],0,1))return bad("fraction_strip_invalid");
  }
  const lcm=commonDenominator(v.denA,v.denB);
  if(!lcm)return bad("common_denominator_exceeds_24");
  if(!integer(v.tickA,0,2*lcm)||!integer(v.tickB,0,2*lcm))return bad("number_line_tick_invalid");
  return integer(v.relation,0,3)&&integer(v.reason,0,3)?good:bad("comparison_response_invalid");
}

export function comparisonFeedback(a: FractionStrip,b: FractionStrip,relation:number,placed:boolean) {
  if(!placed)return {rule:"F4",misconception:null,message:"Count the jumps from 0 for each fraction before you choose."};
  const na=shadedCount(a.mask),nb=shadedCount(b.mask),c=na*b.denominator-nb*a.denominator;
  const expected=c===0?2:c<0?1:3;
  const twelfths=(na===3&&a.denominator===4&&nb===2&&b.denominator===3)||(nb===3&&b.denominator===4&&na===2&&a.denominator===3);
  const check=twelfths?" Check 9/12 and 8/12 on the line.":"";
  if(relation===expected)return {rule:"F1",misconception:null,message:"Correct. Now justify it: name the strategy you used."+check};
  if(c===0)return {rule:"F3",misconception:null,message:"Count the jumps from 0 for each fraction: they land on the same point."};
  if(relation===2)return {rule:"F3",misconception:null,message:"Count the jumps from 0 for each fraction: they do not land on the same point."+check};
  const chosen=relation===3?a:b,other=relation===3?b:a;
  if(chosen.denominator>other.denominator&&shadedCount(chosen.mask)<=shadedCount(other.mask))return {rule:"F2",misconception:"ft07-m2",message:"More parts in the same whole means smaller parts."};
  return {rule:"F3",misconception:null,message:"Count the jumps from 0 for each fraction."+check};
}

export const fractionModel: SimulationModel = {
  id:"exact-two-whole-fraction-manipulatives",version:"1.0.1",kind:"deterministic-rules",
  evaluate:({variables:v})=>{
    const lcm=commonDenominator(v.denA,v.denB)!;
    const numeratorA=shadedCount(v.maskA),numeratorB=shadedCount(v.maskB);
    const valueA=numeratorA/v.denA,valueB=numeratorB/v.denB;
    const expectedRelation=numeratorA*v.denB===numeratorB*v.denA?2:numeratorA*v.denB<numeratorB*v.denA?1:3;
    const placedA=v.lockedA===1&&v.tickA*v.denA===numeratorA*lcm;
    const placedB=v.lockedB===1&&v.tickB*v.denB===numeratorB*lcm;
    const states:SimulationOutput["componentStates"]={};
    for(const strip of ["A","B"])for(let i=0;i<24;i++) {
      const d=v[`den${strip}`], shaded=(v[`mask${strip}`] & 2 ** i)!==0;
      states[`piece-${strip}-${i}`]={alpha:i<2*d?1:0,position:[-4+(i+0.5)*4/d,strip==="A"?1.5:0.3,0],scale:[1.96/d,0.28,0.055],color:shaded?strip==="A"?"#22d3ee":"#fbbf24":"#334155"};
    }
    for(let i=0;i<=48;i++)states[`line-tick-${i}`]={alpha:i<=2*lcm?1:0,position:[-4+i*4/lcm,-0.9,0],scale:[0.015,i%lcm===0?0.16:0.07,0.035]};
    states["marker-A"]={position:[-4+v.tickA*4/lcm,-1.35,0.1]};
    states["marker-B"]={position:[-4+v.tickB*4/lcm,-1.75,0.1]};
    return {quantities:{numeratorA,numeratorB,valueA,valueB,commonDenominator:lcm,placedA:placedA?1:0,placedB:placedB?1:0,
      equivalentHalf:valueA===0.5&&v.denA>=4?1:0,improperFiveQuarters:v.denA===4&&numeratorA===5?1:0,
      comparisonCorrect:placedA&&placedB&&v.relation===expectedRelation&&v.reason===1?1:0},
      flows:{},componentStates:states,explanation:[
        {id:"same-wholes",text:`A is ${numeratorA}/${v.denA}; B is ${numeratorB}/${v.denB}. Each whole has exactly the same length. Two wholes allow values greater than one.`},
        {id:"subdivide",text:"Splitting every selected part preserves its length. Adding/removing pieces changes the amount by exact units; unsupported subdivisions are refused."},
        {id:"line",text:`The common line has ${lcm} intervals per whole. Count jumps from zero; tick marks are not intervals.`},
        {id:"compare",text:(v.lockedA===1&&!placedA)||(v.lockedB===1&&!placedB)?"Count the jumps from 0 for each fraction before you choose.":v.relation===0?"Place both cards, lock them, then compare and justify.":comparisonFeedback({denominator:v.denA,mask:v.maskA},{denominator:v.denB,mask:v.maskB},v.relation,placedA&&placedB).message},
      ]};
  },
};
