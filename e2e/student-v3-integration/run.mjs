import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const out = "artifacts/student-v3-integration"; await fs.mkdir(out, { recursive: true }); const server = await createServer({ configFile: "e2e/student-v3-integration/vite.config.ts", server: { strictPort: true } }); await server.listen();
const loader = await createServer({ configFile: "e2e/student-v3-integration/vite.config.ts", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
const legacy = await loader.ssrLoadModule("/../product-design-v2/legacyLessonFixtures.ts");
const generated = await loader.ssrLoadModule("/../product-design-v2/generatedLessonFixture.ts");
await loader.close();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.route("**/api/**", async (route) => {
  const url = new URL(route.request().url()); const p = url.pathname;
  if (p.endsWith("/experience")) return route.fulfill({ status: 404, json: { error: "not_found" } });
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

const page = await context.newPage();
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(180000);
const errors = [], writes = [], tutorRequests = [], results = [], scans = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => { if (req.method() === 'POST') { writes.push(new URL(req.url()).pathname); if (req.url().includes('/api/rag/query')) tutorRequests.push(req.postDataJSON()); } });
const base = 'http://127.0.0.1:3197';
const nav = () => page.getByRole('navigation', { name: 'Student', exact: true });
const openNav = async name => { await nav().getByRole('link', { name: new RegExp(`^${name}`) }).click(); };
const go = async path => { await page.goto(base + path, { waitUntil: 'domcontentloaded' }); await page.locator('h1').first().waitFor(); };
const screenshot = async name => { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${out}/${name}.png`, fullPage: false }); };
async function check(name, width, dashboard = false) {
  const m = await page.evaluate(dashboard => {
    const body = document.querySelector('.pdv2-body').getBoundingClientRect(); const main = document.querySelector('.pdv2-body main'); const r = main.getBoundingClientRect(), c = getComputedStyle(main);
    const links = [...document.querySelectorAll('.pdv2-nav a')];
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, left: Math.round(r.left-body.left+parseFloat(c.paddingLeft)), right: Math.round(body.right-r.right+parseFloat(c.paddingRight)), navVisible: !dashboard || links.every(a => { const b=a.getBoundingClientRect(); return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('a')===a; }) };
  }, dashboard);
  assert(!m.overflow, `${name}/${width} overflow`); assert(m.navVisible, `${name}/${width} nav blocked`);
  if (dashboard) assert(Math.abs(m.left-m.right)<=2, `${name}/${width} margins ${JSON.stringify(m)}`);
  results.push({ name, width, ...m }); await screenshot(`${name}-${width}`);
  console.log(`${name}/${width} layout passed`);
}
async function axe(name, width) {
  await page.addScriptTag({ path:'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']} })).violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
  scans.push({name,width,violations}); assert(!violations.some(v=>['serious','critical'].includes(v.impact)), `${name}/${width} axe ${JSON.stringify(violations)}`);
}
try {
for (const width of [390,768,1440,1920]) {
  await page.setViewportSize({width,height:width<768?844:1000});
  await go('/student/today'); await page.evaluate(() => sessionStorage.clear()); await check('today',width,true); await axe('today',width);
  await openNav('Learn'); await page.getByRole('link',{name:/Browse the lesson library/}).waitFor(); await check('learn',width,true); await axe('learn',width);
  await page.getByRole('link',{name:/Browse the lesson library/}).click();
  await page.getByRole('link',{name:/Place value component fixture/}).click(); await page.locator('[data-reading-layout=playlist]').waitFor();
  assert.equal(await page.locator('[data-read-section]:visible').count(),1);
  await check('lesson-read',width); await axe('lesson-read',width);
  await page.getByRole('group',{name:'How to use this lesson'}).getByRole('button',{name:'Slides',exact:true}).click();
  await page.locator('[data-legacy-slides]').waitFor(); await check('lesson-slides',width);
  await page.getByRole('button',{name:/Ask the AI tutor about this lesson/}).first().click();
  await page.getByRole('region',{name:'AI assistant',exact:true}).waitFor();
  assert.equal(await page.locator('textarea[aria-label="Your question"]').count(),1,'one tutor');
  await page.getByRole('textbox',{name:'Your question'}).fill('Explain the value of the digit.');
  await page.getByRole('button',{name:'Ask Assistant',exact:true}).click();
  await page.getByText('Synthetic grounded-response fixture.').waitFor();
  assert.equal(tutorRequests.at(-1)?.tutorContext?.contentId,legacy.LEGACY_CONTENT_ID,'lesson context preserved');
  await screenshot(`lesson-tutor-${width}`); await page.getByRole('textbox',{name:'Your question'}).focus(); await page.keyboard.press('Escape');
  await page.getByRole('region',{name:'AI assistant',exact:true}).waitFor({state:'detached'});
  await page.getByRole('link',{name:'Back to Learn',exact:true}).click(); await openNav('Today');
  await openNav('Help'); await page.getByRole('textbox',{name:'Your question'}).waitFor(); await check('help',width,true); await axe('help',width);
  await openNav('Today'); await page.getByRole('heading',{name:/Good|Today|Hello|Your day/i}).first().waitFor(); await openNav('Help'); await page.getByRole('textbox',{name:'Your question'}).waitFor();
  await page.getByRole('textbox',{name:'Your question'}).fill('Keep my question while I use navigation.');
  await page.getByRole('textbox',{name:'Your question'}).focus();
  for(let i=0;i<70;i++){ const focused=await page.evaluate(()=>document.activeElement?.getAttribute('href')); if(focused==='/student/learn') break; await page.keyboard.press('Shift+Tab'); }
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/student/learn'); await page.keyboard.press('Enter');
  await page.getByRole('link',{name:/Textbooks/}).first().click(); await page.getByRole('heading',{name:'My Textbooks'}).waitFor(); await check('textbook-hub',width); await axe('textbook-hub',width);
  await page.getByRole('link',{name:/Understanding halves/}).click(); await page.getByRole('heading',{name:/Place value.*synthetic integration fixture/}).waitFor();
  await page.getByRole('button',{name:'Bookmark',exact:true}).click(); assert.equal(await page.getByRole('button',{name:'Bookmarked',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Next',exact:true}).click(); await check('textbook-reader',width); await axe('textbook-reader',width);
  if (await page.getByRole('button',{name:'Contents',exact:true}).isVisible()) await page.getByRole('button',{name:'Contents',exact:true}).click(); await page.getByRole('navigation',{name:'Chapters'}).waitFor(); await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Increase font size'}).click(); await page.getByRole('combobox',{name:'Layout'}).selectOption('single');
  assert(await page.getByText('Offline reopening is not supported',{exact:false}).isVisible());
  await page.reload({waitUntil:'domcontentloaded'}); await page.getByRole('combobox',{name:'Layout'}).waitFor(); assert.equal(await page.getByRole('combobox',{name:'Layout'}).inputValue(),'single');
  await openNav('Labs'); await check('labs',width,true); await axe('labs',width); await openNav('Progress'); await page.waitForTimeout(300); await check('progress',width,true); await axe('progress',width); await openNav('Today');
  results.push({width,flow:'Today > Learn > Lesson Read/Slides > contextual Tutor > Today; Today > Help > Learn > Textbooks > Reader; Labs > Progress > Today',status:'pass'});
}
assert.deepEqual(writes.filter(p=>!['/api/rag/query','/api/track'].includes(p)),[], 'no completion/evidence/mastery writes');
assert.deepEqual(errors,[]);
} finally {
 await fs.writeFile(`${out}/browser-results.json`,JSON.stringify({results,scans,errors,writes,caveat:'Integrated production component tree, synthetic identity/API/server-rendered hub fixtures. Protected-route authority tested separately; no hosted session or production curriculum claim.'},null,2));
 await browser.close(); await server.close();
}
