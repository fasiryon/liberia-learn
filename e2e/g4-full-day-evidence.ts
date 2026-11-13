import {expect,type Page,type TestInfo} from '@playwright/test';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import type {LessonExperience} from '../lib/learner-experience/types';

type Status='PASS'|'FAIL'|'INCOMPLETE';
type Check={status:Status;reason:string};
type SceneResult=Check&{id:string;index:number;interaction:string;requiredActivities:string[];screenshot:string|null;screenshotSha256:string|null};
type Package=Readonly<{selection:string;hash:string;experience:LessonExperience}>;

/** Browser observations only. No student response bodies, credentials, DOM dumps or raw errors. */
export class FullDayEvidence {
  readonly source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  readonly periods;
  readonly capabilities={
    durableStudentEvidence:{status:'INCOMPLETE',reason:'MEMORY_ONLY_NOT_DURABLE_EVIDENCE'},
    teacherWorkVisibility:{status:'INCOMPLETE',reason:'NOT_IMPLEMENTED_ON_THIS_BASELINE'},
    physicalEngineeringTest:{status:'INCOMPLETE',reason:'SYNTHETIC_SUPPLIED_COUNTS_NOT_PHYSICAL_OBSERVATIONS'},
    executableLab:{status:'INCOMPLETE',reason:'NO_EXECUTABLE_LAB_IN_PINNED_PACKAGES'},
  } satisfies Record<string,Check>;
  readonly directory:string;
  dayChecks:Check={status:'INCOMPLETE',reason:'ISOLATION_AND_PROTECTED_RECORD_CHECKS_NOT_FINISHED'};
  activePeriod=0;
  activeScene:number|null=null;
  stage='AUTHENTICATION';

  constructor(packages:readonly Package[]){
    expect(this.source).toMatch(/^[a-f0-9]{40}$/);
    if(process.env.SOURCE_SHA)expect(process.env.SOURCE_SHA).toBe(this.source);
    expect(packages).toHaveLength(8);
    expect(packages.map(p=>p.experience.scenes.length)).toEqual([8,8,8,9,10,8,10,5]);
    this.periods=packages.map((pkg,index)=>({
      period:`P${index+1}`,selection:pkg.selection,packageHash:pkg.hash,
      status:'INCOMPLETE' as Status,reason:'NOT_REACHED',
      finish:{status:'INCOMPLETE' as Status,reason:'NOT_REACHED'},
      leaveReturn:{status:'INCOMPLETE' as Status,reason:'NOT_REACHED'},
      transition:{status:'INCOMPLETE' as Status,reason:'NOT_REACHED'},
      scenes:pkg.experience.scenes.map((scene,i):SceneResult=>({id:scene.id,index:i+1,interaction:scene.interaction.kind,requiredActivities:[...(scene.teaching?.blocks??[]),...(scene.teaching?.visual?[scene.teaching.visual]:[])].map(b=>`${b.type}:${'id' in b?b.id:'no-id'}`),status:'INCOMPLETE',reason:'NOT_REACHED',screenshot:null,screenshotSha256:null})),
    }));
    const root=resolve('artifacts/g4-e2e/full-day-gallery');
    mkdirSync(root,{recursive:true});
    if(lstatSync(root).isSymbolicLink())throw Error('gallery_root_redirected');
    this.directory=mkdtempSync(join(root,'run-'));
    this.save();
  }

  save(){
    const totals={PASS:0,FAIL:0,INCOMPLETE:0};
    for(const p of this.periods)for(const s of p.scenes)totals[s.status]++;
    writeFileSync(join(this.directory,'results.json'),JSON.stringify({
      schema:'g4-full-day-browser/1',source:this.source,
      scope:'CONTINUOUS_AUTHENTICATED_SYNTHETIC_UI_JOURNEY',
      progressStorage:'MEMORY',durableEvidenceClaimed:false,
      capabilities:this.capabilities,dayChecks:this.dayChecks,totals,periods:this.periods,
      active:{period:this.activePeriod+1,scene:this.activeScene===null?null:this.periods[this.activePeriod].scenes[this.activeScene].id,stage:this.stage},
    },null,2)+'\n');
  }

