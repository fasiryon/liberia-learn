import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = "artifacts/student-v3-integration"; await fs.mkdir(out, { recursive: true }); const server = await createServer({ configFile: "e2e/student-v3-integration/vite.config.ts", server: { strictPort: true } }); await server.listen();
const loader = await createServer({ configFile: "e2e/student-v3-integration/vite.config.ts", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const native = await loader.ssrLoadModule("/../product-design-v2/lessonFixtures.ts");
const legacy = await loader.ssrLoadModule("/../product-design-v2/legacyLessonFixtures.ts");
const generated = await loader.ssrLoadModule("/../product-design-v2/generatedLessonFixture.ts");
await loader.close();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", async (route) => {
  const url = new URL(route.request().url()); const p = url.pathname;
  if (p.endsWith("/experience")) return (p.includes("fixture-levers-g6") || p.includes("fixture-native-work")) ? route.fulfill({ json: native.runtimeLessonDelivery(6, { labAuthorized: false, ...(p.includes("fixture-native-work") ? { routeTarget: { kind: "SCHEDULED_WORK", scheduledWorkId: "fixture-native-work", contentId: "fixture-levers-g6" } } : {}) }) }) : route.fulfill({ status: 404, json: { error: "not_found" } });
  if (p.endsWith(generated.STRESS_CONTENT_ID)) return route.fulfill({ json: generated.stressCurriculumResponse() });
  if (p.startsWith("/api/curriculum/")) return route.fulfill({ json: legacy.legacyCurriculumResponse() });
  if (p.startsWith("/api/student/work/")) return route.fulfill({ json: legacy.legacyWorkResponse() });
  if (p === "/api/student/lessons") return route.fulfill({ json: { availability: "current", page: 1, totalPages: 1, total: 1, items: [{ contentId: legacy.LEGACY_CONTENT_ID, displayTitle: "Place value component fixture", subject: "MATH", grade: 7, href: `/student/lesson/${legacy.LEGACY_CONTENT_ID}` }] } });
  if (p === "/api/student/progress") return route.fulfill({ json: legacy.progressFixture() });
  if (p === "/api/adaptive/mastery") return route.fulfill({ json: { records: [] } });
  if (p.includes("next-action")) return route.fulfill({ json: { available: false } });
  if (p === "/api/student/learn") return route.fulfill({ json: {
    schemaVersion: "learn-discovery/2", availability: "current", freshness: "current", generatedAt: "2026-10-14T12:00:00Z",
    currentLearning: { availability: "separate", endpoint: "/api/student/learning-authority/next-action" }, subjects: [{ subject: "MATH", label: "Mathematics" }], subjectCompletion: [],
    lessons: { availability: "current", total: 1, items: [{ state: "open", locked: false, href: "/student/lesson/fixture-g7-place-value-legacy", availability: "current", contentId: "fixture-g7-place-value-legacy", title: "Place value component fixture", subject: "MATH", grade: 7 }] },
    activeUnits: { availability: "empty", eligibility: "eligible", items: [] }, assignedWork: { availability: "empty", items: [] }, checks: { availability: "empty", total: 0, items: [] },
    resources: { availability: "empty", items: [], destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" }, search: { availability: "deferred" }, limits: { perSection: 100, linkedContent: 200, catalogBoundReached: false },
  } });
  if (p.includes("/today")) return route.fulfill({ json: { availability: "current", items: [], catchUpItems: [], completedCount: 0, remainingCount: 0 } });
  if (p.includes("/assignments")) return route.fulfill({ json: { assignments: [] } });
  if (p.includes("teacher-lessons")) return route.fulfill({ json: { lessons: [] } });
  if (p.includes("inbox")) return route.fulfill({ json: { items: [], unreadCount: 0 } });
  if (p.includes("announcements")) return route.fulfill({ json: { announcements: [] } });
  if (p.includes("rag/query")) return route.fulfill({ json: { answer: "Synthetic grounded-response fixture.", sources: [], retrievalWeak: true, hadFallback: false, isWeakGrounding: true, actions: [] } });
  return route.fulfill({ json: { sessions: [] } });
});


const page = await context.newPage(); page.setDefaultTimeout(180000); page.setDefaultNavigationTimeout(180000);
const results=[],errors=[],writes=[],scans=[];
page.on('pageerror',e=>errors.push(e.message)); page.on('request',req=>{if(req.method()==='POST') writes.push(new URL(req.url()).pathname);});
const go=async(path,ready='[data-reading-layout=playlist]')=>{await page.goto('http://127.0.0.1:3197'+path,{waitUntil:'domcontentloaded'});await page.locator(ready).waitFor();console.log(path+' ready');};
const selected=()=>page.locator('[data-read-section]:visible').getAttribute('data-read-section');
const s17='section-17-the-section-a-learner-opens-directly';
try {
 for(const width of [390,768,1440,1920]){
  await page.setViewportSize({width,height:width<768?844:1000});
  const path=`/student/lesson/${generated.STRESS_CONTENT_ID}?grade=7&section=${s17}`;
  await go(path); assert.equal(await selected(),s17); assert.equal(await page.locator('[data-read-section]:visible').count(),1);
  if(width>=1440){
   const geometry=await page.locator('.ll4-read-rail ol').evaluate(el=>({scroll:el.scrollHeight>el.clientHeight,height:el.getBoundingClientRect().height,viewport:innerHeight}));assert(geometry.scroll&&geometry.height<=geometry.viewport);results.push({width,independentContentsScroll:geometry});
  }else{
   await page.locator('.ll4-read-drawer .ll4-drawer-trigger').click();const dialog=page.getByRole('dialog',{name:'Contents'});await dialog.waitFor();await page.screenshot({path:`${out}/contents-drawer-${width}.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  }
  await page.locator('.ll4-read-pager button').nth(1).click();const next=await selected();assert.notEqual(next,s17);
  await page.goBack();await page.waitForFunction(id=>!document.getElementById(id)?.hidden,s17);assert.equal(await selected(),s17);
  await page.goForward();await page.waitForFunction(id=>!document.getElementById(id)?.hidden,next);await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-reading-layout=playlist]').waitFor();assert.equal(await selected(),next);
  await page.screenshot({path:`${out}/lesson-deeplink-${width}.png`});
  await go(`/student/lessons/${legacy.LEGACY_WORK_ID}?grade=7`);
  if(width>=1440) await page.locator('.ll4-read-rail button').last().click();else{await page.locator('.ll4-read-drawer .ll4-drawer-trigger').click();await page.getByRole('dialog',{name:'Contents'}).getByRole('button').filter({hasText:'Key takeaways'}).click();}
  await page.locator('[data-read-final]:visible').getByRole('button',{name:'Go to assessment'}).click();const input=page.getByPlaceholder('Write your answer here').first();await input.fill('An unfinished learner response');
  await page.getByRole('group',{name:'How to use this lesson'}).getByRole('button',{name:/^slides$/i}).click(); await page.getByRole('group',{name:'How to use this lesson'}).getByRole('button',{name:/^read$/i}).click();
  if(width>=1440) await page.locator('.ll4-read-rail button').last().click();else{await page.locator('.ll4-read-drawer .ll4-drawer-trigger').click();await page.getByRole('dialog',{name:'Contents'}).getByRole('button').filter({hasText:'Key takeaways'}).click();}
  await page.locator('[data-read-final]:visible').getByRole('button',{name:'Go to assessment'}).click();assert.equal(await input.inputValue(),'An unfinished learner response');
  assert.equal(await page.locator('[data-assistant-presentation]').count(),0,'assigned route owns its tutor');await page.screenshot({path:`${out}/assigned-response-${width}.png`});
  await go('/student/lesson/fixture-levers-g6','[data-lesson-player-v2]');
  const nextScene=page.locator('footer').getByRole('button',{name:/^Continue/});while(await page.locator('[data-diagram-reveal]').count()===0) await nextScene.click();for(const label of ['Effort','Fulcrum','Load'])await page.locator('button[aria-expanded]',{hasText:label}).click();assert.equal(await page.locator('.ll4-diagram-steps > li[data-state=open]').count(),3);
  await page.screenshot({path:`${out}/native-diagram-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact})));scans.push({width,violations});assert(!violations.some(v=>['serious','critical'].includes(v.impact)));
  await go('/student/lessons/fixture-native-work','[data-lesson-player-v2]'); await page.getByRole('button',{name:/Ask the AI tutor about this lesson/}).click(); await page.getByRole('region',{name:'AI assistant',exact:true}).waitFor(); assert.equal(await page.locator('[data-assistant-presentation]').count(),1); await page.getByRole('textbox',{name:'Your question'}).fill('Keep my native lesson question'); await page.keyboard.press('Escape'); await page.getByRole('region',{name:'AI assistant',exact:true}).waitFor({state:'detached'});
  results.push({width,sectionHistoryRefresh:'pass',assignedInputRetained:'pass',nativeDiagram:'pass',assignedNativeTutor:'pass'});
 }
 await go('/student/textbooks/fixture-halves','[aria-label="Book reader"]');
 const pages=page.getByRole('region',{name:'Book pages. Use left and right arrow keys to turn pages.'});
 await pages.waitFor(); assert.equal(await pages.locator('article').count(),2,'desktop spread');
 await pages.focus();await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'Bookmark',exact:true}).click();
 if(await page.getByRole('button',{name:'Contents',exact:true}).isVisible()) await page.getByRole('button',{name:'Contents',exact:true}).click();
 await page.getByRole('button',{name:/^Bookmarks/}).click();await page.getByRole('navigation',{name:'Bookmarks'}).getByRole('button').first().click();
 if(await page.getByRole('button',{name:'Contents',exact:true}).isVisible()) await page.getByRole('button',{name:'Contents',exact:true}).click();await page.getByRole('button',{name:'Chapters',exact:true}).click();await page.getByRole('navigation',{name:'Chapters'}).getByRole('button').last().click();
 await context.setOffline(true);await page.getByText('You are offline. Keep this book open',{exact:false}).waitFor();assert(await pages.isVisible());await page.screenshot({path:`${out}/reader-offline-loaded-text.png`});await context.setOffline(false);
 results.push({readerSpreadsBookmarksChaptersKeyboard:'pass',offline:'loaded text remains readable; reopening explicitly unsupported'});
 await context.route('**/api/student/learn',route=>route.fulfill({status:500,json:{error:'Synthetic unavailable response'}}));await go('/student/learn','#learn-heading');await page.locator('.pdv2-learn-notice').first().waitFor();await page.screenshot({path:`${out}/learn-unavailable.png`});results.push({learnFailureState:'unavailable, no fabricated empty success'});
 assert.deepEqual(writes.filter(p=>p!=='/api/track'),[],'no fabricated evidence or completion');assert.deepEqual(errors,[]);
}finally{await fs.writeFile(`${out}/lesson-details.json`,JSON.stringify({results,scans,errors,writes},null,2));await browser.close();await server.close();}
