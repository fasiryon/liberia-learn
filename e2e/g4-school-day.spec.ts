import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {GRADE4_SCHOOLDAY_ACCEPTED,loadSchooldayPackage} from '../lib/curriculum/v4/schooldayPackage';
import {pilotExperience} from '../lib/curriculum/v4/learningPreview';
import {SCHOOL_DAY_IDS as ids,SCHOOL_DAY_EMAILS as emails,requireSyntheticSchoolDayDatabase,syntheticPasswordForEmail} from '../scripts/e2e/school-day-contract';
import {academicSnapshot,assertKeyboardReach,assertNoExternalCalls,fillReflection,login,performBlock,syntheticDatabase} from './g4-school-day.support';
import {FullDayEvidence} from './g4-full-day-evidence';
import {expectHonestDaySummary,registerDayDisplayChecks} from './g4-day-display.assertions';
import {injectSchoolDayAxe} from './school-day-accessibility';

declare global {interface Window {axe:typeof import('axe-core')}}
requireSyntheticSchoolDayDatabase(process.env);
if(process.env.PLAYWRIGHT_BASE_URL!=='http://127.0.0.1:3100'||process.env.V4_LEARNING_PREVIEW_ENABLED!=='1')
  throw Error('school_day_requires_local_preview_fixture');