  async screenshot(page:Page,name:string){
    if(!/^(?:p[1-8]-s[0-9]{2}|day-timetable|day-end)\.png$/.test(name))throw Error('gallery_name_invalid');
    const url=new URL(page.url());
    expect(url.origin).toBe('http://127.0.0.1:3100');
    expect(url.pathname.startsWith('/learn/')).toBe(true);
    // Crop to the known synthetic learning surface. Never capture login or browser chrome.
    const surface=page.locator(name.startsWith('p')?'[data-lesson-player-v2]':'[data-school-day]');
    await expect(surface).toBeVisible();
    const image=await surface.screenshot({animations:'disabled',timeout:15000});
    writeFileSync(join(this.directory,name),image,{flag:'wx'});
    return createHash('sha256').update(image).digest('hex');
  }

  async captureScene(page:Page){
    if(this.activeScene===null)throw Error('gallery_scene_missing');
    const result=this.periods[this.activePeriod].scenes[this.activeScene];
    const name=`p${this.activePeriod+1}-s${String(result.index).padStart(2,'0')}.png`;
    result.screenshotSha256=await this.screenshot(page,name);
    result.screenshot=name;this.save();
  }

  scenePassed(){
    if(this.activeScene===null)throw Error('gallery_scene_missing');
    const result=this.periods[this.activePeriod].scenes[this.activeScene];
    result.status='PASS';result.reason='REQUIRED_UI_ACTIONS_FEEDBACK_AND_ADVANCE_OBSERVED';
    this.activeScene=null;this.save();
  }

  periodPassed(){
    const period=this.periods[this.activePeriod];
    if(period.leaveReturn.status!=='PASS')throw Error('unfinished_period_return_not_verified');
    if(period.scenes.some(s=>s.status!=='PASS')||period.finish.status!=='PASS'||period.transition.status!=='PASS')
      throw Error('period_scene_or_finish_not_verified');
    period.status='PASS';period.reason='ALL_SCENES_FINISH_LEAVE_AND_NEXT_PERIOD_UI_OBSERVED';this.save();
  }

  async captureFailureScene(page:Page){
    if(this.activeScene===null)return;
    const scene=this.periods[this.activePeriod].scenes[this.activeScene];
    if(scene.screenshot)return;
    const player=page.locator('[data-lesson-player-v2]');
    if(await player.count()===1&&await player.getAttribute('data-scene-id')===scene.id)
      await this.captureScene(page);
  }

  fail(){
    if(this.stage==='DAY_ISOLATION_AND_RECORDS'){
      this.dayChecks={status:'FAIL',reason:this.stage};this.save();return;
    }
    const period=this.periods[this.activePeriod];
    period.status='FAIL';period.reason=this.stage;
    if(this.activeScene!==null){
      const scene=period.scenes[this.activeScene];scene.status='FAIL';scene.reason=this.stage;
    }
    if(this.stage==='UNFINISHED_PERIOD_RETURN')period.leaveReturn={status:'FAIL',reason:'LEAVE_DID_NOT_REOPEN_SAME_UNFINISHED_PERIOD'};
    if(this.stage==='FINISH')period.finish={status:'FAIL',reason:'PILOT_FINISH_NOT_OBSERVED'};
    if(this.stage==='PERIOD_TRANSITION'){
      period.transition={status:'FAIL',reason:'RETURN_OR_NEXT_PERIOD_SELECTION_FAILED'};
    }
    this.save();
  }

  async attach(info:TestInfo){
    this.save();
    await info.attach('g4-full-day-results',{path:join(this.directory,'results.json'),contentType:'application/json'});
    // CoS retains this fixed synthetic gallery directory; the old axe reporter does not copy it.
  }
}
