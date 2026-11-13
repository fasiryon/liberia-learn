import {test,expect,type Page} from '@playwright/test';
import {SCHOOL_DAY_IDS as ids,SCHOOL_DAY_EMAILS as emails,requireSyntheticSchoolDayDatabase} from '../scripts/e2e/school-day-contract';
import {academicSnapshot,assertNoExternalCalls,login,syntheticDatabase} from './g4-school-day.support';

const slots=(page:Page)=>page.locator('nav[aria-label="Today\'s schedule"] [data-slot]');
export async function expectHonestDaySummary(page:Page,opened:number){
  const summary=page.locator('[data-day-end-summary]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(`You opened ${opened} of 8 periods in this browser session.`);
  await expect(summary).toContainText('Your own list is not a record of lessons finished.');
  await expect(summary).toContainText('Your reflection stays on this screen only. It is not saved or sent.');
  await expect(page.getByRole('note').filter({hasText:'Rehearsal day.'})).toContainText('Nothing here is saved, graded or sent to your school record.');
  // Positive disclaimers above must not be defeated by a contradictory success claim.
  await expect(summary).not.toContainText(/(?:\b[1-8] of 8|all 8) (?:lessons|periods) (?:completed|finished)|(?:progress|reflection|completion|grades?) (?:was |is |has been )?(?:saved|submitted|recorded)|official grade (?:awarded|saved|recorded)/i);
}
async function summary(page:Page,opened:number){
  await expect(slots(page)).toHaveCount(8);
  await slots(page).last().click();
  await page.locator('[data-day-end]').click();
  await expectHonestDaySummary(page,opened);
}
async function openAndLeave(page:Page,index:number){
  await slots(page).nth(index).click();
  await page.locator('[data-day-open]').click();
  await expect(page.locator('[data-lesson-player-v2]')).toBeVisible();
  await page.getByRole('link',{name:'Leave lesson',exact:true}).click();
  await expect(page).toHaveURL(url=>url.pathname==='/learn/day');
}
async function signOutWithoutClearingDayState(page:Page){
  // CSRF is used only in memory for the real auth endpoint. No storageState,
  // auth-cookie inspection, traces, token attachments or environment dumps.
  const response=await page.request.get('/api/auth/csrf');
  expect(response.status()).toBe(200);
  const {csrfToken}=await response.json();
  if(typeof csrfToken!=='string'||!csrfToken)throw Error('synthetic_signout_csrf_missing');
  const signedOut=await page.request.post('/api/auth/signout',{form:{csrfToken,json:'true',callbackUrl:'http://127.0.0.1:3100/login'}});
  expect(signedOut.ok()).toBe(true);
  const session=await(await page.request.get('/api/auth/session')).json();
  expect(session.user).toBeUndefined();
}

/** Called by the existing entrypoint: these checks cannot disappear from the named CI suite. */
export function registerDayDisplayChecks(){
  test.describe('Grade 4 browser-session display contract',()=>{
    // The importing spec disables traces/video at file scope for every case.
    test('opened counts survive reload, deduplicate repeats and isolate learners and browser sessions',async({page,browser})=>{
      const db=syntheticDatabase(),before=await academicSnapshot(db);
      const fresh=await browser.newContext({baseURL:'http://127.0.0.1:3100',storageState:{cookies:[],origins:[]}});
      try{
        await login(page,emails.student,'student');await page.goto('/learn/day');await summary(page,0);
        // Merely inspecting all eight timetable cards is not opening their lessons.
        for(let i=0;i<8;i++)await slots(page).nth(i).click();
        await summary(page,0);
        await openAndLeave(page,0);await summary(page,1);
        await openAndLeave(page,0);await summary(page,1);
        await page.reload();await expectHonestDaySummary(page,1);
        const other=await fresh.newPage();await login(other,emails.student,'student');await other.goto('/learn/day');await summary(other,0);
        // Same tab retains display sessionStorage across logout; a second learner
        // must still start at zero. Switching back must restore only the first learner.
        await signOutWithoutClearingDayState(page);
        await login(page,emails.student2,'student');await page.goto('/learn/day');await summary(page,0);
        await openAndLeave(page,1);await summary(page,1);
        await signOutWithoutClearingDayState(page);
        await login(page,emails.student,'student');await page.goto('/learn/day');await summary(page,1);
        await openAndLeave(page,2);await summary(page,2);
        await other.reload();await expectHonestDaySummary(other,0);
        expect(await academicSnapshot(db)).toEqual(before);assertNoExternalCalls();
      }finally{await fresh.close();await db.$disconnect();}
    });

    test('same-date replacement with identical timetable IDs starts at zero and preserves original-plan counts',async({page})=>{
      requireSyntheticSchoolDayDatabase(process.env);
      const db=syntheticDatabase(),before=await academicSnapshot(db);
      const where={id:'g4-e2e-period-1',schoolId:ids.school,classId:ids.class};
      const original=await db.timetable.findFirstOrThrow({where,select:{id:true,startTime:true,endTime:true}});
      // The seeded first period is 08:00-08:35; a one-minute end change keeps
      // every ID, binding, package and date intact while replacing the plan.
      expect(original.startTime).toBe('08:00');expect(original.endTime).toBe('08:35');
      let changed=false;
      try{
        await login(page,emails.student,'student');await page.goto('/learn/day?clock=08:10');
        const plan=await page.locator('[data-school-day]').getAttribute('data-school-day');expect(plan).toBeTruthy();
        await openAndLeave(page,0);await summary(page,1);
        expect((await db.timetable.updateMany({where,data:{endTime:'08:36'}})).count).toBe(1);changed=true;
        await page.goto('/learn/day?clock=08:10');
        await expect(page.locator('[data-school-day]')).toHaveAttribute('data-school-day',plan!);
        await summary(page,0);
        await openAndLeave(page,1);await summary(page,1);
        // A leaked Plan-A count would make this two. Restoring A must recover
        // its own one count, rather than importing B's newly opened period.
        expect((await db.timetable.updateMany({where,data:{endTime:original.endTime}})).count).toBe(1);changed=false;
        await page.goto('/learn/day?clock=08:10');await summary(page,1);
        await openAndLeave(page,1);await summary(page,2);
        expect(await academicSnapshot(db)).toEqual(before);assertNoExternalCalls();
      }finally{
        try{if(changed)expect((await db.timetable.updateMany({where,data:{endTime:original.endTime}})).count).toBe(1);}
        finally{await db.$disconnect();}
      }
    });

    test('school clock distinguishes gaps and outside hours while all eight periods remain open for practice',async({page})=>{
      const db=syntheticDatabase(),before=await academicSnapshot(db);
      try{
        await login(page,emails.student,'student');
        for(const [clock,message]of [['07:59','Outside school hours. Your periods are open for practice.'],['08:37','Between periods.'],['13:15','Outside school hours. Your periods are open for practice.'],['23:59','Outside school hours. Your periods are open for practice.']]){
          await page.goto(`/learn/day?clock=${clock}`);
          await expect(page.locator('[data-school-day]')).toHaveAttribute('data-clock',clock);
          await expect(page.locator('[data-label="Now"]')).toContainText(message);
          await expect(page.locator('[data-label="Now"]')).not.toContainText(/School (?:has not started|is over)/);
          await summary(page,0);
        }
        await page.goto('/learn/day?clock=08:10');
        await expect(page.locator('[data-day-now]')).toHaveAttribute('data-day-now','P1');
        const opened=new Set<string>();
        for(let i=0;i<8;i++){
          await slots(page).nth(i).click();
          const href=await page.locator('[data-day-open]').getAttribute('href');
          if(!href||opened.has(href))throw Error('eight_distinct_period_lessons_required');
          opened.add(href);await openAndLeave(page,i);await summary(page,i+1);
        }
        expect(opened.size).toBe(8);await page.reload();await expectHonestDaySummary(page,8);
        expect(await academicSnapshot(db)).toEqual(before);assertNoExternalCalls();
      }finally{await db.$disconnect();}
    });
  });
}
