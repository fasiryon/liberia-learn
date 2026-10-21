const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { encode } = require('next-auth/jwt');
const base = 'http://127.0.0.1:3195';
const artifactRoot = path.resolve('artifacts/pr195-review-route-repair/browser');
// Keep in-progress captures outside Next's watch tree; copy the finished receipt afterwards.
const out = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'liberialearn-pr195-review-'));
const ids = ['candidate-ft01-g7-civics-counties-capitals', 'candidate-ft04-g7-science-states-of-matter', 'candidate-ft07-g7-math-fractions'];
const receipt = { scope: 'Real immutable V2 packages, synthetic signed local reviewer sessions, no production credentials', access: [], rendering: [], sequences: [], violations: [], blockedMutations: [], errors: [], protectedResponsesInspected: 0, unavailableResponseBodies: 0 };
async function identity(context, role) {
  await context.clearCookies();
  if (role) await context.addCookies([{ name: 'next-auth.session-token', value: await encode({ secret: 'pr195-isolated-synthetic-review-secret', token: { id: `synthetic-${role}`, name: 'Synthetic reviewer', email: 'synthetic@example.invalid', role, isPlatformAdmin: false }, maxAge: 3600 }), url: base, httpOnly: true, sameSite: 'Lax' }]);
}
async function accessibility(page, label) {
  await page.evaluate(source => { const script = document.createElement('script'); script.nonce = document.querySelector('script[nonce]')?.nonce ?? ''; script.textContent = source; document.head.appendChild(script); }, fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  const axe = await page.evaluate(async () => { const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }); return { violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), incomplete: result.incomplete.map(v => ({ id: v.id, nodes: v.nodes.length })) }; });
  receipt.violations.push({ label, ...axe });
  assert.equal(axe.violations.length, 0, `axe violations: ${label}`);
}
async function matrix(page, id, phase) {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${id}-${phase}-${width} overflow`);
    await accessibility(page, `${id}-${phase}-${width}`);
    await page.screenshot({ path: path.join(out, `${id}-${phase}-${width}.png`), fullPage: true });
    receipt.rendering.push({ id, width, phase, overflow });
  }
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ serviceWorkers: 'allow', reducedMotion: 'reduce', hasTouch: true });
    const inspected = [];
    context.on('response', response => {
      if (!new URL(response.url()).pathname.startsWith('/lab-review/') || !/text\/html|text\/x-component|application\/json/.test(response.headers()['content-type'] ?? '')) return;
      inspected.push(response.text().then(body => {
        receipt.protectedResponsesInspected++;
        if (/correctOptionId|scoringSpecHash|originalAuthoringInputBase64|"specs"\s*:/.test(body)) receipt.errors.push('Protected assessment field in review response');
      }).catch(() => { receipt.unavailableResponseBodies++; })); // Chromium may discard aborted Next prefetch bodies.
    });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== base || (!['GET', 'HEAD'].includes(req.method()) && !/^\/lab-review\/experience\/candidate-[^/]+\/diagnostic$/.test(url.pathname))) {
        receipt.blockedMutations.push({ path: url.pathname, method: req.method() });
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', error => receipt.errors.push(error.message));
    for (const role of [null, 'STUDENT', 'TEACHER', 'ADMIN']) {
      await identity(context, role);
      for (const url of [`/lab-review/experience/${ids[0]}`, `/lab-review/experience/${ids[0]}/media/${'a'.repeat(64)}`, '/lab-review/experience/unknown']) {
        const response = await context.request.get(base + url);
        receipt.access.push({ role: role ?? 'ANONYMOUS', url, status: response.status() });
        assert.equal(response.status(), 404); assert.match(response.headers()['cache-control'], /no-store/);
      }
    }
    await identity(context, 'MOE_OFFICIAL');
    for (const unknown of ['unknown', '__proto__', 'candidate-unknown']) {
      const response = await context.request.get(`${base}/lab-review/experience/${unknown}`);
      receipt.access.push({ role: 'MOE_OFFICIAL', url: unknown, status: response.status() });
      assert.equal(response.status(), 404);
    }
    for (const id of ids) {
      await context.clearCookies(); await identity(context, 'MOE_OFFICIAL');
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const response = await page.goto(`${base}/lab-review/experience/${id}`);
        assert.equal(response.status(), 200);
        await page.locator('[data-review-phase="DIAGNOSTIC"]').waitFor();
        assert.match(response.headers()['cache-control'], /no-store/);
        const html = await response.text();
        assert(!/correctOptionId|scoringSpecHash|originalAuthoringInputBase64|"specs"/.test(html));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false);
        await page.screenshot({ path: path.join(out, `${id}-${width}-diagnostic.png`), fullPage: true });
        await accessibility(page, `${id}-${width}-diagnostic`);
        receipt.rendering.push({ id, width, phase: 'DIAGNOSTIC', status: response.status(), overflow });
      }
      // Native controls driven with the keyboard; responses intentionally miss numeric prerequisites.
      for (const fieldset of await page.locator('form fieldset').all()) {
        const radios = fieldset.locator('input[type=radio]');
        if (await radios.count()) { await radios.last().focus(); await page.keyboard.press('Space'); }
        else { const input = fieldset.locator('input'); await input.focus(); await page.keyboard.type('-987654321'); }
      }
      await page.getByRole('button', { name: 'Continue', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.locator('[data-review-phase="REMEDIATION"]').waitFor();
      await matrix(page, id, 'REMEDIATION');
      await page.getByRole('button', { name: 'Continue to instruction', exact: true }).click();
      await page.locator('#scene-title').waitFor();
      let labVisited = 0;
      const scenes = [];
      const capturedTypes = new Set();
      for (let step = 0; step < 40; step++) {
        const title = await page.locator('#scene-title').innerText();
        scenes.push(title);
        if (title === 'Assessment handoff') {
          await matrix(page, id, 'ASSESSMENT_HANDOFF');
          break;
        }
        const sceneType = await page.locator('[data-scene-type]').getAttribute('data-scene-type');
        if (['EXPLANATION', 'GUIDED_EXAMPLE', 'CHECK_UNDERSTANDING'].includes(sceneType) && !capturedTypes.has(sceneType)) {
          capturedTypes.add(sceneType);
          await matrix(page, id, sceneType);
        }
        for (const fieldset of await page.locator('article fieldset').all()) {
          const radio = fieldset.locator('input[type=radio]').first();
          if (await radio.count()) await radio.check();
        }
        for (const textarea of await page.locator('article textarea').all()) await textarea.fill('Synthetic review response explaining the learner observation and reasoning.');
        const reveal = page.locator('article button[aria-expanded="false"]:enabled');
        while (await reveal.count()) await reveal.first().click();
        const launch = page.getByRole('link', { name: /explore in lab|open.*lab|enter.*lab|start.*lab/i });
        const launchButton = page.getByRole('button', { name: /explore in lab|open.*lab|enter.*lab|start.*lab/i });
        const launchControl = await launch.count() ? launch.first() : launchButton.first();
        if (await launchControl.count()) {
          await launchControl.click();
          await page.getByRole('button', { name: 'Back to lesson', exact: true }).waitFor();
          await page.getByRole('button', { name: 'Start exploring', exact: true }).focus();
          await page.keyboard.press('Enter');
          await page.locator('[data-lab-active-profile]').waitFor();
          await page.getByLabel('Visual quality', { exact: true }).selectOption('FALLBACK_2D');
          await page.locator('[data-lab-renderer="svg"]').waitFor();
          const tools = page.getByRole('region', { name: 'Learning tools', exact: true });
          const before = await tools.innerText();
          if (id.includes('civics')) {
            await page.getByLabel('County', { exact: true }).focus();
            await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
          } else if (id.includes('science')) {
            await page.getByLabel('Added energy', { exact: true }).focus();
            await page.keyboard.press('ArrowRight');
          } else {
            await page.getByRole('button', { name: /Strip A, whole 1, piece 1 of/ }).focus();
            await page.keyboard.press('Enter');
          }
          assert.notEqual(await tools.innerText(), before, 'The simulation control must change its derived learner-visible state');
          assert(Number(await page.locator('[data-lab-renderer="svg"]').getAttribute('data-lab-frames-rendered')) > 0);
          await matrix(page, id, `LAB-${labVisited}`);
          await page.getByRole('button', { name: 'Back to lesson', exact: true }).focus();
          await page.keyboard.press('Enter');
          await page.locator('#scene-title').waitFor();
          assert.equal(await page.locator('#scene-title').innerText(), title, 'Lab return restores the originating scene');
          labVisited++;
        }
        const proceed = page.getByRole('button', { name: 'Continue', exact: true });
        await proceed.click();
        await page.waitForFunction(previous => document.querySelector('#scene-title')?.textContent !== previous, title);
      }
      assert.equal(scenes.at(-1), 'Assessment handoff');
      assert(labVisited > 0);
      const cachePaths = await page.evaluate(async () => { const result = []; for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) result.push(new URL(req.url).pathname); return result; });
      assert(!cachePaths.some(url => url.startsWith('/lab-review')));
      receipt.sequences.push({ id, diagnostic: true, remediation: true, instruction: true, guidedPractice: true, labVisits: labVisited, simulationsStarted: labVisited, keyboardModelChanges: labVisited, renderer: 'svg', positiveRenderedFrameCount: true, exactLabReturnScene: true, assessmentHandoff: true, sceneCount: scenes.length, reviewCacheEntries: 0 });
    }
    await Promise.all(inspected);
    assert.equal(receipt.errors.length, 0);
    assert.equal(receipt.blockedMutations.length, 0);
    receipt.status = 'PASS';
    await context.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(receipt, null, 2) + '\n');
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.cpSync(out, artifactRoot, { recursive: true });
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
