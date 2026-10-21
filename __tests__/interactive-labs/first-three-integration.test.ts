import {describe,it,expect} from 'vitest';
import {firstThreeDefinitions,waterDefinition,fractionsDefinition} from '@/lib/interactive-labs/v2/definitions/firstThree';
import {initializeLab,acceptLabAction} from '@/lib/interactive-labs/v2/kernel';
import {buildRenderList,instructionalView} from '@/lib/interactive-labs/v2/fidelity/renderList';
import {validateHighFidelityDefinition} from '@/lib/interactive-labs/v2/fidelity/boundary';
import {buildParametricGeometry} from '@/lib/interactive-labs/v2/fidelity/geometry/builders';
import {waterModel} from '@/lib/interactive-labs/v2/definitions/firstThree/models';
import {resolveAuthoredRuntime} from '@/lib/content-factory/v2/runtimeBindings';

describe('First-three DRAFT integration boundaries',()=>{
 it('retains draft governance and equivalent instructional state on all renderers',()=>{
  for(const d of firstThreeDefinitions){expect(d.reviewState).toBe('DRAFT');expect(d.approvalState).toBe('PENDING');expect(validateHighFidelityDefinition(d)).toEqual([]);const state=initializeLab(d),high=instructionalView(buildRenderList({definition:d,state,profile:'HIGH'}));
   for(const profile of ['STANDARD','LOW','FALLBACK_2D'] as const)expect(instructionalView(buildRenderList({definition:d,state,profile}))).toEqual(high);
   for(const c of d.fidelity!.components)if(c.geometryVariants)expect(buildParametricGeometry(c.geometryVariants.HIGH as Parameters<typeof buildParametricGeometry>[0],'HIGH').triangles).toBeGreaterThan(0);
  }
 });
 it('starts independent work afresh and rejects coaching escape/reset through the kernel',()=>{
  for(const d of firstThreeDefinitions){const result=acceptLabAction(d,initializeLab(d),{type:'mode',mode:'ASSESSMENT'});expect(result.ok).toBe(true);if(!result.ok)throw Error('assessment_start_failed');expect(result.state.completedChecks).toEqual([]);expect(acceptLabAction(d,result.state,{type:'mode',mode:'EXPLORE'}).ok).toBe(false);expect(acceptLabAction(d,result.state,{type:'reset'}).ok).toBe(false);}
 });
 it('rejects illegal surface exchange and retains exactly 24 representative particles',()=>{
  expect(acceptLabAction(waterDefinition,initializeLab(waterDefinition),{type:'set-variables',values:{energyJPerG:1000,surfaceExchange:1}}).ok).toBe(false);
  for(const energyJPerG of [0,209,585,710,795,1924,3054,3094]){const s=waterModel.evaluate({placements:{},variables:{energyJPerG,surfaceExchange:energyJPerG===710?1:0}});expect(Object.keys(s.componentStates).filter(id=>id.startsWith('water-particle-'))).toHaveLength(24);expect(s.quantities.solidCount+s.quantities.liquidCount+s.quantities.gasCount).toBe(24);expect(s.componentStates['vapour-region-edge-0'].alpha).toBe(energyJPerG>794&&energyJPerG<3054?1:0);}
 });
 it('requires literal quarters for the five-quarters task',()=>{
  const state=initializeLab(fractionsDefinition);const result=acceptLabAction(fractionsDefinition,state,{type:'set-variables',values:{denA:8,maskA:1023}});expect(result.ok).toBe(true);if(!result.ok)throw Error('fraction_patch_failed');expect(buildRenderList({definition:fractionsDefinition,state:result.state,profile:'LOW'}).quantities.improperFiveQuarters).toBe(0);
 });
 it('never resolves an unknown package from a claimed first-three identity',()=>{expect(resolveAuthoredRuntime({source:{contentId:'wk_mca7a_fri_p4'}} as never)).toBeNull();});
});
