const {chromium} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const out = 'artifacts/pr195-review/browser';
const base = process.env.PR195_REVIEW_BASE_URL || 'http://localhost:3298';
fs.mkdirSync(out, {recursive: true});
(async () => {
  const browser = await chromium.launch({headless: true});
  const observation = JSON.parse(fs.readFileSync(process.argv[2] || 'artifacts/pr195-review/contract-inventory.json'));
  const result = {checkedAt: new Date().toISOString(), integrationCommit: cp.execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), firstThreeAvailability: [], pilotControls: []};
  const bounded = (operation, label) => Promise.race([operation, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), 20000))]);
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({viewport: {width, height: 900}, serviceWorkers: 'block'});
    const writes = [];
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) { writes.push({method: request.method(), path: url.pathname}); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    for (const lesson of observation.firstThree) {
      const routeId = lesson.candidateId || lesson.proposedBlueprintId;
      if (!routeId || !/^[a-zA-Z0-9_-]+$/.test(routeId)) throw new Error('missing_or_unsafe_review_route_id');
      const response = await page.goto(`${base}/lab-review/experience/${routeId}`, {waitUntil: 'domcontentloaded', timeout: 120000});
      const screenshot = `${lesson.source.contentId}-${width}.png`;
      await page.screenshot({path: path.join(out, screenshot), fullPage: true, timeout: 20000});
      result.firstThreeAvailability.push({sourceId: lesson.source.contentId, probedProposedBlueprintId: lesson.proposedBlueprintId, candidateId: lesson.candidateId || null, width, httpStatus: response.status(), screenshot, status: !lesson.candidateId ? 'BLOCKED_NO_AUTHORED_CANDIDATE' : response.status() === 200 ? 'OPENED_REQUIRES_FULL_QA' : 'BLOCKED_REVIEW_ROUTE_UNAVAILABLE'});
      fs.writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2) + '\n');
    }
    const spec = JSON.parse(fs.readFileSync('curriculum/modernization/v1/pilot/g6-math-decimal-place-value/spec.json'));
    const response = await page.goto(`${base}/lab-review/experience/${spec.candidateId}`, {waitUntil: 'domcontentloaded', timeout: 120000});
    await page.waitForSelector('[data-scene-id]', {timeout: 120000});
    const layout = await page.evaluate(() => ({overflowPx: document.documentElement.scrollWidth - innerWidth, sceneId: document.querySelector('[data-scene-id]')?.getAttribute('data-scene-id')}));
    await page.screenshot({path: path.join(out, `pilot-control-${width}.png`), fullPage: true, timeout: 20000});
    let offlineProbe;
    try {
      await bounded(context.setOffline(true), 'offline-transition');
      offlineProbe = {loadedSceneRemainsOffline: await bounded(page.locator('[data-scene-id]').count(), 'offline-dom') === 1};
    } catch (error) { offlineProbe = {status: 'INCONCLUSIVE_RUNTIME_TIMEOUT', error: String(error)}; }
    result.pilotControls.push({width, httpStatus: response.status(), ...layout, ...offlineProbe, attemptedWrites: writes, note: 'Older pilot control only; does not certify first-three lessons, offline cold start, independent mastery or teacher evidence.'});
    fs.writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2) + '\n');
    await bounded(context.close(), 'context-close').catch(() => {});
  }
  await bounded(browser.close(), 'browser-close');
  console.log(JSON.stringify(result));
})().catch(error => {console.error(error); process.exitCode = 1;});
