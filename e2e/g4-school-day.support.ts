import {test,expect,type Page} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Scene} from '../lib/learner-experience/types';
import {syntheticPasswordForEmail,requireSyntheticSchoolDayDatabase} from '../scripts/e2e/school-day-contract';

export function syntheticDatabase(){
  return new PrismaClient({datasources:{db:{url:requireSyntheticSchoolDayDatabase(process.env)}}});
}
export async function academicSnapshot(db:PrismaClient){
  const tables=await db.$queryRaw<Array<{name:string}>>`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const protectedTables=tables.filter(({name})=>/mastery|grade|progress|attempt|assessment|reportcard|placement|override|transcript|enrollment|submission|tokenusage|^(ai|agent|tutor|attendance|assignment)/i.test(name));
  if(!protectedTables.some(({name})=>name==='Grade')||!protectedTables.some(({name})=>name==='Enrollment'))throw Error('school_day_snapshot_schema_missing');
  const records:Record<string,unknown>={};
  for(const {name} of protectedTables){
    if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name))throw Error('invalid_snapshot_identifier');
    // The identifier is validated catalog metadata, never user input. Capture updates as well as inserts.
    records[name]=await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS digest FROM "${name}" t`);
  }
  records.officialAudit=await db.$queryRaw`SELECT count(*)::int AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]')) AS digest FROM "AuditLog" t WHERE action ~* '(GRADE|MASTERY|REPORT_CARD|PROMOT|GRADUAT|PLACEMENT|OVERRIDE|TRANSCRIPT|ENROLL|ASSESS|ACADEMIC|DECISION)'`;
  return records;
}
export function assertNoExternalCalls(){
  const run=process.env.GITHUB_RUN_ID||'synthetic';
  const marker=resolve(`artifacts/g4-e2e/egress-guard-${run}.json`);
  expect(existsSync(marker),'server outbound guard must be active').toBe(true);
  expect(JSON.parse(readFileSync(marker,'utf8'))).toMatchObject({syntheticOnly:true,guard:'fetch-http-https',runId:run});
  const attempts=resolve(`artifacts/g4-e2e/egress-attempts-${run}.jsonl`);
  expect(existsSync(attempts)?readFileSync(attempts,'utf8'):'','no attempted provider or other external HTTP request').toBe('');
}
export async function login(page:Page,email:string,role:'student'|'teacher'|'admin'){
  await page.goto(`/login?role=${role}`);
  if(role==='student'){
    // Confirm a real hydrated interaction, then return to the email/password mode.
    await page.getByRole('button',{name:'Use Student ID instead',exact:true}).click();
    await expect(page.getByPlaceholder('Student ID (e.g. LBR-2024-001)',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Use email instead',exact:true}).click();
  }
  const identifier=page.getByPlaceholder(role==='student'?'student@school.lr':role==='teacher'?'teacher@school.lr':'admin@school.lr',{exact:true});
  await expect(identifier).toBeVisible();await identifier.fill(email);
  const passwordField=page.locator('form input[type=password]');
  try{
    try{await passwordField.fill(syntheticPasswordForEmail(email));}
    catch{throw Error('synthetic_signin_password_input_failed');}
    const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/callback/credentials'&&response.request().method()==='POST');
    await page.locator('form button[type=submit]').click();
    const response=await responsePromise;
    let code:string|null=null;
    try{
      const result:unknown=await response.json();
      if(result&&typeof result==='object'&&'url' in result&&typeof result.url==='string'){
        const error=new URL(result.url,'http://127.0.0.1:3100').searchParams.get('error');
        code=error&&/^[A-Za-z0-9_-]{1,80}$/.test(error)?error:null;
      }
    }catch{/* Record status without persisting arbitrary response bodies or cookies. */}
    await test.info().attach(`signin-${role}`,{body:Buffer.from(JSON.stringify({role,status:response.status(),errorCode:code})),contentType:'application/json'});
    expect(response.ok(),'credentials provider must accept the synthetic sign-in').toBe(true);
    expect(code).toBeNull();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  }finally{
    // Keep automatic failure DOM snapshots free of password-field values.
    if(await passwordField.count())await passwordField.fill('').catch(()=>{});
  }
  const response=await page.request.get('/api/auth/session');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({user:{email,role:role.toUpperCase()}});
}

type Block=NonNullable<Scene['teaching']>['blocks'][number];
export async function performBlock(page:Page,block:Block){
  switch(block.type){
    case 'CHECK':{
      const scope=page.locator(`[data-choice-check="${block.id}"]`);
      for(const item of block.items){
        const question=scope.locator(`[data-practice="${item.id}"]`);
        const right=item.options.findIndex(option=>option.id===item.formativeKey.expectedOptionId);
        expect(right).toBeGreaterThanOrEqual(0);
        const wrong=(right+1)%item.options.length;
        await question.getByRole('radio').nth(wrong).check();
        await expect(question.locator('[data-result=retry]')).toBeVisible();
        const correct=question.getByRole('radio').nth(right);
        await correct.focus();await correct.press('Space');
        await expect(correct).toBeChecked();
        await expect(question.locator('[data-result=right]')).toBeVisible();
        const feedback=item.options[right].feedback.split(/\$[^$]*\$/).sort((a,b)=>b.length-a.length)[0].trim();
        if(feedback)await expect(question.locator('[data-result=right]')).toContainText(feedback);
      }
      break;
    }
    case 'WORKED_SOLUTION':{
      const scope=page.locator(`[data-worked-solution="${block.id}"]`);
      for(let i=0;i<block.steps.length;i++){
        await scope.getByRole('button',{name:/Start the solution|Show step/}).click();
        await expect(scope.locator('.ll5-steps > li')).toHaveCount(i+1);
      }
      await expect(scope.getByText('All steps shown')).toBeVisible();break;
    }
    case 'STEP_REVEAL':{
      const scope=page.locator(`[data-step-reveal="${block.id}"]`);
      for(let i=0;i<block.steps.length;i++){
        await scope.getByRole('button',{name:/Show step/}).click();
        await expect(scope.locator('.ll3-steps > li')).toHaveCount(i+1);
      }
      await expect(scope.getByText('All steps shown')).toBeVisible();break;
    }
    case 'NUMERIC_RESPONSE':{
      const scope=page.locator(`[data-numeric-response="${block.id}"]`);
      let unitIndex=0;
      for(const [i,part] of block.parts.entries()){
        await scope.locator('input').nth(i).fill(String(Number(part.formativeKey.value)+1000));
        if(part.unit.kind!=='NONE')await scope.getByRole('combobox').nth(unitIndex++).selectOption(part.unit.base);
      }
      await scope.getByRole('button',{name:/^Check answer/}).click();
      await expect(scope.locator('.ll5-answer[data-result=retry]')).toHaveCount(block.parts.length);
      for(const [i,part] of block.parts.entries())await scope.locator('input').nth(i).fill(String(part.formativeKey.value));
      await scope.getByRole('button',{name:/^Check answer/}).click();
      await expect(scope.locator('.ll5-answer[data-result=right]')).toHaveCount(block.parts.length);
      await expect(scope.locator('.ll5-solution')).toBeVisible();break;
    }
    case 'SORT':{
      const scope=page.locator(`[data-sort="${block.id}"]`);
      for(const card of block.cards){
        await scope.getByRole('button',{name:card.text,exact:true}).click();
        const group=block.groups.find(group=>group.id===card.group);
        if(!group)throw Error('sort_fixture_group_missing');
        await scope.getByRole('region',{name:group.label,exact:true}).getByRole('button',{name:/^Put/}).click();
      }
      await expect(scope.getByText('All sorted.',{exact:false})).toBeVisible();break;
    }
    case 'SEQUENCE':{
      const scope=page.locator(`[data-sequence="${block.id}"]`);
      for(const [target,event] of block.events.entries()){
        const row=scope.locator('.ll4-order > li').filter({hasText:event.label});
        for(let move=0;move<block.events.length;move++){
          const index=await row.evaluate(node=>Array.from(node.parentElement?.children??[]).indexOf(node));
          if(index===target)break;
          expect(index).toBeGreaterThan(target);
          await row.getByRole('button',{name:/up$/}).click();
        }
      }
      await scope.getByRole('button',{name:'Check the order',exact:true}).click();
      await expect(scope.locator('[data-result=right]')).toBeVisible();break;
    }
    case 'SOURCE_EVIDENCE':{
      const scope=page.locator(`[data-source-evidence="${block.id}"]`);
      for(const [i,sentence] of block.sentences.entries())if(sentence.supports)await scope.locator('.ll5-sentence').nth(i).click();
      await scope.getByRole('button',{name:/^Check/}).click();
      await expect(scope.locator('[data-result=right]').last()).toBeVisible();break;
    }
    case 'DESIGN_CYCLE':await testBothDesigns(page);break;
    case 'MISTAKE_ANALYSIS':{
      const scope=page.locator(`[data-mistake-analysis="${block.id}"]`);
      const right=block.options.findIndex(option=>option.id===block.formativeKey.expectedOptionId);
      expect(right).toBeGreaterThanOrEqual(0);
      await scope.getByRole('radio').nth((right+1)%block.options.length).check();
      await expect(scope.locator('[data-result=retry]')).toBeVisible();
      await scope.getByRole('radio').nth(right).check();
      await expect(scope.locator('[data-result=right]')).toBeVisible();
      await expect(scope.locator('.ll5-solution-steps > li')).toHaveCount(block.correction.length);break;
    }
    case 'AREA_MODEL':{
      if(block.mode!=='SHOW')throw Error('UNSUPPORTED:area_model_interaction');
      const scope=page.locator(`[data-area-model="${block.id}"]`);
      await expect(scope).toBeVisible();await expect(scope.locator('.ll5-am-cells')).not.toHaveCount(0);break;
    }
    case 'READING_PASSAGE':{
      const scope=page.locator(`[data-reading-passage="${block.id}"]`);
      await expect(scope).toBeVisible();await expect(scope.getByRole('heading')).toContainText(block.title);break;
    }
    case 'DATA_PLOT':{
      const scope=page.locator(`[data-data-plot="${block.id}"]`);
      await expect(scope).toBeVisible();await expect(scope.locator('svg')).toBeVisible();
      await scope.getByText('Table of readings',{exact:true}).click();
      await expect(scope.locator('tbody tr')).toHaveCount(block.series.length);break;
    }
    case 'MEASUREMENT_TABLE':{
      const scope=page.locator('[data-block-type=MEASUREMENT_TABLE]');
      await expect(scope).toBeVisible();await expect(scope.locator('[data-fed]')).toHaveText(['5','5','3','5']);
      await expect(scope.getByText('Your entries stay on this screen only. They are not saved or sent.',{exact:true})).toBeVisible();break;
    }
    default:throw Error('UNSUPPORTED:unhandled_teaching_block');
  }
}

async function testBothDesigns(page:Page){
  const scope=page.locator('[data-block-type=DESIGN_CYCLE]');
  // Supplied synthetic control data. First success must still allow a second design;
  // a worse second attempt must not inherit the first attempt's success feedback.
  const supplied=[[5,5],[3,5]];
  for(const [i,counts] of supplied.entries()){
    await expect(scope).toHaveAttribute('data-design-iteration',String(i+1));
    await scope.getByRole('textbox').fill('SYNTHETIC supplied test fixture, not a physical measurement: change one switch contact, keep the battery, lamp and procedure fixed.');
    await scope.getByRole('button',{name:'Next: stay safe',exact:true}).click();
    for(const checkbox of await scope.getByRole('checkbox').all())await checkbox.check();
    await scope.getByRole('button',{name:'Next: test',exact:true}).click();
    const fields=scope.locator('[data-stage-body=TEST] input');
    for(const invalid of ['-1','6','2.5']){
      await fields.first().fill(invalid);
      await expect(fields.first()).toHaveAttribute('aria-invalid','true');
      await expect(scope.getByRole('button',{name:'Next: check the results',exact:true})).toBeDisabled();
    }
    for(const [j,value] of counts.entries()){
      const field=fields.nth(j);await field.focus();await field.press('ControlOrMeta+A');await field.pressSequentially(String(value));
    }
    const evaluate=scope.getByRole('button',{name:'Next: check the results',exact:true});
    await evaluate.focus();await evaluate.press('Enter');
    await expect(scope.locator('[data-design-feedback]')).toBeVisible();
    if(i===0)await expect(scope.locator('[data-design-feedback]')).toContainText('Design 1 meets every criterion');
    else{
      await expect(scope.locator('[data-design-feedback]')).toContainText('Not yet met: Light when closed');
      await expect(scope.locator('[data-design-feedback]')).not.toContainText('Design 2 meets every criterion');
      await scope.getByRole('textbox').fill('The supplied second design has fewer successes. Keep that result; compare the contact and consider returning to Design 1, without claiming a physical test.');
    }
    const row=page.locator('[data-block-type=MEASUREMENT_TABLE] tbody tr').nth(i);
    await expect(row.locator('[data-fed]')).toHaveText(counts.map(String));
    if(i===0){
      await scope.getByRole('textbox').fill('SUPPLIED fixture: Design 1 met the criteria. Compare a different contact feature while keeping the battery, lamp and five-trial procedure fixed, even though the first design worked.');
      await scope.getByRole('button',{name:'Test design 2',exact:true}).click();
    }
  }
  await expect(page.locator('[data-block-type=MEASUREMENT_TABLE] [data-fed]')).toHaveText(['5','5','3','5']);
  await expect(scope.getByText(/Earlier designs/)).toBeVisible();
}

export async function fillReflection(page:Page,scene:Scene,text:string){
  if(scene.interaction.kind==='FREE_RESPONSE')for(const prompt of scene.interaction.prompts)
    {
      expect(text.trim().length).toBeGreaterThanOrEqual(prompt.minLength);
      const field=page.locator(`[id="reflect-${prompt.id}"]`);
      await field.fill(text);await expect(field).toHaveValue(text);
    }
}
export {assertKeyboardReach} from './school-day-keyboard';
