import {describe,it,expect} from "vitest";
import {existsSync} from "fs";
import {COUNTIES,CAPITAL_CARDS,capitalFeedback,comparisonFeedback,splitFraction,waterState,waterModel} from "@/lib/interactive-labs/v2/definitions/firstThree/models";
import {waterDefinition} from "@/lib/interactive-labs/v2/definitions/firstThree";
import {initializeLab,acceptLabAction} from "@/lib/interactive-labs/v2/kernel";
import {buildRenderList,instructionalView} from "@/lib/interactive-labs/v2/fidelity/renderList";
import {animatedMatrix} from "@/lib/interactive-labs/v2/fidelity/presentation";

describe("actual V2 lab requirements",()=>{
 it("retains the exact 17 capital cards and trigger-specific placement feedback",()=>{
  expect(CAPITAL_CARDS).toHaveLength(17);expect(new Set(CAPITAL_CARDS).size).toBe(17);
  for(let county=0;county<15;county++)for(let card=1;card<=17;card++){
   const feedback=capitalFeedback(county,card);
   if(card===county+1)expect(feedback).toContain("is its county capital");
   else if(card===16&&COUNTIES[county].id==="nimba")expect(feedback).toContain("Sanniquellie");
   else if(card===17&&COUNTIES[county].id==="montserrado")expect(feedback).toContain("Bensonville");
   else if(card>15)expect(feedback).toBe("A real town, but not a county capital.");
   else if(COUNTIES[county].name.startsWith("Grand ")&&COUNTIES[card-1].name.startsWith("Grand "))expect(feedback).toContain("positions of the Grand counties");
   else expect(feedback).toContain(COUNTIES[card-1].name);
  }
 });
 it("shows conserved constant-radius particles, real surface crossings and hotter faster escape at levels 2, 3 and 4",()=>{
  const counts:number[]=[];
  for(const energy of [481,669,1924]){
   const action=acceptLabAction(waterDefinition,initializeLab(waterDefinition),{type:"set-variables",values:{energyJPerG:energy,surfaceExchange:0}});
   if(!action.ok)throw Error((action as {reason:string}).reason);
   const list=buildRenderList({definition:waterDefinition,state:action.state,profile:"FALLBACK_2D"});
   const particles=list.items.filter(item=>item.id.startsWith("water-particle-"));
   expect(particles).toHaveLength(24);
   let escapes=0;
   for(const p of particles){
    let prior=animatedMatrix(p,0,false)[13];
    const radius=Math.hypot(...p.matrix.slice(0,3));
    for(let frame=1;frame<=1800;frame++){
     const m=animatedMatrix(p,frame/60,false),y=m[13];
     if(prior<=0.8&&y>0.8)escapes++;
     expect(Math.hypot(...m.slice(0,3))).toBeCloseTo(radius,8);
     prior=y;
    }
    expect(animatedMatrix(p,30,true)).toEqual(animatedMatrix(p,0,true));
   }
   counts.push(escapes);
   const output=waterModel.evaluate({placements:{},variables:{energyJPerG:energy,surfaceExchange:0}});
   expect(output.quantities.solidCount+output.quantities.liquidCount+output.quantities.gasCount).toBe(24);
   for(const profile of ["HIGH","STANDARD","LOW"] as const)expect(instructionalView(buildRenderList({definition:waterDefinition,state:action.state,profile}))).toEqual(instructionalView(list));
   expect(output.explanation.map(x=>x.text).join(" ")).toContain("Surface samples escape");
  }
  expect(counts.every(n=>n>0)).toBe(true);expect(counts[1]).toBeGreaterThan(counts[0]);
 });
 it("changes temperature during evaporation and holds only the phase-change plateaux, forward and reverse",()=>{
  expect(waterState(482).temperature).toBeGreaterThan(waterState(481).temperature);
  expect(waterState(670).temperature).toBeGreaterThan(waterState(669).temperature);
  for(const energy of [43,209,375])expect(waterState(energy).temperature).toBe(0);
  for(const energy of [795,1924,3053])expect(waterState(energy).temperature).toBe(100);
  for(let energy=3094;energy>=0;energy--)expect(waterState(energy).solid+waterState(energy).liquid+waterState(energy).gas).toBeCloseTo(1);
 });
 it("preserves the V2 split examples and refuses the 12-part cap cases",()=>{
  expect(splitFraction(2,1,2)).toEqual({denominator:4,mask:3});
  expect(splitFraction(4,3,2)).toEqual({denominator:8,mask:15});
  expect(splitFraction(4,7,2)).toEqual({denominator:8,mask:63});
  expect(splitFraction(3,1,2)).toEqual({denominator:6,mask:3});
  expect(splitFraction(8,1,2)).toBeNull();expect(splitFraction(6,1,3)).toBeNull();
 });
 it("never attributes a misconception to a correct comparison or equal choice, and fires F2 exactly on its trigger",()=>{
  for(let da=2;da<=12;da++)for(let na=1;na<=2*da;na++)for(let db=2;db<=12;db++)for(let nb=1;nb<=2*db;nb++){
   const a={denominator:da,mask:2**na-1},b={denominator:db,mask:2**nb-1},cross=na*db-nb*da;
   const correct=cross===0?2:cross<0?1:3;
   expect(comparisonFeedback(a,b,correct,true).rule).toBe("F1");
   expect(comparisonFeedback(a,b,2,true).misconception).toBeNull();
   for(const relation of [1,3]){
    const chosen=relation===3?[na,da]:[nb,db],other=relation===3?[nb,db]:[na,da];
    const m2=chosen[0]*other[1]<other[0]*chosen[1]&&chosen[1]>other[1]&&chosen[0]<=other[0];
    expect(comparisonFeedback(a,b,relation,true).misconception==="ft07-m2").toBe(m2);
   }
  }
  expect(comparisonFeedback({denominator:4,mask:7},{denominator:3,mask:3},3,false).rule).toBe("F4");
  expect(comparisonFeedback({denominator:4,mask:7},{denominator:3,mask:3},3,true).message).toContain("9/12 and 8/12");
 });
 const referenceFile="C:/restricted-authoring/completed-v2/evidence/ft07-v2-feedback.reference.js";
 it.skipIf(!existsSync(referenceFile))("reproduces the authored ft07-v2 feedback reference for every pair, choice and lock state",()=>{
  const file=referenceFile;
  const reference=require(file) as {feedback:(p:number[],q:number[],choice:string,locked?:{p:boolean;q:boolean})=>{rule:string;misconception:string|null;message:string;check?:string}};
  const strip=(n:number,d:number)=>({denominator:d,mask:2**n-1});
  let cases=0;
  for(let da=1;da<=12;da++)for(let db=1;db<=12;db++)for(let na=0;na<=2*da;na++)for(let nb=0;nb<=2*db;nb++)for(const [relation,choice] of [[1,"q"],[2,"equal"],[3,"p"]] as const)for(const placed of [true,false]){
   const expected=reference.feedback([na,da],[nb,db],choice,{p:placed,q:true}),actual=comparisonFeedback(strip(na,da),strip(nb,db),relation,placed);
   expect({rule:actual.rule,misconception:actual.misconception,message:actual.message}).toEqual({rule:expected.rule,misconception:expected.misconception,message:expected.message+(expected.check?` Check ${expected.check} on the line.`:"")});
   cases++;
  }
  expect(cases).toBeGreaterThan(100000);
 });
});