const packages=Object.entries(GRADE4_SCHOOLDAY_ACCEPTED).map(([selection,hash])=>{
  const loaded=loadSchooldayPackage(selection);
  expect(loaded.identity.packageHash).toBe(hash);
  return {selection,hash,experience:pilotExperience(loaded.experience,loaded.teachingVersions)};
});
const stops=['guided-products','build-route','model-reading','guided-geography','independent-trace','investigation','fresh-retry','independent-explanation'];
const responses=[
  'SYNTHETIC response: split the multiplier into place values, multiply each part, then add the partial products with matching places.',
  'SYNTHETIC response: nutrients travel through the small intestine wall to the blood. A transfer changes the location, not the total.',
  'SYNTHETIC response: the later garden detail can support or change a prediction; the summary should name the problem, response and result.',
  'SYNTHETIC response: use the supplied coastal and inland observations, distinguish a claim from a detail and do not assume every site is alike.',
  'SYNTHETIC Computing trace: start at 2, add 3 to get 5, then 8, set to 1, then add 3 to get 4. Set replaces the previous value; add changes it.',
  'SUPPLIED SYNTHETIC TEST OBSERVATIONS, not physical measurements: Design 1 closed/open counts 5/5 and 5/5; Design 2 3/5 and 5/5. CALCULATED decrease is 2 closed-light successes. Keep the same battery, lamp and five-trial procedure. INFERRED: the changed contact may be worse; retain the conflicting result. Paper bars are 5 and 3 with a zero baseline and scale to five. These are test fixtures, not observed experimental results.',
  'SYNTHETIC Support retry: I used the Computing variable card. Set replaces the score and add increases it; tracing each instruction distinguishes a stored value from an event.',
  'SYNTHETIC reflection: in the Computing trace I checked set against add, then compared that checking step with using a specific Social Studies observation. One is an instruction trace and the other supplied site evidence. A supported revision is useful; it does not prove mastery. Tomorrow I would check another event order and explain which step changes the result.',
];
// Authored synthetic examples, not evaluated writing, observed experiments or academic evidence.
// Keyed by scene so Support retrieval never substitutes an unrelated period's answer.
const sceneResponses:Readonly<Record<string,string>>={
  '0/guided-products':'143 times 3 is 429. Nine ones stay ones; twelve tens become one hundred and two tens, so the carried 1 represents one hundred. The partial products 300, 120 and 9 total 429.',
  '0/independent-products':'125 times 4 is 500. Twenty ones regroup as two tens. Ten tens regroup as one hundred. The partial products 400, 80 and 20 total 500; the zeros preserve the empty tens and ones places.',
  '0/reading-project':'The 40 times 4 region counts 160 items. Keep 800, 160 and 24 to total 984. Splitting 246 into 240 and 6 gives 960 plus 24, also 984.',
  '1/predict-path':'I predict mouth, food pipe, stomach, small intestine and large intestine. Useful nutrients may cross the small intestine wall into blood. I am uncertain how a paper model can show that crossing.',
  '1/try-transfer':'A token crossing represents a nutrient moving from the small intestine into blood. Paper tokens do not represent actual molecules or the time a real intestine needs.',
  '1/independent-model':'The transferred tokens are on the blood side, and the others remain on the intestine side. The total stays fixed. Paper movement can represent absorption, but not a real digestion time.',
  '1/poster-transfer':'Food follows a connected route beyond the stomach. The small intestine absorbs nutrients into blood; the liver and pancreas support digestion without being places food passes through. Use separate breakdown and crossing symbols and ask a partner to trace them; tokens do not show real molecular change.',
  '2/read-opening':'Massa may put a lid on the tin to protect the spare labels. The names became hard to read after rain, and the lid is nearby. Will the next shower leave the labels clear?',
  '2/construct-summary':'Rain made the garden labels hard to read before seedlings were shared. Massa and the class compared matching labels on a bench and in a sheltered tin. The sheltered label stayed clear twice, so they stored spare labels there. Would prolonged rain change the result?',
  '2/revise-summary':'My first sentence was: Massa may put a lid on the tin. I revise it to: The class kept spare labels in the sheltered tin after two comparisons. The ending supports the sheltered storage result, but does not report that Massa fitted the lid. A soaked sheltered label in a later test would require another revision.',
  '3/guided-geography':'I would need a labelled map of the actual rooms, routes, river and coastline, its key and scale, and local observations. A simplified coastal or inland sketch cannot establish a real route condition.',
  '3/independent-compare':'Club A had a dry covered room during two showers, but its path flooded once. Club B had a clear path during those showers, but its roof leaked. Neither record settles every need. Club A needs a checked route; Club B needs a repaired roof and a prolonged-rain river check.',
  '3/independent-source-check':'A clear path during two showers gives evidence about those two observations only. It does not repair the leaking roof or describe river conditions after prolonged rain.',
  '3/reason-and-revise':'Neither site is ready without conditions. Club A could be considered if an adult confirms an accessible route, including after dark. Its dry room is evidence for storage, but the counterargument about a flooded path remains valid.',
  '3/apply-community':'Does the roof stay dry? Inspect it after rain. Is the route accessible? Ask an adult to check water and lighting. Does the river rise in prolonged rain? Obtain local observations. Another country has different conditions. I revise inland means safe to the route stayed clear during the two supplied showers.',
  '4/predict-score':'With the stated start of two and three points per hit, two hits give eight. The scorekeeper must remember the current score between events instead of restarting the count.',
  '4/independent-trace':responses[4],
  '4/independent-tests':'SYNTHETIC hand traces, not executed code: a new game with no events stays 2; one hit gives 5; reset then hit gives 1 then 4. The predictions match those traces. Two resets then hit still gives 4 and can reveal an incorrect add-instead-of-set reset.',
  '4/debug-reset':'Set score to 0 once at new-game start, then add 2 for each hit. Three hits trace 0, 2, 4, 6. A separate new game starts at 0. Increasing points per hit cannot preserve earlier points if each event first erases them.',
  '4/transfer-game':'My paper game starts score at 2, adds 3 on a hit and sets 1 on reset. Hit then reset gives 2, 5, 1. Reset then hit gives 2, 1, 4. Keep reset as a replacement because the order test distinguishes it from addition. The name score stays fixed while its value changes.',
  '5/define':'Opening the switch separates the contact, breaking the closed path between the battery and lamp. A gap prevents the continuous circuit needed for the lamp to light.',
  '5/design':'Compare two contact arrangements, changing only the contact shape. Keep the battery, lamp and five-trial procedure fixed. I predict a less reliable contact may reduce closed-switch light successes; this is a prediction, not a measured result.',
  '5/build':'I will analyze supplied synthetic browser-fixture counts only, not perform a physical test. Keep the battery, lamp, number of trials and procedure fixed, and compare closed light and open darkness separately.',
  '5/investigation':responses[5],
  '5/refine':responses[5]+' The supplied results do not support an improvement. Repeat with only the contact changed to check whether the difference repeats; keep uncertainty visible.',
  '5/communicate':responses[5]+' Provisionally prefer Design 1 for these supplied cases. For a paper-clip comparison change only the clip, keep the pages and pull procedure fixed, and collect repeated holding results before a conclusion.',
  '6/retrieve-p1':'312 times 3 gives 936: 300 times 3 is 900, 10 times 3 is 30 and 2 times 3 is 6. Adding those place-value quantities gives 936.',
  '6/retrieve-p2':'Mouth, food pipe, stomach, small intestine, large intestine. The small intestine is the main nutrient absorption site. Liver and pancreas support digestion but food does not pass through them. Six of 16 tokens cross; ten remain and six plus ten still totals 16.',
  '6/retrieve-p3':'Rain blurred labels; the class compared a bench label and a sheltered tin label. The sheltered label stayed clear again after another shower. That later detail supports protected storage, but I still ask whether prolonged rain would change it.',
  '6/retrieve-p4':'Club A has supplied dry-room evidence but a flooded path; Club B has a clear path but a leaking roof. Recommend neither without repair or checking. Prolonged-rain and after-dark observations are missing. Coastal describes a physical region; a county label names an administrative area.',
  '6/retrieve-p5':'The variable score starts at 3. Hit adds 2 to give 5, reset replaces it with 1, and hit adds 2 to give 3. The variable name is fixed throughout.',
  '6/retrieve-p6':responses[5]+' An open switch breaks the circuit. These counts are SUPPLIED synthetic data and cannot be presented as my own measured observations.',
  '6/selected-support':responses[6],
  '6/fresh-retry':'I chose P5 Card 1: start score at 2 and add 3. The states are 2 then 5. The value changes while the name score stays fixed. I checked 2 plus 3 independently and distinguished addition from replacing the value.',
  '6/extension':'Counterexample: start score at 7, set score to 2, then add 3. The states 7, 2, 5 show that set does not add two to seven. I would practice a changed event order next.',
  '7/understand-evidence':'The second supplied shower comparison kept the sheltered label clear. That later detail supports revising an untested prediction into a limited recommendation, while leaving prolonged rain uncertain.',
  '7/connect-day':responses[7],
  '7/next-question':'I improve checking proves it works to these supplied traces support the tested event orders. The revised sentence limits the claim. Tomorrow I ask whether reset before a hit changes the result; a separate hand trace for each order would help.',
};
function sceneResponse(period:number,sceneId:string){
  return `SYNTHETIC PRACTICE, not scored: ${sceneResponses[`${period}/${sceneId}`]??responses[period]}`;
}
// Browser traces retain fill arguments. Synthetic passwords stay in memory, never in artifacts.
test.use({trace:'off',video:'off'});

async function accessibility(page:Page,info:TestInfo,label:string){
  await injectSchoolDayAxe(page);
  const violations=await page.evaluate(async()=>{
    const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
    return result.violations.map(({id,impact,nodes})=>({id,impact,targets:nodes.map(node=>node.target)}));
  });
  await info.attach(`axe-${label}`,{body:Buffer.from(JSON.stringify(violations,null,2)),contentType:'application/json'});
  expect(violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
}

test.describe('synthetic authenticated Grade 4 school day',()=>{
  test.describe.configure({mode:'default'}); // A failed student journey must not skip independent role checks.
  test.beforeAll(async()=>{
    const db=syntheticDatabase();
    try{
      expect(await db.user.count({where:{id:{in:[ids.authority,ids.teacher,ids.foreignTeacher,ids.studentUser,ids.admin,'g4-e2e-student-user-2','g4-e2e-student-user-3']}}})).toBe(7);
      expect(await db.student.count({where:{user:{schoolId:ids.school}}})).toBe(3);
      expect(await db.timetable.count({where:{schoolId:ids.school,classId:ids.class}})).toBe(8);
      expect(await db.enrollment.count({where:{studentId:ids.student,classId:ids.class}})).toBe(1);
      expect(await db.policyConfig.count({where:{schoolId:ids.school}})).toBe(9);
      expect(await db.auditLog.count({where:{schoolId:ids.school,action:'V4_PILOT_RELEASE_AUTHORIZED'}})).toBe(8);
      expect(await db.assignment.count({where:{id:'g4-e2e-assignment'}})).toBe(1);
      expect(await db.attendance.count({where:{id:'g4-e2e-attendance'}})).toBe(1);
      const accounts=await db.user.findMany({where:{email:{in:Object.values(emails)}},select:{email:true,hashedPwd:true}});
      expect(accounts.length).toBe(7);
      for(const account of accounts){
        if(!account.hashedPwd)throw Error('synthetic_account_hash_missing');
        expect(await bcrypt.compare(syntheticPasswordForEmail(account.email),account.hashedPwd),'generated seed credentials match stored hashes').toBe(true);
      }
    }finally{await db.$disconnect();}
  });
  test('student completes one continuous authenticated eight-period 66-scene school day',async({page,context},info)=>{
    test.setTimeout(1200000);
    const evidence=new FullDayEvidence(packages);
    const db=syntheticDatabase();
    const externalBrowserRequests:string[]=[];
    page.on('request',request=>{
      const url=new URL(request.url());
      if(['http:','https:'].includes(url.protocol)&&url.origin!=='http://127.0.0.1:3100')externalBrowserRequests.push(url.hostname);
    });
    try{
      const before=await academicSnapshot(db);
      await page.setViewportSize({width:375,height:900});
      const providers=await page.request.get('/api/auth/providers');
      expect(providers.status()).toBe(200);
      const configured=z.record(z.string(),z.unknown()).parse(await providers.json());
      expect(Object.keys(configured).sort()).toEqual(['credentials']);
      const unavailableOAuth=await page.request.get('/api/auth/signin/google',{maxRedirects:0});
      const location=unavailableOAuth.headers().location;
      if(location)expect(new URL(location,'http://127.0.0.1:3100').origin).toBe('http://127.0.0.1:3100');
      const anonymous=z.object({user:z.unknown().optional()}).parse(await(await page.request.get('/api/auth/session')).json());
      expect(anonymous.user).toBeUndefined();
      await login(page,emails.student,'student');
      await page.goto('/learn/day');
      const slots=page.locator('nav[aria-label="Today\'s schedule"] [data-slot]');
      await expect(slots).toHaveCount(8);
      await slots.first().click();
      await accessibility(page,info,'day-375');
      await evidence.screenshot(page,'day-timetable.png');
      for(const [i,pkg] of packages.entries()){
        evidence.activePeriod=i;evidence.activeScene=null;evidence.stage='PERIOD_OPEN';evidence.save();
        // Only P1 is selected by the test. P2-P8 must be selected by CoS's real Finish-return navigation.
        const binding=page.locator('[data-day-lesson]');
        await expect(slots.nth(i)).toHaveAttribute('aria-current','step');
        await expect(page.locator('[data-day-detail]')).toHaveAttribute('data-day-detail',`P${i+1}`);
        await expect(binding).toHaveAttribute('data-day-lesson',pkg.selection);
        await expect(binding).toHaveAttribute('data-package-hash',pkg.hash);
        await expect(binding.locator('[data-day-open]')).toHaveAttribute('href',`/learn/preview/${encodeURIComponent(pkg.selection)}`);
        await binding.locator('[data-day-open]').click();
        await expect(page).toHaveURL(url=>url.pathname===`/learn/preview/${encodeURIComponent(pkg.selection)}`);
        const player=page.locator('[data-lesson-player-v2]');
        await expect(player).toBeVisible();
        await expect(player).toHaveAttribute('data-lesson-id',pkg.experience.id);
        await expect(player).toHaveAttribute('data-lesson-version',pkg.experience.version);
        expect(JSON.parse(await player.getAttribute('data-native-tutor-context')||'null')).toMatchObject({blocked:true});
        const delivered=await page.request.get(`/api/student/learning-preview/${encodeURIComponent(pkg.selection)}`);
        expect(delivered.status()).toBe(200);
        expect(z.object({identity:z.object({selection:z.string(),packageHash:z.string()}),canonicalRecordWrites:z.boolean()}).parse(await delivered.json()))
          .toMatchObject({identity:{selection:pkg.selection,packageHash:pkg.hash},canonicalRecordWrites:false});
        // Leave an unfinished period through the real control, then reopen that same admitted period.
        // This is navigation proof only: MEMORY mode does not promise a saved in-lesson position.
        evidence.stage='UNFINISHED_PERIOD_RETURN';evidence.save();
        await expect(player).toHaveAttribute('data-scene-id',pkg.experience.scenes[0].id);
        const leave=page.getByRole('link',{name:'Leave lesson',exact:true});
        const leaveHref=await leave.getAttribute('href');
        if(!leaveHref)throw Error('unfinished_period_leave_link_missing');
        const leaveTarget=new URL(leaveHref,'http://127.0.0.1:3100');
        expect(leaveTarget.origin).toBe('http://127.0.0.1:3100');expect(leaveTarget.pathname).toBe('/learn/day');
        expect(leaveTarget.searchParams.getAll('at')).toEqual([pkg.selection]);
        expect(leaveTarget.searchParams.getAll('after')).toEqual([]);
        await leave.click();await expect(page).toHaveURL(url=>url.pathname==='/learn/day');
        await expect(page.locator('[data-day-detail]')).toHaveAttribute('data-day-detail',`P${i+1}`);
        await expect(slots.nth(i)).toHaveAttribute('aria-current','step');
        await expect(binding).toHaveAttribute('data-day-lesson',pkg.selection);
        await expect(binding).toHaveAttribute('data-package-hash',pkg.hash);
        await binding.locator('[data-day-open]').click();
        await expect(player).toHaveAttribute('data-lesson-id',pkg.experience.id);
        await expect(player).toHaveAttribute('data-scene-id',pkg.experience.scenes[0].id);
        evidence.periods[i].leaveReturn={status:'PASS',reason:'LEAVE_REOPENED_SAME_UNFINISHED_ADMITTED_PERIOD'};evidence.save();
        for(const [j,scene] of pkg.experience.scenes.entries()){
          evidence.activeScene=j;evidence.stage='SCENE_IDENTITY';evidence.save();
          await expect(player).toHaveAttribute('data-scene-id',scene.id);
          await expect(player).toHaveAttribute('data-scene-type',scene.type);
          await expect(page.locator('#scene-title')).toHaveText(scene.title);
          if(i===7&&j===0){
            // Preserve the existing bounded in-memory offline check without leaving the continuous day.
            await context.setOffline(true);
            await expect(page.getByText(/Offline access ends at/)).toBeVisible();
            await expect(player).toHaveAttribute('data-scene-id',scene.id);
            await context.setOffline(false);
            await expect(page.getByText(/Offline access ends at/)).toHaveCount(0);
          }
          evidence.stage='REQUIRED_SCENE_ACTIVITY_AND_FEEDBACK';
          if(i===6&&scene.id==='selected-support'){
            for(let card=1;card<=6;card++){
              await expect(page.locator(`[data-reading-passage=card-p${card}]`)).toContainText('A mistake to check:');
              await expect(page.locator(`[data-reading-passage=card-p${card}]`)).toContainText('Better idea:');
            }
          }
          if(i===5&&scene.id==='investigation')await expect(page.locator('.ll3-scene-text')).toContainText('draw two labelled bars');
          const control=page.getByRole('button',{name:j===pkg.experience.scenes.length-1?'Finish':'Continue',exact:true});
          if(scene.interaction.kind==='FREE_RESPONSE')await expect(control).toBeDisabled();
          for(const block of [...(scene.teaching?.blocks??[]),...(scene.teaching?.visual?[scene.teaching.visual]:[])]){
            evidence.stage=`ACTIVITY:${block.type}:${'id' in block?block.id:'no-id'}`;evidence.save();
            await performBlock(page,block);
          }
          evidence.stage='WRITTEN_RESPONSE_AND_COMPLETION';
          await fillReflection(page,scene,sceneResponse(i,scene.id));
          if(scene.id===stops[i])await accessibility(page,info,`P${i+1}-${scene.id}`);
          await expect(control,`${pkg.selection} / ${scene.id} actual required controls`).toBeEnabled();
          if(j===pkg.experience.scenes.length-1){
            evidence.stage='FINISH';
            await expect(player).toHaveAttribute('data-scene-type','REVIEW');
            await expect(page.getByText('No graded assessment is available in this pilot.',{exact:false})).toBeVisible();
            await control.click();
            await expect(page.locator('[data-finish-state=PILOT_ONLY]')).toContainText('Nothing was saved, submitted or graded.');
            await expect(page.getByRole('button',{name:'Finished',exact:true})).toBeDisabled();
            evidence.periods[i].finish={status:'PASS',reason:'PILOT_ONLY_UNGRADED_FINISH_OBSERVED'};
            await evidence.captureScene(page);
          }else{
            await evidence.captureScene(page);
            evidence.stage='SCENE_ADVANCE';
            await control.click();
            await expect(player).toHaveAttribute('data-scene-id',pkg.experience.scenes[j+1].id);
          }
          evidence.scenePassed();
        }
        evidence.stage='PERIOD_TRANSITION';evidence.save();
        const back=page.locator('[data-finish-return=school-day]');
        await expect(back).toHaveText('Back to my school day');
        await expect(back).toBeVisible();
        const href=await back.getAttribute('href');
        if(!href)throw Error('INCOMPLETE:missing_day_return_control');
        const target=new URL(href,'http://127.0.0.1:3100');
        expect(target.origin).toBe('http://127.0.0.1:3100');expect(target.pathname).toBe('/learn/day');
        expect(target.searchParams.getAll('after')).toEqual([pkg.selection]);
        await back.click();await expect(page).toHaveURL(url=>url.pathname==='/learn/day');
        const nextPkg=packages[i+1];
        if(nextPkg){
          await expect(page.locator('[data-day-lesson]')).toHaveAttribute('data-day-lesson',nextPkg.selection);
          await expect(page.locator('[data-day-lesson]')).toHaveAttribute('data-package-hash',nextPkg.hash);
          await expect(slots.nth(i+1)).toHaveAttribute('aria-current','step');
          await expect(page.locator('[data-day-detail]')).toHaveAttribute('data-day-detail',`P${i+2}`);
        }else{
          await expect(page.locator('[data-day-detail]')).toHaveAttribute('data-day-detail','P8');
          await expect(page.locator('[data-day-end]')).toBeVisible();
          await page.locator('[data-day-end]').click();
          const summary=page.locator('[data-day-end-summary]');await expect(summary).toBeVisible();
          await expectHonestDaySummary(page,8);
          await summary.getByRole('textbox').fill('SYNTHETIC reflection: a revised trace and a supplied site observation support different claims. Tomorrow I would test another event order.');
          await expect(summary).toContainText('Your reflection stays on this screen only. It is not saved or sent.');
          await evidence.screenshot(page,'day-end.png');
        }
        evidence.periods[i].transition={status:'PASS',reason:nextPkg?'RETURN_CONTROL_SELECTED_NEXT_ADMITTED_PERIOD':'RETURN_CONTROL_AND_END_MY_DAY_OBSERVED'};
        evidence.periodPassed();
      }
      expect(evidence.periods.every(p=>p.status==='PASS'&&p.scenes.every(s=>s.status==='PASS'))).toBe(true);
      evidence.stage='DAY_ISOLATION_AND_RECORDS';
      expect(externalBrowserRequests).toEqual([]);
      assertNoExternalCalls();
      expect(await academicSnapshot(db)).toEqual(before);
      evidence.dayChecks={status:'PASS',reason:'NO_EXTERNAL_CALLS_AND_PROTECTED_RECORDS_UNCHANGED'};evidence.save();
      await info.attach('protected-records-unchanged',{body:Buffer.from(JSON.stringify(before,null,2)),contentType:'application/json'});
    }catch(error){
      evidence.fail();
      await evidence.captureFailureScene(page).catch(()=>{}); // Preserve the original failure even if capture is unavailable.
      throw error;
    }finally{
      await evidence.attach(info);await context.setOffline(false);await db.$disconnect();
    }
  });

  test('school admin can inspect synthetic school, roster, placement and record selectors without decisions',async({page},info)=>{
    const db=syntheticDatabase(),before=await academicSnapshot(db);
    try{
      await login(page,emails.admin,'admin');
      const session=await page.request.get('/api/auth/session');
      expect(await session.json()).toMatchObject({user:{role:'ADMIN',schoolId:ids.school,isPlatformAdmin:false}});
      await page.goto('/admin');
      await expect(page.getByRole('heading',{level:1,name:"Good morning. Here's your school today.",exact:true})).toBeVisible();
      const roster=await page.request.get('/api/admin/students');expect(roster.status()).toBe(200);
      const students=z.object({students:z.array(z.object({id:z.string()}))}).parse(await roster.json());
      expect(students.students.map(student=>student.id).sort()).toEqual([ids.student,'g4-e2e-student-2','g4-e2e-student-3'].sort());
      await page.goto('/admin/placements');
      const placements=await page.request.get('/api/admin/placements');expect(placements.status()).toBe(200);
      expect(z.object({placements:z.array(z.unknown())}).parse(await placements.json()).placements).toEqual([]);
      await page.goto('/admin/report-cards');
      const records=await page.request.get('/api/admin/report-cards');expect(records.status()).toBe(200);
      const selectors=z.object({classes:z.array(z.object({id:z.string()})),academicYears:z.array(z.unknown())}).parse(await records.json());
      expect(selectors.classes.map(item=>item.id)).toEqual([ids.class]);
      expect(selectors.academicYears).toEqual([]); // Do not fabricate official records for a demo.
      expect(await academicSnapshot(db)).toEqual(before);assertNoExternalCalls();
      await info.attach('admin-readonly-journey',{body:Buffer.from(JSON.stringify({role:'school ADMIN',students:3,placements:0,officialRecordsCreated:0})),contentType:'application/json'});
    }finally{await db.$disconnect();}
  });

  test('class teacher sees the schedule and advisory authority; foreign teacher is concealed',async({browser},info)=>{
    const db=syntheticDatabase(),before=await academicSnapshot(db);
    const teacher=await browser.newContext(),foreign=await browser.newContext();
    try{
      const page=await teacher.newPage();await login(page,emails.teacher,'teacher');
      await page.goto('/teacher/schedule');
      const schedule=await page.request.get('/api/teacher/schedule');
      expect(schedule.status()).toBe(200);
      const data=z.object({classes:z.array(z.object({id:z.string()})),timetable:z.array(z.object({id:z.string(),classId:z.string()}))}).parse(await schedule.json());
      expect(data.classes.some(c=>c.id===ids.class)).toBe(true);
      expect(data.timetable.filter(t=>t.classId===ids.class).map(t=>t.id).sort()).toEqual(Array.from({length:8},(_,i)=>`g4-e2e-period-${i+1}`));
      for(let i=1;i<=8;i++)await expect(page.getByText(new RegExp(`^P${i} - `)).first()).toBeVisible();
      const path=`/api/teacher/learning-authority/grade4-math/misconceptions?studentId=${ids.student}`;
      const advisory=await page.request.get(path);expect(advisory.status()).toBe(200);
      expect(await advisory.json()).toMatchObject({studentId:ids.student});
      const foreignPage=await foreign.newPage();await login(foreignPage,emails.foreignTeacher,'teacher');
      const denied=await foreignPage.request.get(path),missing=await foreignPage.request.get('/api/teacher/learning-authority/grade4-math/misconceptions?studentId=g4-e2e-missing');
      expect(denied.status()).toBe(404);expect(missing.status()).toBe(404);
      expect(await denied.json()).toEqual(await missing.json());
      expect((await foreignPage.request.get(`/api/teacher/attendance?classId=${ids.class}`)).status()).toBe(403);
      expect(await academicSnapshot(db)).toEqual(before);assertNoExternalCalls();
      await info.attach('teacher-student-work-visibility',{body:Buffer.from(JSON.stringify({status:'INCOMPLETE',reason:'NOT_IMPLEMENTED_ON_THIS_MEMORY_ONLY_BASELINE',durableStudentEvidenceVerified:false})),contentType:'application/json'});
      await info.attach('teacher-authority-checks',{body:Buffer.from(JSON.stringify({schedule:200,advisory:200,foreignAdvisory:404,missing:404,foreignAttendance:403})),contentType:'application/json'});
    }finally{await teacher.close();await foreign.close();await db.$disconnect();}
  });

  for(const width of [320,375,768])test(`keyboard and axe at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await login(page,emails.student,'student');await page.goto('/learn/day');
    const first=page.locator('nav[aria-label="Today\'s schedule"] [data-slot]').first();
    await assertKeyboardReach(page,first,info,`day-slot-${width}`);await page.keyboard.press('Enter');
    await expect(page.locator('[data-day-lesson]')).toHaveAttribute('data-package-hash',packages[0].hash);
    await accessibility(page,info,`day-${width}`);
    await assertKeyboardReach(page,page.locator('[data-day-open]'),info,`day-open-${width}`);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lesson-player-v2]')).toBeVisible();
    const next=page.getByRole('button',{name:'Continue',exact:true});
    await accessibility(page,info,`lesson-${width}`);
    await assertKeyboardReach(page,next,info,`lesson-continue-${width}`);
    await page.keyboard.press('Enter');
    const workedScene=packages[0].experience.scenes[1];
    await expect(page.locator('#scene-title')).toHaveText(workedScene.title);
    const worked=workedScene.teaching?.blocks?.find(block=>block.type==='WORKED_SOLUTION');
    if(!worked||worked.type!=='WORKED_SOLUTION')throw Error('school_day_keyboard_worked_activity_missing');
    const activity=page.locator(`[data-worked-solution="${worked.id}"]`);
    for(let i=0;i<worked.steps.length;i++){
      const reveal=activity.getByRole('button',{name:/Start the solution|Show step/});
      await assertKeyboardReach(page,reveal,info,`worked-step-${width}-${i}`);
      await page.keyboard.press(i===0?'Space':'Enter');
      await expect(activity).toContainText(worked.steps[i].text);
    }
    await expect(activity.getByText('All steps shown')).toBeVisible();
    await expect(next).toBeEnabled();
    await accessibility(page,info,`worked-${width}`);
    assertNoExternalCalls();
  });
});

registerDayDisplayChecks();
